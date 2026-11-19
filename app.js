// Kick the Bin — dump your thoughts, keep what matters, kick the rest.
const STORE_KEY = 'kickthebin:v1';
const DAY = 86400000;

const $ = (sel) => document.querySelector(sel);
const els = {
  form: $('#dumpForm'), input: $('#dumpInput'), list: $('#list'), empty: $('#empty'),
  bin: $('#bin'), binCount: $('#binCount'), toast: $('#toast'), toastMsg: $('#toastMsg'),
  undoBtn: $('#undoBtn'), themeBtn: $('#themeBtn'), exportBtn: $('#exportBtn'),
  importInput: $('#importInput'), clearDoneBtn: $('#clearDoneBtn'),
  statBinned: $('#statBinned'), statDone: $('#statDone'), statStreak: $('#statStreak'),
};

// ---------- state ----------
const blank = () => ({ items: [], binnedTotal: 0, log: { binned: [], done: [] }, activeDays: [], theme: null });
let state = load();
let tab = 'inbox';
let undoStack = [];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && Array.isArray(raw.items)) return { ...blank(), ...raw, log: { ...blank().log, ...raw.log } };
  } catch { /* storage unavailable or corrupt */ }
  return blank();
}
function save() {
  // keep the activity log trimmed to the last 60 days
  const cutoff = Date.now() - 60 * DAY;
  state.log.binned = state.log.binned.filter((t) => t > cutoff);
  state.log.done = state.log.done.filter((t) => t > cutoff);
  state.activeDays = state.activeDays.slice(-120);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');

function markActive() {
  const k = dayKey();
  if (!state.activeDays.includes(k)) state.activeDays.push(k);
}
function snapshot(label) {
  undoStack.push({ label, data: JSON.stringify(state) });
  if (undoStack.length > 20) undoStack.shift();
}
function undo() {
  const last = undoStack.pop();
  if (!last) return;
  state = JSON.parse(last.data);
  save(); render(); hideToast();
}

// ---------- actions ----------
function addThoughts(texts) {
  const clean = texts.map((t) => t.replace(/^\s*[-*•\d.)]+\s*/, '').trim()).filter(Boolean);
  if (!clean.length) return;
  snapshot('dump');
  const now = Date.now();
  clean.reverse().forEach((text, i) => state.items.unshift({ id: uid(), text: text.slice(0, 200), list: 'inbox', created: now - i, updated: now }));
  markActive(); save();
  if (tab !== 'inbox') setTab('inbox'); else render();
  if (clean.length > 1) showToast(`Dumped ${clean.length} thoughts`);
}

function move(id, list) {
  const item = state.items.find((i) => i.id === id);
  if (!item || item.list === list) return;
  snapshot('move');
  const was = item.list;
  item.list = list;
  item.updated = Date.now();
  if (list === 'done') { item.doneAt = Date.now(); state.log.done.push(item.doneAt); }
  if (was === 'done' && list !== 'done') {
    // un-completing: drop its entry from the activity log
    const idx = state.log.done.lastIndexOf(item.doneAt);
    if (idx > -1) state.log.done.splice(idx, 1);
    delete item.doneAt;
  }
  markActive(); save();
  const label = { today: 'Moved to Today', later: 'Saved for Later', done: 'Nice — done!', inbox: 'Back to Inbox' }[list];
  animateOut(id, list === 'done' ? 'right' : 'up').then(() => { render(); showToast(label, true); });
}

function kick(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  snapshot('kick');
  state.items = state.items.filter((i) => i.id !== id);
  state.binnedTotal += 1;
  state.log.binned.push(Date.now());
  markActive(); save();
  const card = els.list.querySelector(`[data-id="${id}"]`);
  const done = card ? flyToBin(card) : Promise.resolve();
  done.then(() => { render(); showToast(kickLine(), true); });
}

