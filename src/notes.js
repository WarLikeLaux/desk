// @ts-check
/** @typedef {import('./types.js').Note} Note */

import { state } from './state.js';
import { saveNotes } from './storage.js';
import { generateId } from './utils.js';
import { notesListEl, notesCountEl, addNoteBtn } from './dom.js';

const SAVE_DEBOUNCE_MS = 250;
const PENDING_DELETE_TIMEOUT_MS = 3000;

/** @returns {Note} */
const createNote = () => ({
  id: generateId('n'),
  body: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

/** @param {number} ms */
const formatStamp = (ms) => {
  const d = new Date(ms);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isToday) return `сегодня ${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mo} ${hh}:${mm}`;
};

/**
 * @param {Note} note
 * @returns {HTMLElement}
 */
const buildNoteCard = (note) => {
  const card = document.createElement('div');
  card.className = 'note';
  card.dataset.id = note.id;
  if (state.lastAnimatedNoteIds?.has(note.id)) {
    card.classList.add('is-new');
    state.lastAnimatedNoteIds.delete(note.id);
  }

  const ta = document.createElement('textarea');
  ta.className = 'note-body';
  ta.value = note.body;
  ta.placeholder = 'Заметка...';
  ta.spellcheck = false;
  ta.rows = 3;
  ta.setAttribute('aria-label', 'Текст заметки');
  card.appendChild(ta);

  const meta = document.createElement('div');
  meta.className = 'note-meta';

  const stamp = document.createElement('span');
  stamp.className = 'note-stamp';
  stamp.textContent = formatStamp(note.updatedAt || note.createdAt);

  const del = document.createElement('button');
  del.className = 'note-delete';
  del.type = 'button';
  del.textContent = 'удалить';
  del.setAttribute('aria-label', 'Удалить заметку');

  meta.append(stamp, del);
  card.appendChild(meta);

  // Debounced save while typing.
  /** @type {ReturnType<typeof setTimeout> | null} */
  let saveTimer = null;
  ta.addEventListener('input', () => {
    note.body = ta.value;
    note.updatedAt = Date.now();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveNotes();
      saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
  });
  ta.addEventListener('blur', () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      saveNotes();
    }
  });

  del.addEventListener('click', () => {
    requestDeleteNote(note.id);
  });

  return card;
};

const renderEmpty = () => {
  notesListEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'note-empty';
  const t = document.createElement('p');
  t.className = 'note-empty-text';
  t.textContent = 'Нет заметок';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'note-empty-add';
  const glyph = document.createElement('span');
  glyph.className = 'note-empty-add-glyph';
  glyph.textContent = '+';
  const label = document.createElement('span');
  label.textContent = 'Новая заметка';
  add.append(glyph, label);
  add.addEventListener('click', addNote);
  wrap.append(t, add);
  notesListEl.appendChild(wrap);
};

export const renderNotes = () => {
  if (state.notes.length === 0) {
    renderEmpty();
  } else {
    notesListEl.innerHTML = '';
    // Newest first.
    const sorted = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);
    sorted.forEach((note) => notesListEl.appendChild(buildNoteCard(note)));
  }
  notesCountEl.textContent = String(state.notes.length);

  // Restore pending-delete state after a re-render.
  if (state.pendingNoteDeleteId) {
    const card = notesListEl.querySelector(`.note[data-id="${state.pendingNoteDeleteId}"]`);
    if (card instanceof HTMLElement) {
      card.classList.add('is-confirming');
      const btn = card.querySelector('.note-delete');
      if (btn) btn.textContent = '× удалить?';
    } else {
      state.pendingNoteDeleteId = null;
      if (state.pendingNoteDeleteTimer) clearTimeout(state.pendingNoteDeleteTimer);
    }
  }
};

export const addNote = () => {
  const note = createNote();
  state.notes.unshift(note);
  if (!state.lastAnimatedNoteIds) state.lastAnimatedNoteIds = new Set();
  state.lastAnimatedNoteIds.add(note.id);
  saveNotes();
  renderNotes();
  // Focus the textarea of the freshly created card.
  const card = notesListEl.querySelector(`.note[data-id="${note.id}"]`);
  const ta = card?.querySelector('.note-body');
  if (ta instanceof HTMLTextAreaElement) {
    ta.focus();
  }
};

/** @param {string} id */
const actuallyDeleteNote = (id) => {
  state.notes = state.notes.filter((n) => n.id !== id);
  state.pendingNoteDeleteId = null;
  if (state.pendingNoteDeleteTimer) clearTimeout(state.pendingNoteDeleteTimer);
  state.pendingNoteDeleteTimer = null;
  saveNotes();
  renderNotes();
};

/** @param {string} id */
export const requestDeleteNote = (id) => {
  if (state.pendingNoteDeleteId === id) {
    actuallyDeleteNote(id);
    return;
  }
  document.querySelectorAll('.note.is-confirming').forEach((el) => {
    el.classList.remove('is-confirming');
    const b = el.querySelector('.note-delete');
    if (b) b.textContent = 'удалить';
  });
  const card = notesListEl.querySelector(`.note[data-id="${id}"]`);
  if (!(card instanceof HTMLElement)) return;
  card.classList.add('is-confirming');
  const btn = card.querySelector('.note-delete');
  if (btn) btn.textContent = '× удалить?';
  state.pendingNoteDeleteId = id;
  if (state.pendingNoteDeleteTimer) clearTimeout(state.pendingNoteDeleteTimer);
  state.pendingNoteDeleteTimer = setTimeout(() => {
    cancelPendingNoteDelete();
  }, PENDING_DELETE_TIMEOUT_MS);
};

export const cancelPendingNoteDelete = () => {
  if (!state.pendingNoteDeleteId) return;
  const card = notesListEl.querySelector(`.note[data-id="${state.pendingNoteDeleteId}"]`);
  if (card instanceof HTMLElement) {
    card.classList.remove('is-confirming');
    const btn = card.querySelector('.note-delete');
    if (btn) btn.textContent = 'удалить';
  }
  state.pendingNoteDeleteId = null;
  if (state.pendingNoteDeleteTimer) clearTimeout(state.pendingNoteDeleteTimer);
  state.pendingNoteDeleteTimer = null;
};

/** Wire the "+" button to add a note. */
export const wireAddNoteButton = () => {
  addNoteBtn.addEventListener('click', addNote);
};
