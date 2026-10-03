# desk

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

English | [Русский](README-ru.md)

desk keeps tasks, timers, and notes on one dark page. Everything persists in localStorage. There is no build step or account. The app's only external request loads Google Fonts.

The layout has three columns: timers, tasks, and notes with habits. On desktop, the workspace fits one screen and long lists scroll inside their columns. On phones the columns stack, with tasks first.

## Tasks

- **Enter** appends a task. **Ctrl/Cmd + Enter** and **Shift + Enter** prepend it.
- **Checkbox** completes a task and moves it to the bottom. The all-view shows the first three completed tasks, with a button to reveal the rest.
- **Double-click**, **⋯**, or the time estimate opens an editor for the task name, estimate, and attached links. Save applies changes, Esc cancels.
- **The clock button** opens an estimate field to its left for minutes, hours, and ranges: `30 мин`, `1–2 ч`, `30 мин – 1 ч`. Enter returns focus to the task name, and adding the task saves its estimate.
- Task estimates and timer durations display full Russian unit names: `1 - 2 часа`, `30 - 45 минут`, `1 час 30 минут`. Abbreviations remain accepted when entering estimates.
- Estimates also accept `30`, `30 минут`, `30м`, `1 час`, `1,5ч`, `1ч 30м`, `1:30`, and `1h 30m`. Remaining time for unfinished tasks appears to the right of the heading. Range endpoints are summed separately, and unestimated active tasks have their own count. Completed tasks do not contribute. Active and completed filters keep the day's remaining time, while the deferred view has a separate total.
- **The link button** opens a URL and optional name. «Прикрепить» or Enter attaches it to the draft. Add multiple links or remove any before creating the task. Links appear above the name. Pasting a URL over a fully selected name attaches it while preserving the name.
- **На потом / На сегодня** in the **⋯** editor changes the destination without closing the dialog. **Save** applies all edits and the destination together. **Cancel** or **Esc** discards them. New tasks created in the deferred view are deferred immediately.
- **Drag** reorders tasks with a mouse.
- **×** requests deletion confirmation. Click again within three seconds to delete.
- **Очистить завершённые** removes completed tasks with an Undo toast.
- **Filters**: Все / Активные / Завершённые / На потом.

**Cmd/Ctrl + K** focuses the task input. Typing outside editors and dialogs also focuses it. **Esc** clears the input.

## Daily habits

A collapsible section above the notes in the right column holds daily habits. Enter a name and press Enter to add one. The habit day starts at 09:00 in Omsk (Asia/Omsk), regardless of the device timezone. Checkmarks remain through the night and reset at 09:00. Habit names and completion history remain saved. Habit counts are separate from task progress.

The pencil button renames a habit inline. Enter saves, Esc cancels. Deletion requires a second click and offers Undo afterward. Habits, completion dates, and the section's expanded state persist across reloads.

Drag a habit's dotted handle with a mouse or touch to reorder it. With the handle focused, the up and down arrows move the habit. The order persists across reloads without changing completion dates. The handle and reorder behavior are shared with timers and notes.

## Timers

A default Pomodoro uses 52 minutes of work and a 17-minute break. Click "Новый таймер" for an 8-hour single-phase timer, or Shift + click for another Pomodoro. Timers are independent and start manually.

- **↺** resets the current phase to full duration.
- **Pause / start** controls the countdown.
- **The dotted handle** reorders timers with a mouse or touch. Up and down arrows move a focused handle. The order persists across reloads, and running timers keep counting down.
- **Перейти к перерыву / Вернуться к работе** switches phases manually. The new phase waits for you to start it. At zero, the timer stops in an `expired` state and waits for the user's next action.
- **Click a single-phase timer's time** to set its full duration using `MM:SS` or `H:MM:SS`, from one second to 24 hours. Editing pauses the countdown. Enter saves the new duration for starting and resetting, Esc cancels.
- **Pomodoro durations** appear below the countdown and accept minutes or `H:MM`. Clicking the time while paused changes the current phase's remaining time.
- **Double-click** the name to rename. The expand button opens a full-screen view.
- **×** deletes a timer after a second click within three seconds.

When a phase ends, a beep, browser notification, and toast indicate completion. Notification permission is requested on the first timer start. The card and time change color. A Pomodoro toast offers the other phase.

Timers persist via timestamps. Reopening the page marks missed phases expired and notifies once for the first affected timer.

## Notes

The right column shows short previews. Click a preview or the expand icon to open a full-screen editor. Edits save automatically, and closing the editor immediately saves pending changes. Copy is available in both the card and editor. URLs found in the text appear as links below the editor. Drag a note's dotted handle to reorder it with a mouse or touch. With the handle focused, use the up and down arrows to move the note. The order persists across reloads and edits. Deletion requires a second click on the same button, which keeps its size during confirmation.

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
│   ├── reorder.js              # Pointer and keyboard reordering of notes and timers
│   ├── delete-button.js        # Shared deletion icons and confirmation states
│   ├── tooltips.js             # Shared tooltips above scroll containers
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