const KICK_LINES = ['Kicked. One less thing.', 'Gone. Feel lighter?', 'Straight in the bin.', 'Let it go. ✌️', 'Bin it to win it.', 'Out of your head.'];
const kickLine = () => KICK_LINES[Math.floor(Math.random() * KICK_LINES.length)];

function editText(id, text) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  text = text.trim();
  if (!text || text === item.text) return render();
  snapshot('edit');
  item.text = text.slice(0, 200);
  item.updated = Date.now();
  save(); render();
}

// ---------- animations ----------
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function collapse(card) {
  const h = card.offsetHeight;
  return card.animate(
    [{ height: h + 'px', marginBottom: '0px', opacity: 0 }, { height: '0px', marginBottom: '-8px', opacity: 0, paddingTop: 0, paddingBottom: 0 }],
    { duration: 200, easing: 'ease-in', fill: 'forwards' }
  ).finished;
}

function animateOut(id, dir) {
  const card = els.list.querySelector(`[data-id="${id}"]`);
  if (!card || reduceMotion()) return Promise.resolve();
  const to = dir === 'right' ? 'translateX(60px)' : 'translateY(-10px) scale(.96)';
  return card.animate([{ opacity: 1 }, { opacity: 0, transform: to }], { duration: 180, easing: 'ease-in', fill: 'forwards' })
    .finished.then(() => collapse(card));
}

function flyToBin(card) {
  if (reduceMotion()) { gulp(); return Promise.resolve(); }
  const r = card.getBoundingClientRect();
  const b = els.bin.getBoundingClientRect();
  const flyer = card.cloneNode(true);
  flyer.classList.add('flyer');
  flyer.style.cssText += `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;transform:${card.style.transform || 'none'}`;
  document.body.appendChild(flyer);
  card.style.visibility = 'hidden';
  els.bin.classList.add('open');

  const dx = b.left + b.width / 2 - (r.left + r.width / 2);
  const dy = b.top + b.height / 2 - (r.top + r.height / 2);
  const startX = parseFloat((card.style.transform.match(/-?[\d.]+/) || [0])[0]) || 0;
  const lift = Math.min(260, 120 + Math.abs(dy) * 0.35);
  const spin = (dx >= 0 ? 1 : -1) * 600;
  const frames = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const e = t; // horizontal is linear, vertical gets a parabolic arc → feels like a kick
    const x = startX + (dx - startX) * e;
    const y = dy * t * t - lift * 4 * t * (1 - t);
    const s = 1 - 0.88 * Math.min(1, t * 1.6);
    frames.push({
      transform: `translate(${x}px, ${y}px) rotate(${spin * t}deg) scale(${s})`,
      borderRadius: `${14 + 200 * Math.min(1, t * 2)}px`,
      opacity: t > 0.92 ? 0 : 1,
      offset: t,
    });
  }
  const fly = flyer.animate(frames, { duration: 650, easing: 'cubic-bezier(.35,.0,.6,1)', fill: 'forwards' });
  return fly.finished.then(() => {
    flyer.remove();
    gulp();
    return collapse(card);
  });
}

function gulp() {
  els.bin.classList.remove('open', 'gulp');
  void els.bin.offsetWidth; // restart animation
  els.bin.classList.add('gulp');
  updateBinCount();
  burst();
  if (navigator.vibrate) navigator.vibrate(15);
}

function burst() {
  if (reduceMotion()) return;
  const b = els.bin.getBoundingClientRect();
  const cx = b.left + b.width / 2, cy = b.top + 8;
  const colors = ['var(--accent)', 'var(--today)', 'var(--later)', '#ffc93c'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = cx + 'px'; p.style.top = cy + 'px';
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const d = 40 + Math.random() * 60;
    p.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 30}px) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' }).finished.then(() => p.remove());
  }
}

