# Kick the Bin 🗑️

Your head is full. Empty it here.

**Kick the Bin** is a small, fast brain-dump app. Write down everything that's on your mind, then sort each thought:

- **Today**: you're doing it today
- **Later**: worth keeping, but not now
- **Kick**: it goes in the bin, with a satisfying animation, and it's gone for good

It's built for clearing your head, not managing projects. It's a good way to start the day or wind down at night.

## Features

- **Fast capture.** Type and press Enter. Paste a list and every line becomes its own card.
- **Swipe gestures.** Swipe right to send a card to Today (or mark it done), and swipe left to kick it.
- **Undo for everything.** Use the Undo button in the toast, or press `Z`.
- **Stats.** Shows how many thoughts you've kicked and finished this week, plus your daily streak.
- **Works offline and installs like an app.** It's a PWA, so you can add it to your phone's home screen.
- **Private.** Everything stays in your browser's localStorage. There's no account and no server.
- **Export and import** your data as JSON.
- **Light and dark themes**, keyboard shortcuts, and reduced-motion support.

| Key | Action |
| --- | --- |
| `/` or `N` | Focus the input |
| `1`–`4` | Switch tab |
| `Z` | Undo |
| `T` | Toggle theme |
| Double-click | Edit a thought |

## Run it

There's no build step and there are no dependencies. You can open `index.html` directly. To get the offline features, serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

On GitHub, go to **Settings → Pages**, pick the branch, and choose `/ (root)`. That's it.

## Files

```
index.html            markup
styles.css            styling and themes
app.js                all app logic (state, rendering, gestures, animations)
sw.js                 service worker for offline support
manifest.webmanifest  PWA metadata
icon.svg              app icon
```
