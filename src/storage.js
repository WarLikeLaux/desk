// @ts-check
/** @typedef {import('./types.js').Task} Task */
/** @typedef {import('./types.js').Timer} Timer */
/** @typedef {import('./types.js').Note} Note */

import { state } from './state.js';

const TASKS_KEY = 'todolist-minimal:v2';
const TIMERS_KEY = 'todolist-minimal:timers:v2';
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

/** @returns {Timer[]} */
export const loadTimers = () => {
  try {
    const raw = localStorage.getItem(TIMERS_KEY);
    if (!raw) {
      const old = localStorage.getItem('todolist-minimal:timers:v1');
      if (old) {
        const arr = JSON.parse(old);
        if (Array.isArray(arr)) {
          return arr.filter(isTimer).map((t) => ({ ...t, expired: !!t.expired }));
        }
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTimer).map((t) => ({ ...t, expired: !!t.expired }));
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