// ---------- swipe ----------
function attachSwipe(card, id) {
  let x0 = null, y0 = 0, dx = 0, active = false;
  const labels = card.querySelectorAll('.swipe-label');
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, [contenteditable="true"]') || e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; active = false;
  });
  card.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    if (!active) {
      if (Math.abs(e.clientY - y0) > 12) { x0 = null; return; } // vertical scroll wins
      if (Math.abs(dx) < 8) return;
      active = true;
      card.setPointerCapture(e.pointerId);
      card.classList.add('dragging');
    }
    card.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
    const p = Math.min(1, Math.abs(dx) / 90);
    labels[0].style.opacity = dx > 0 ? p : 0;
    labels[1].style.opacity = dx < 0 ? p : 0;
  });
  const end = () => {
    if (x0 === null) return;
    x0 = null;
    card.classList.remove('dragging');
    if (!active) return;
    const item = state.items.find((i) => i.id === id);
    if (dx < -90) return kick(id);
    if (dx > 90 && item) return move(id, item.list === 'today' ? 'done' : 'today');
    card.animate([{ transform: card.style.transform }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    card.style.transform = '';
    labels.forEach((l) => (l.style.opacity = 0));
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

// ---------- rendering ----------
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

const EMPTY = {
  inbox: ['Inbox zero.', 'Your head is clear. Dump anything new above.'],
  today: ['Nothing for today.', 'Move a thought here from the Inbox — or enjoy the quiet.'],
  later: ['Nothing parked.', '“Later” is for things worth keeping but not worth doing now.'],
  done: ['Nothing done yet.', 'Tick things off in Today and they land here.'],
};

const BUTTONS = {
  inbox: [['today', 'Today'], ['later', 'Later'], ['kick', 'Kick']],
  today: [['later', 'Later'], ['kick', 'Kick']],
  later: [['today', 'Today'], ['kick', 'Kick']],
  done: [['kick', 'Kick']],
};

function cardHTML(item) {
  const btns = BUTTONS[item.list].map(([a, l]) => `<button class="act ${a}" data-act="${a}" title="${l}">${l}</button>`).join('');
  const check = item.list === 'today' || item.list === 'done'
    ? `<button class="check" data-act="${item.list === 'done' ? 'undone' : 'done'}" aria-label="${item.list === 'done' ? 'Mark not done' : 'Mark done'}">✓</button>` : '';
  const when = item.list === 'done' ? `done ${ago(item.doneAt || item.updated)}` : ago(item.created);
  const right = item.list === 'today' ? 'Done →' : 'Today →';
  return `<li class="card ${item.list === 'done' ? 'done-item' : ''}" data-id="${item.id}">
    <span class="swipe-label right">${right}</span><span class="swipe-label left">← Kick</span>
    ${check}
    <div class="text" title="Double-click to edit"><span></span><span class="age">${when}</span></div>
    <div class="actions">${btns}</div>
  </li>`;
}

function render() {
  const items = state.items.filter((i) => i.list === tab);
  if (tab === 'done') items.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  els.list.innerHTML = items.map(cardHTML).join('');
  els.list.querySelectorAll('.card').forEach((card, idx) => {
    card.querySelector('.text span').textContent = items[idx].text; // textContent = no HTML injection
    attachSwipe(card, items[idx].id);
  });
  const [title, sub] = EMPTY[tab];
  els.empty.hidden = items.length > 0;
  els.empty.innerHTML = `<b>${title}</b>${sub}`;

  for (const l of ['inbox', 'today', 'later', 'done']) {
    document.querySelector(`[data-count="${l}"]`).textContent = state.items.filter((i) => i.list === l).length;
  }
  renderStats();
  updateBinCount();
}

function renderStats() {
  const week = Date.now() - 7 * DAY;
  els.statBinned.textContent = state.log.binned.filter((t) => t > week).length;
  els.statDone.textContent = state.log.done.filter((t) => t > week).length;
  els.statStreak.textContent = streak();
}
function streak() {
  const days = new Set(state.activeDays);
  let n = 0, t = Date.now();
  if (!days.has(dayKey(t))) t -= DAY; // streak survives until you skip a whole day
  while (days.has(dayKey(t))) { n++; t -= DAY; }
  return n;
}
function updateBinCount() { els.binCount.textContent = state.binnedTotal; }

function setTab(next) {
  tab = next;
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  render();
}

// ---------- toast ----------
let toastTimer;
function showToast(msg, withUndo = false) {
  els.toastMsg.textContent = msg;
  els.undoBtn.hidden = !withUndo;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 3500);
}
function hideToast() { els.toast.hidden = true; }

// ---------- theme ----------
function applyTheme() {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  else delete document.documentElement.dataset.theme;
}
function toggleTheme() {
  const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = dark ? 'light' : 'dark';
  applyTheme(); save();
}

// ---------- events ----------
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  addThoughts([els.input.value]);
  els.input.value = '';
});
els.input.addEventListener('paste', (e) => {
  const text = e.clipboardData?.getData('text') || '';
  if (!/\n/.test(text.trim())) return;
  e.preventDefault();
  addThoughts(text.split(/\r?\n/));
});

