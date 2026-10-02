// @ts-check

import { state } from './state.js';
import { formatDate, formatTime } from './utils.js';
import { dateEl } from './dom.js';
import { renderTasks } from './tasks.js';
import { addTimer, renderTimers, tickOnBoot, startTick } from './timers.js';
import { setupEventListeners } from './events.js';
import { ensureNotificationPermission } from './notifications.js';
import { renderNotes, wireAddNoteButton } from './notes.js';

const renderDateLabel = () => {
  const now = new Date();
  dateEl.textContent = `${formatDate(now)} · ${formatTime(now, true)}`;
};

const boot = () => {
  // Seed a default timer on first run so the workspace is never empty.
  if (state.timers.length === 0) addTimer();

  ensureNotificationPermission();
  setupEventListeners();
  renderTasks();
  renderTimers();
  renderNotes();
  wireAddNoteButton();
  tickOnBoot();
  startTick();
  renderDateLabel();

  // Tick the wall clock every second so the user always sees a live time.
  setInterval(renderDateLabel, 1000);
};

// `<script type="module">` is deferred by default — DOM is parsed before this runs.
boot();
