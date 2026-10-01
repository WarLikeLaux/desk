# Maintaining desk

- Static site. No build step, no bundler, no framework. `index.html` loads `style.css` and `script.js` directly.
- User-facing text is Russian. Code identifiers, comments, and commit messages are English.
- All colors are CSS variables at the top of `style.css` (`--accent`, `--break`, `--danger`, etc.). Add a new one there before referencing it.
- All timers and tasks persist in `localStorage`. Keys live in `script.js` (`TASKS_KEY`, `TIMERS_KEY`). Bump the version suffix when changing the data shape and add a migration branch in `loadTimers` / `loadTasks`.
- Layout is a three-column grid in `.app` (CSS). Right column is intentionally empty — do not fill it without an explicit request.
- The default timer is 52 min / 17 min Pomodoro. The user wants manual control, not auto-transition. When a phase ends, the timer stops in an `expired` state and waits for the user to click `→ перерыв` or `→ работа`.
- Notification permission is requested lazily on first timer use. Don't request it on every page load.
- Do not add network calls beyond the Google Fonts link in `index.html`. Removing the `<link>` is an acceptable customization; replacing it with a different remote service is not.
- The `setup-desk.sh` script handles nginx + cert + `/etc/hosts` for the `desk.local` domain. It is run manually by the user, not by an agent.