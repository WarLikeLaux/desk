// @ts-check
/** @typedef {import('./types.js').Task} Task */
/** @typedef {import('./types.js').Timer} Timer */
/** @typedef {import('./types.js').Note} Note */
/** @typedef {import('./types.js').TaskFilter} TaskFilter */
/** @typedef {import('./types.js').TaskCategoryFilter} TaskCategoryFilter */
/** @typedef {import('./types.js').HabitsData} HabitsData */

import { loadTasks, loadTimers, loadNotes, loadHabits } from './storage.js';

/**
 * Shared mutable state. Modules import this object and mutate it directly.
 * Tests can reset it by reassigning each property.
 *
 * @type {{
 *   tasks: Task[],
 *   timers: Timer[],
 *   notes: Note[],
 *   habits: HabitsData,
 *   filter: TaskFilter,
 *   categoryFilter: TaskCategoryFilter,
 *   draftTaskCategory: Task['category'] | undefined,
 *   selectedTaskIds: Set<string>,
 *   pendingDeleteId: string | null,
 *   pendingDeleteTimer: ReturnType<typeof setTimeout> | null,
 *   pendingTimerDeleteId: string | null,
 *   pendingTimerDeleteTimerId: ReturnType<typeof setTimeout> | null,
 *   pendingNoteDeleteId: string | null,
 *   pendingNoteDeleteTimer: ReturnType<typeof setTimeout> | null,
 *   toastTimer: ReturnType<typeof setTimeout> | null,
 *   tickIntervalId: ReturnType<typeof setInterval> | null,
 *   audioCtx: AudioContext | null,
 *   lastAnimatedIds: Set<string>,
 *   lastAnimatedNoteIds: Set<string>,
 *   showAllCompleted: boolean,
 *   focusedTimerId: string | null,
 *   dragId: string | null,
 * }}
 */
export const state = {
  tasks: loadTasks(),
  timers: loadTimers(),
  notes: loadNotes(),
  habits: loadHabits(),
  filter: 'all',
  categoryFilter: 'all',
  draftTaskCategory: undefined,
  selectedTaskIds: new Set(),
  pendingDeleteId: null,
  pendingDeleteTimer: null,
  pendingTimerDeleteId: null,
  pendingTimerDeleteTimerId: null,
  pendingNoteDeleteId: null,
  pendingNoteDeleteTimer: null,
  toastTimer: null,
  tickIntervalId: null,
  audioCtx: null,
  lastAnimatedIds: new Set(),
  lastAnimatedNoteIds: new Set(),
  showAllCompleted: false,
  focusedTimerId: null,
  dragId: null,
};
