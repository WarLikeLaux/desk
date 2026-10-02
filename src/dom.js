// @ts-check

/** Query an HTMLElement by selector (typed). */
/** @param {string} sel */
export const $ = (sel) => /** @type {HTMLElement | null} */ (document.querySelector(sel));

/** Query an HTMLElement inside a parent. */
/** @param {string} sel @param {ParentNode} parent */
export const qs = (sel, parent) => /** @type {HTMLElement | null} */ (parent.querySelector(sel));

export const taskList = /** @type {HTMLElement} */ ($('#taskList'));
export const taskInput = /** @type {HTMLInputElement} */ ($('#taskInput'));
export const composer = /** @type {HTMLFormElement} */ ($('#composer'));
export const emptyState = /** @type {HTMLElement} */ ($('#emptyState'));
export const remaining = /** @type {HTMLElement} */ ($('#remaining'));
export const clearBtn = /** @type {HTMLButtonElement} */ ($('#clearCompleted'));
export const clearCount = /** @type {HTMLElement} */ ($('#clearCount'));
export const dateEl = /** @type {HTMLElement} */ ($('#date'));
export const subtitleEl = /** @type {HTMLElement} */ ($('#subtitle'));
export const progressDone = /** @type {HTMLElement} */ ($('#progressDone'));
export const progressTotal = /** @type {HTMLElement} */ ($('#progressTotal'));
export const filtersEl = /** @type {HTMLElement} */ ($('#filters'));
export const toastEl = /** @type {HTMLElement} */ ($('#toast'));
export const toastText = /** @type {HTMLElement} */ ($('#toastText'));
export const toastAction = /** @type {HTMLButtonElement} */ ($('#toastAction'));
export const timersListEl = /** @type {HTMLElement} */ ($('#timersList'));
export const timersCountEl = /** @type {HTMLElement} */ ($('#timersCount'));
export const addTimerBtn = /** @type {HTMLButtonElement} */ ($('#addTimer'));
export const emptyTitle = /** @type {HTMLElement} */ ($('#emptyTitle'));
export const emptyHint = /** @type {HTMLElement} */ ($('#emptyHint'));
export const notesListEl = /** @type {HTMLElement} */ ($('#notesList'));
export const notesCountEl = /** @type {HTMLElement} */ ($('#notesCount'));
export const addNoteBtn = /** @type {HTMLButtonElement} */ ($('#addNote'));
