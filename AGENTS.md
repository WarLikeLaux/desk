# Maintaining desk

- Static site. No build step, no bundler, no framework. `index.html` loads `style.css` and `src/main.js` directly via native ES modules.
- User-facing text is Russian. Code identifiers, comments, and commit messages are English.
- All colors are CSS variables at the top of `style.css` (`--accent`, `--break`, `--danger`, etc.). Add a new one there before referencing it.
- Treat the interface as one product. When improving a shared pattern, inspect every place it appears and apply the same behavior and visual rules to all equivalent controls across tasks, habits, timers, notes, and dialogs. Reuse shared helpers, components, and CSS instead of copying markup or adding local overrides. Differences should follow real context constraints, such as density or viewport size, rather than accidental drift. Verify affected siblings on desktop, touch, and keyboard before finishing.
- All timers and tasks persist in `localStorage`. Keys live in `src/storage.js` (`TASKS_KEY`, `TIMERS_KEY`). Bump the version suffix when changing the data shape and add a migration branch in `loadTimers` / `loadTasks`.
- Types live in `src/types.js` as JSDoc typedefs. Keep them in sync with the data model. The repo runs `tsc --noEmit` to typecheck JSDoc-annotated files; don't add `// @ts-nocheck` to silence errors.
- Layout is a three-column grid in `.app` (CSS). The right column holds notes (`<aside class="notes">`); adding new sections there is allowed, but never replace the notes panel without an explicit request.
- The default timer is 52 min / 17 min Pomodoro. The user wants manual control, not auto-transition. When a phase ends, the timer stops in an `expired` state and waits for the user to click the other phase in the work/break toggle.
- Notification permission is requested lazily on first timer use. Don't request it on every page load.
- Do not add network calls beyond the Google Fonts link in `index.html`. Removing the `<link>` is an acceptable customization; replacing it with a different remote service is not.
- Storage keys live in `src/storage.js` (`TASKS_KEY`, `TIMERS_KEY`, `NOTES_KEY`). Bump the version suffix when changing the data shape and add a migration branch in `loadTasks` / `loadTimers` / `loadNotes`.
- CI runs `npm run ci` (format check, ESLint, Stylelint, TypeScript, Impeccable design detector) on every push. Run it locally before committing: `npm run format && npm run lint && npm run lint:css && npm run typecheck && npm run design`. Impeccable enforces WCAG contrast, distinctive-font, and the no-AI-slop rules on `index.html` and `style.css`.
