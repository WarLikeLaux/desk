// @ts-check
/** @typedef {import('./types.js').Task} Task */
/** @typedef {import('./types.js').Timer} Timer */
/** @typedef {import('./types.js').Note} Note */
/** @typedef {import('./types.js').HabitsData} HabitsData */

import { state } from './state.js';
import { normalizeURL } from './utils.js';

const TASKS_KEY = 'todolist-minimal:v3';
const TASKS_KEY_PREVIOUS = ['todolist-minimal:v2', 'todolist-minimal:v1'];
const TIMERS_KEY = 'todolist-minimal:timers:v3';
// Previous versions, kept so existing timers survive the upgrade.
const TIMERS_KEY_PREVIOUS = ['todolist-minimal:timers:v2', 'todolist-minimal:timers:v1'];
const NOTES_KEY = 'todolist-minimal:notes:v1';
export const HABITS_KEY = 'todolist-minimal:habits:v1';

const isTask =
  /** @param {any} t @returns {t is Task} */
  (t) => t && typeof t.id === 'string' && typeof t.text === 'string';

const isTimer =
  /** @param {any} t @returns {t is Timer} */
  (t) => t && typeof t.id === 'string' && typeof t.name === 'string';

const isNote =
  /** @param {any} n @returns {n is Note} */
  (n) => n && typeof n.id === 'string' && typeof n.body === 'string';

/** @param {any[]} items @returns {Task[]} */
const normalizeTasks = (items) =>
  items.filter(isTask).map((task) => ({
    id: task.id,
    text: task.text,
    completed: !!task.completed,
    createdAt: Number.isFinite(task.createdAt) ? task.createdAt : Date.now(),
    ...(Number.isFinite(task.completedAt) ? { completedAt: task.completedAt } : {}),
    bucket: task.bucket === 'later' && !task.completed ? 'later' : 'today',
    estimate:
      task.estimate &&
      Number.isFinite(task.estimate.min) &&
      Number.isFinite(task.estimate.max) &&
      task.estimate.min > 0 &&
      task.estimate.max >= task.estimate.min
        ? task.estimate
        : null,
    links: Array.isArray(task.links)
      ? task.links.filter(
          /** @param {any} link */
          (link) =>
            link &&
            typeof link.label === 'string' &&
            typeof link.url === 'string' &&
            normalizeURL(link.url),
        )
      : [],
  }));

/** @returns {Task[]} */
export const loadTasks = () => {
  for (const key of [TASKS_KEY, ...TASKS_KEY_PREVIOUS]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeTasks(parsed);
    } catch {}
  }
  return [];
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

/** @returns {HabitsData} */
export const loadHabits = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(HABITS_KEY) ?? 'null');
    if (parsed && Array.isArray(parsed.items)) {
      const ids = new Set();
      return {
        expanded: parsed.expanded !== false,
        items: parsed.items
          .filter(
            /** @param {any} item */
            (item) => {
              if (
                !item ||
                typeof item.id !== 'string' ||
                ids.has(item.id) ||
                typeof item.text !== 'string' ||
                !item.text.trim()
              )
                return false;
              ids.add(item.id);
              return true;
            },
          )
          .map(
            /** @param {any} item */
            (item) => ({
              id: item.id,
              text: item.text.trim(),
              createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
              completedDates: Array.isArray(item.completedDates)
                ? [
                    ...new Set(
                      item.completedDates.filter(
                        /** @param {any} date */
                        (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date),
                      ),
                    ),
                  ]
                : [],
            }),
          ),
      };
    }
  } catch {}
  return { items: [], expanded: true };
};

export const saveHabits = () => {
  try {
    localStorage.setItem(HABITS_KEY, JSON.stringify(state.habits));
  } catch {}
};
