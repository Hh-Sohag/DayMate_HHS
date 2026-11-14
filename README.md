# DayMate 🤝

A 24-hour daily planner built with **plain HTML, CSS and JavaScript** (no frameworks). A live animated landscape follows the time of day, a different character appears every hour, and your routine, calendar, alarms and progress live beside it.

## Features
- **Live 24-hour scene** drawn on a canvas: sunrise to night, aurora, weather (rain, snow, storm), 24 hourly characters and stories, soft generated music (Web Audio)
- **Bangladesh time (UTC+6)** in Live mode, whatever the device timezone is
- **Routine planner**: 24 hourly tasks in 8 sections, inline edit, three-dot menus, tick-off progress
- **Calendar**: a separate plan for any date, copy a plan to the next day
- **Alarms** with sound, pop-up, snooze and notifications (while the page is open)
- **Progress and streaks** dashboard with a 7-day chart
- **Backup**: export and import all your data as JSON
- **Light and dark theme**, glass UI, reduced-motion support
- **Keyboard shortcuts** (press `?`), **Zen mode** (`H`)
- **PWA**: installable and works offline when served over HTTPS

## Run it
Double-click `index.html`. Offline/install features need a web server (see below).

## Deploy for free (GitHub Pages)
1. Create a GitHub repository and upload these files.
2. Settings > Pages > Deploy from branch > `main` / root.
3. Open the link GitHub gives you. In Chrome or Edge you can now *Install* the app.

## Files
| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Glass UI, themes, layout |
| `script.js` | Scene, music, routine, calendar, alarms, stats |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA install and offline support |

## Customize
- Hourly characters: the `CAST` list in `script.js`
- Hourly music moods: the `MOOD` list
- Default routine: the `DEF` list

## Good to know
- Alarms only ring while the page is open in a browser tab (a website cannot wake a closed phone).
- Data is stored in the browser (`localStorage`); use Export to keep a backup.

Crafted with ❤️ by HH"S
