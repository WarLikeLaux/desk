# desk

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

English | [Русский](README-ru.md)

desk keeps tasks, timers, and notes on one dark page. Everything persists in localStorage. There is no build step or account. The app's only external request loads Google Fonts.

The layout has three columns: timers, tasks, and notes with habits. On desktop, the workspace fits one screen and long lists scroll inside their columns. On phones the columns stack, with tasks first.

## Tasks

- **Enter** appends a task. **Ctrl/Cmd + Enter** and **Shift + Enter** prepend it.
- **Checkbox** completes a task and moves it to the bottom. The all-view shows the first three completed tasks, with a button to reveal the rest.
- **Double-click**, **⋯**, or the time estimate opens an editor for the task name, estimate, and attached links. Save applies changes, Esc cancels.
- **The clock button** opens an estimate field for minutes, hours, and ranges: `30 мин`, `1–2 ч`, `30 мин – 1 ч`. «Готово» or Enter applies the estimate.
- **The link button** opens a URL and optional name. «Прикрепить» or Enter attaches it to the draft. Add multiple links or remove any before creating the task. Links appear above the name. Pasting a URL over a fully selected name attaches it while preserving the name.
- **Когда** in the **⋯** editor selects «Сегодня» or «На потом». New tasks created in the deferred view are deferred immediately.
- **Drag** reorders tasks with a mouse.
- **×** requests deletion confirmation. Click again within three seconds to delete.
- **Очистить завершённые** removes completed tasks with an Undo toast.
- **Filters**: Все / Активные / Завершённые / На потом.

**Cmd/Ctrl + K** focuses the task input. Typing outside editors and dialogs also focuses it. **Esc** clears the input.

## Daily habits

A collapsible section below the notes in the right column holds daily habits. Enter a name and press Enter to add one. The habit day starts at 09:00 in Omsk (Asia/Omsk), regardless of the device timezone. Checkmarks remain through the night and reset at 09:00. Habit names and completion history remain saved. Habit counts are separate from task progress.

The pencil button renames a habit inline. Enter saves, Esc cancels. Deletion offers Undo. Habits, completion dates, and the section's expanded state persist across reloads.

## Timers

A default Pomodoro uses 52 minutes of work and a 17-minute break. Click "Новый таймер" for an 8-hour single-phase timer, or Shift + click for another Pomodoro. Timers are independent and start manually.

- **↺** resets the current phase to full duration.
- **Pause / start** controls the countdown.
- **Работа / перерыв** switches phases manually. At zero, the timer stops in an `expired` state and waits for the user's next action.
- **Click a single-phase timer's time** to set its full duration using `MM:SS` or `H:MM:SS`, from one second to 24 hours. Editing pauses the countdown. Enter saves the new duration for starting and resetting, Esc cancels.
- **Pomodoro durations** appear below the countdown and accept minutes or `H:MM`. Clicking the time while paused changes the current phase's remaining time.
- **Double-click** the name to rename. The expand button opens a full-screen view.
- **×** deletes a timer after a second click within three seconds.

When a phase ends, a beep, browser notification, and toast indicate completion. Notification permission is requested on the first timer start. The card and time change color. A Pomodoro toast offers the other phase.

Timers persist via timestamps. Reopening the page marks missed phases expired and notifies once for the first affected timer.

## Notes

The right column shows short previews. Click a preview or "Открыть" to open a full-screen editor. Edits save automatically, and closing the editor immediately saves pending changes. Copy is available in both the card and editor. URLs found in the text appear as links below the editor.

## Storage

Four localStorage keys, plain JSON:

- `todolist-minimal:v3`: tasks, estimates, links, and list membership
- `todolist-minimal:timers:v3`: timers
- `todolist-minimal:notes:v1`: notes
- `todolist-minimal:habits:v1`: habits, completion dates, and expanded state

Older task and timer versions migrate automatically. Clearing site data clears the workspace. Export, backups, and synchronization between devices are not implemented. Follow-up ideas are recorded in [IDEAS.md](IDEAS.md).

## Setup

Serve the static files through a local HTTP server. `npm ci` installs the development tools for code checks.

```bash
# Python
python3 -m http.server 8080 --directory "$HOME/code/desk"

```

## Development

The code checks require Node.js. The browser loads `src/` directly through native ES modules.

```bash
npm ci                # install dev tools (eslint, prettier, stylelint, typescript, impeccable)
npm run format        # auto-format JS, CSS, JSON, MD
npm run lint          # ESLint on src/
npm run lint:css      # Stylelint on *.css
npm run typecheck     # tsc --noEmit against JSDoc-annotated JS
npm run design        # Impeccable detector on index.html and style.css (WCAG, fonts, AI-slop)
npm run ci            # all of the above (what the CI workflow runs)
```

GitHub Actions runs `npm run ci` on every push to `main` and on pull requests.

## Customization

- **Durations**: click a single-phase timer's time, or "52 мин работа" and "17 мин перерыв" on a Pomodoro card.
- **Colors**: CSS variables at the top of `style.css`. `--accent` controls work, `--break` controls breaks, and `--danger` controls deletion.
- **Fonts**: Manrope and JetBrains Mono load through links in `index.html`. Remove the Google Fonts links to use local fallback fonts.
- **Layout**: the three-column grid lives in `.app`, with responsive rules near the end of `style.css`.

## Files

```
desk/
├── index.html                  # Three-column layout, no build step
├── style.css                   # All styling, all colors as CSS variables
├── src/                        # ES modules loaded directly by the browser
│   ├── main.js                 # Entry point, boots the workspace
│   ├── state.js                # Shared mutable state
│   ├── storage.js              # localStorage load/save
│   ├── dom.js                  # DOM element refs + helpers
│   ├── utils.js                # Date/pl, formatting helpers
│   ├── toast.js                # Toast UI
│   ├── audio.js                # Web Audio beep
│   ├── notifications.js        # Native notifications
│   ├── tasks.js                # Task CRUD, rendering, deferral
│   ├── task-editor.js          # Task name, estimate, and link editor
│   ├── habits.js               # Daily habits and completion dates
│   ├── notes.js                # Note previews and full-screen editor
│   ├── timers.js               # Timer CRUD, render, tick, edit
│   ├── dragdrop.js             # Task drag-and-drop
│   ├── events.js               # Global event wiring
│   └── types.js                # JSDoc typedefs for tasks, timers, notes, and habits
├── package.json                # Dev scripts and toolchain deps
├── eslint.config.js            # ESLint flat config
├── .prettierrc.json            # Prettier config
├── .stylelintrc.json           # Stylelint config
├── tsconfig.json               # TypeScript checker config (JSDoc)
└── .github/workflows/ci.yml    # GitHub Actions CI
```

## License

[MIT](LICENSE)
