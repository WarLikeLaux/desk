# desk

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

English | [Русский](README-ru.md)

desk is a personal desktop workspace: a todolist and a stack of Pomodoro timers in one quiet, dark-themed page. Tasks and timers persist in localStorage. No build step, no telemetry, no network calls. Open the page, type, work.

The layout is a three-column grid: timers on the left, tasks in the center, an empty slot on the right reserved for whatever comes next.

## Tasks

A minimal list with the operations that matter and nothing else.

- **Enter** adds a task to the bottom of the active section. Typing anywhere on the page focuses the input — no clicks needed.
- **Click** the checkbox to complete. Completed tasks move to the bottom and get a strikethrough.
- **Double-click** a task to rename. Enter saves, Esc cancels.
- **Drag** the handle (visible on hover) to reorder.
- **Hover** to see the position badge and the × delete button. Click × once for "Удалить?", twice within three seconds to confirm.
- **"Очистить завершённые"** in the footer removes every completed task with an Undo toast.
- **Filters**: Все / Активные / Завершённые — click a tab to switch; counters stay accurate.

**Cmd/Ctrl + K** focuses the task input from anywhere. **Esc** clears the input.

## Timers

A Pomodoro is one work phase followed by one break phase. desk ships with one default timer (52 min / 17 min) and lets you add as many more as you need. Each timer runs independently.

- **↺** resets the current phase to full duration.
- **⏸** pauses; **▶** resumes.
- **"→ перерыв" / "→ работа"** switches phase manually. The timer does **not** auto-transition — when the countdown hits zero, it stops in an `expired` state and asks you what to do.
- **Click "52 мин работа" / "17 мин перерыв"** to change either duration (1–240 minutes).
- **Double-click** the timer name to rename.
- **Click ×** once for "удалить?", twice within three seconds to confirm.

When a phase ends, three notifications fire so the change is hard to miss: a beep (Web Audio, distinct ascending tone for work end, descending for break end), a native browser notification (permission requested on first use), and an in-app toast with the phase-switch button pre-attached. The card border turns accent, the time text turns accent, the phase label pulses, and "→ перерыв" / "→ работа" becomes the obvious next click.

Timers persist via timestamps. Closing the tab and reopening an hour later catches the missed phase and fires the notification once for the most relevant timer.

## Storage

Two localStorage keys, plain JSON:

- `todolist-minimal:v2` — tasks
- `todolist-minimal:timers:v2` — timers

Clearing site data clears the workspace. There is no export, no backup, no sync.

## Setup

The project is a small set of static files plus a Node dev toolchain for linting and type checking. Open it locally with any static HTTP server; run `npm ci` once to install the dev dependencies if you want to run the checks.

```bash
# Python
python3 -m http.server 8080 --directory "$HOME/code/desk"

# Or just open the file
xdg-open "$HOME/code/desk/index.html"
```

## Development

Requires Node.js ≥ 20 for the lint and typecheck toolchain. The site itself has no build step and no runtime dependencies — `src/` is loaded directly by the browser via native ES modules.

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

- **Durations**: click "52 мин работа" or "17 мин перерыв" on any timer card.
- **Colors**: every color is a CSS variable at the top of `style.css` (`:root { ... }`). `--accent` is the work color, `--break` is the break color, `--danger` is delete.
- **Fonts**: `style.css` loads Inter and JetBrains Mono from Google Fonts. Remove the `<link>` in `index.html` to drop the network call entirely.
- **Layout**: the three-column grid lives in `.app` in `style.css`. Change `grid-template-columns` to widen a column or hide one.

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
│   ├── tasks.js                # Task CRUD, render, inline edit
│   ├── timers.js               # Timer CRUD, render, tick, edit
│   ├── dragdrop.js             # Task drag-and-drop
│   ├── events.js               # Global event wiring
│   └── types.js                # JSDoc typedefs for Task / Timer
├── package.json                # Dev scripts and toolchain deps
├── eslint.config.js            # ESLint flat config
├── .prettierrc.json            # Prettier config
├── .stylelintrc.json           # Stylelint config
├── tsconfig.json               # TypeScript checker config (JSDoc)
└── .github/workflows/ci.yml    # GitHub Actions CI
```

## License

[MIT](LICENSE)
