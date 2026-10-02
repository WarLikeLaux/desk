// @ts-check
/** @typedef {import('./types.js').Task} Task */
/** @typedef {import('./types.js').Timer} Timer */
/** @typedef {import('./types.js').Note} Note */

import { state } from './state.js';

const TASKS_KEY = 'todolist-minimal:v2';
const TIMERS_KEY = 'todolist-minimal:timers:v3';
// Previous versions, kept so existing timers survive the upgrade.
const TIMERS_KEY_PREVIOUS = ['todolist-minimal:timers:v2', 'todolist-minimal:timers:v1'];
const NOTES_KEY = 'todolist-minimal:notes:v1';

const isTask =
  /** @param {any} t @returns {t is Task} */
  (t) => t && typeof t.id === 'string' && typeof t.text === 'string';

const isTimer =
  /** @param {any} t @returns {t is Timer} */
  (t) => t && typeof t.id === 'string' && typeof t.name === 'string';

const isNote =
  /** @param {any} n @returns {n is Note} */
  (n) => n && typeof n.id === 'string' && typeof n.body === 'string';

/** @returns {Task[]} */
export const loadTasks = () => {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) {
      const old = localStorage.getItem('todolist-minimal:v1');
      if (old) return JSON.parse(old).filter(isTask);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTask) : [];
  } catch {
    return [];
  }
};

export const saveTasks = () => {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(state.tasks));
  } catch {}
};

/**
 * Normalize a raw timer array from any storage version: timers written before
 * the `type` field existed are Pomodoros.
 * @param {any[]} arr @returns {Timer[]}
 */
const normalizeTimers = (arr) =>
  arr.filter(isTimer).map((t) => ({
    ...t,
    type: t.type === 'work' ? 'work' : 'pomodoro',
    expired: !!t.expired,
  }));

/** Read timers from the previous storage versions, or null if they are empty. @returns {Timer[] | null} */
const loadPreviousTimers = () => {
  for (const key of TIMERS_KEY_PREVIOUS) {
    const old = localStorage.getItem(key);
    if (!old) continue;
    const arr = JSON.parse(old);
    if (Array.isArray(arr) && arr.length > 0) return normalizeTimers(arr);
  }
  return null;
};

/**
 * The seeded timer a broken build wrote into v3 on first load, shadowing the
 * real data under the previous key: a single untouched 8-hour work timer.
 * @param {any[]} arr
 */
const isShadowingSeed = (arr) =>
  arr.length === 1 &&
  arr[0].type === 'work' &&
  arr[0].name === 'Таймер' &&
  arr[0].workDuration === 8 * 3600 &&
  arr[0].breakDuration === 17 * 60 &&
  arr[0].phase === 'work' &&
  arr[0].paused === false &&
  arr[0].pausedDuration === 0 &&
  !arr[0].expired;

/** @returns {Timer[]} */
export const loadTimers = () => {
  try {
    const raw = localStorage.getItem(TIMERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      if (isShadowingSeed(parsed)) {
        const recovered = loadPreviousTimers();
        if (recovered) return recovered;
      }
      return normalizeTimers(parsed);
    }
    return loadPreviousTimers() ?? [];
  } catch {
    return [];
  }
};

export const saveTimers = () => {
  try {
    localStorage.setItem(TIMERS_KEY, JSON.stringify(state.timers));
  } catch {}
};

/** @returns {Note[]} */
export const loadNotes = () => {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNote).map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
      updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
    }));
  } catch {
    return [];
  }
};

export const saveNotes = () => {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(state.notes));
  } catch {}
};
