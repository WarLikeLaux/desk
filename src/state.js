// @ts-check
/** @typedef {import('./types.js').Task} Task */
/** @typedef {import('./types.js').Timer} Timer */
/** @typedef {import('./types.js').TaskFilter} TaskFilter */

import { loadTasks, loadTimers } from './storage.js';

/**
 * Shared mutable state. Modules import this object and mutate it directly.
 * Tests can reset it by reassigning each property.
 *
 * @type {{
 *   tasks: Task[],
 *   timers: Timer[],
 *   filter: TaskFilter,
 *   pendingDeleteId: string | null,
 *   pendingDeleteTimer: ReturnType<typeof setTimeout> | null,
 *   pendingTimerDeleteId: string | null,
 *   pendingTimerDeleteTimerId: ReturnType<typeof setTimeout> | null,
 *   toastTimer: ReturnType<typeof setTimeout> | null,
 *   tickIntervalId: ReturnType<typeof setInterval> | null,
 *   audioCtx: AudioContext | null,
 *   lastAnimatedIds: Set<string>,
 *   dragId: string | null,
 * }}
 */
export const state = {
  tasks: loadTasks(),
  timers: loadTimers(),
  filter: 'all',
  pendingDeleteId: null,
  pendingDeleteTimer: null,
  pendingTimerDeleteId: null,
  pendingTimerDeleteTimerId: null,
  toastTimer: null,
  tickIntervalId: null,
  audioCtx: null,
  lastAnimatedIds: new Set(),
  dragId: null,
};