els.list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.card').dataset.id;
  const act = btn.dataset.act;
  if (act === 'kick') kick(id);
  else if (act === 'undone') move(id, 'today');
  else move(id, act);
});

els.list.addEventListener('dblclick', (e) => {
  const text = e.target.closest('.text');
  if (!text) return;
  const span = text.querySelector('span');
  const id = text.closest('.card').dataset.id;
  span.contentEditable = 'true';
  span.focus();
  document.getSelection().selectAllChildren(span);
  const finish = () => { span.removeEventListener('blur', finish); editText(id, span.textContent); };
  span.addEventListener('blur', finish);
  span.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); span.blur(); }
    if (ev.key === 'Escape') { span.textContent = state.items.find((i) => i.id === id)?.text || ''; span.blur(); }
  });
});

document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
els.undoBtn.addEventListener('click', undo);
els.themeBtn.addEventListener('click', toggleTheme);
els.bin.addEventListener('click', () => {
  gulp();
  showToast(state.binnedTotal ? `${state.binnedTotal} thought${state.binnedTotal === 1 ? '' : 's'} kicked so far. Lighter already.` : 'Swipe a card left to kick it in here.');
});

els.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `kickthebin-${dayKey()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.items)) throw new Error('bad file');
    snapshot('import');
    state = { ...blank(), ...data, log: { ...blank().log, ...data.log } };
    save(); applyTheme(); render();
    showToast('Imported', true);
  } catch { showToast('That file isn’t a Kick the Bin export'); }
  els.importInput.value = '';
});
els.clearDoneBtn.addEventListener('click', () => {
  if (!state.items.some((i) => i.list === 'done')) return showToast('Nothing to clear');
  snapshot('clear');
  state.items = state.items.filter((i) => i.list !== 'done');
  save(); render();
  showToast('Cleared done items', true);
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/' || e.key === 'n') { e.preventDefault(); els.input.focus(); }
  else if (['1', '2', '3', '4'].includes(e.key)) setTab(['inbox', 'today', 'later', 'done'][e.key - 1]);
  else if (e.key === 'z' || e.key === 'Z') undo();
  else if (e.key === 't' || e.key === 'T') toggleTheme();
});

// refresh relative times every minute
setInterval(() => { if (!document.hidden && !els.list.querySelector('[contenteditable="true"]')) render(); }, 60000);

// ---------- boot ----------
applyTheme();
render();
if (!state.items.length && !state.binnedTotal) {
  // first run: seed a few examples so the app explains itself
  const examples = ['Reply to that email I keep putting off', 'Learn to juggle (someday)', 'Worry about something I can’t control'];
  const now = Date.now();
  state.items = examples.map((text, i) => ({ id: uid(), text, list: 'inbox', created: now - i * 60000, updated: now }));
  save(); render();
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
