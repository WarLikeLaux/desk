// @ts-check

import { state } from './state.js';
import { formatDate, formatTime } from './utils.js';
import { dateEl } from './dom.js';
import { renderTasks } from './tasks.js';
import { addTimer, renderTimers, tickOnBoot, startTick } from './timers.js';
import { setupEventListeners } from './events.js';
import { saveTasks } from './storage.js';
import { renderNotes, wireAddNoteButton } from './notes.js';
import { renderHabits, wireHabits, refreshHabitDay } from './habits.js';
import { wireTooltips } from './tooltips.js';

const renderDateLabel = () => {
  const now = new Date();
  dateEl.textContent = `${formatDate(now)} · ${formatTime(now, true)}`;
  refreshHabitDay();
};

const boot = () => {
  // Seed a default timer on first run so the workspace is never empty.
  if (state.timers.length === 0) addTimer();

  saveTasks();
  setupEventListeners();
  renderTasks();
  renderTimers();
  renderNotes();
  renderHabits();
  wireHabits();
  wireAddNoteButton();
  wireTooltips();
  tickOnBoot();
  startTick();
  renderDateLabel();

  // Tick the wall clock every second so the user always sees a live time.
  setInterval(renderDateLabel, 1000);
};

// `<script type="module">` is deferred by default — DOM is parsed before this runs.
boot();
