// @ts-check
/** @typedef {import('./types.js').Note} Note */

import { state } from './state.js';
import { saveNotes } from './storage.js';
import { generateId, copyText, normalizeURL } from './utils.js';
import { showToast } from './toast.js';
import { notesListEl, notesCountEl, addNoteBtn, noteFocusOverlay } from './dom.js';
import { createReorderHandle, wireReorder } from './reorder.js';
import { initDeleteButton, setDeleteButtonState } from './delete-button.js';

const SAVE_DEBOUNCE_MS = 250;
const PENDING_DELETE_TIMEOUT_MS = 3000;
const NOTE_URL_RE = /\b((?:https?:\/\/)?(?:[\w-]+\.[\w-]{2,})[^\s<]*)/gi;
let saveTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
let returnFocusId = /** @type {string | null} */ (null);

const flushNotes = () => {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  saveNotes();
};

/** @param {HTMLElement} container @param {string} text */
const fillLinks = (container, text) => {
  container.replaceChildren();
  const urls = new Set(
    [...text.matchAll(NOTE_URL_RE)]
      .map((match) => normalizeURL(match[1]))
      .filter((url) => url !== null),
  );
  container.hidden = urls.size === 0;
  for (const url of urls) {
    const a = document.createElement('a');
    a.href = url;
    a.textContent = new URL(url).hostname;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'task-link';
    container.append(a);
  }
};

/** @param {number} ms */
const formatStamp = (ms) => {
  const date = new Date(ms);
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? `сегодня ${time}`
    : `${date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${time}`;
};

/** @param {Note} note @param {HTMLButtonElement} button */
const copyNote = async (note, button) => {
  const ok = await copyText(note.body);
  if (button.classList.contains('note-focus-copy')) {
    button.textContent = ok ? 'Скопировано' : 'Не скопировано';
    setTimeout(() => {
      button.textContent = 'Копировать';
    }, 2000);
  }
  if (!noteFocusOverlay.open)
    showToast(ok ? 'Заметка скопирована' : 'Не удалось скопировать заметку', null, 'Закрыть');
};

/** @param {HTMLButtonElement} button @param {string} label @param {string} icon */
const setNoteAction = (button, label, icon) => {
  button.setAttribute('aria-label', label);
  button.dataset.tooltip = label;
  button.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
};

/** @param {string} id @param {boolean} confirming */
const setDeleteConfirmation = (id, confirming) => {
  const card = notesListEl.querySelector(`.note[data-id="${id}"]`);
  card?.classList.toggle('is-confirming', confirming);
  setDeleteButtonState(card?.querySelector('.note-delete') ?? null, confirming);
};

/** @param {Note} note @returns {HTMLElement} */
const buildNoteCard = (note) => {
  const card = document.createElement('div');
  card.className = 'note';
  card.dataset.id = note.id;
  const preview = document.createElement('button');
  preview.type = 'button';
  preview.className = 'note-preview';
  preview.textContent = note.body || 'Пустая заметка';
  preview.setAttribute('aria-label', `Открыть заметку: ${note.body.slice(0, 80) || 'пустая'}`);
  preview.addEventListener('click', () => enterNoteFocus(note.id));
  card.append(preview);

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  const stamp = document.createElement('span');
  stamp.className = 'note-stamp';
  stamp.textContent = formatStamp(note.updatedAt);
  const actions = document.createElement('div');
  actions.className = 'note-actions';
  const move = createReorderHandle(
    'note-action note-move',
    'Переместить заметку',
    state.notes.length < 2,
  );
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'note-action note-open';
  setNoteAction(open, 'Открыть заметку', '<path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4"/>');
  open.addEventListener('click', () => enterNoteFocus(note.id));
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'note-action note-copy';
  setNoteAction(
    copy,
    'Копировать заметку',
    '<rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M10 6V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3"/>',
  );
  copy.disabled = !note.body;
  copy.addEventListener('click', () => void copyNote(note, copy));
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'note-action note-delete';
  initDeleteButton(del, 'Удалить заметку');
  del.addEventListener('click', () => requestDeleteNote(note.id));
  actions.append(move, open, copy, del);
  meta.append(stamp, actions);
  card.append(meta);
  return card;
};

export const renderNotes = () => {
  notesListEl.replaceChildren();
  state.notes.forEach((note) => notesListEl.append(buildNoteCard(note)));
  notesCountEl.textContent = String(state.notes.length);
  if (state.pendingNoteDeleteId) setDeleteConfirmation(state.pendingNoteDeleteId, true);
};

export const addNote = () => {
  const now = Date.now();
  const note = { id: generateId('n'), body: '', createdAt: now, updatedAt: now };
  state.notes.unshift(note);
  saveNotes();
  renderNotes();
  enterNoteFocus(note.id);
};

/** @param {string} id */
export const requestDeleteNote = (id) => {
  if (state.pendingNoteDeleteId === id) {
    const index = state.notes.findIndex((note) => note.id === id);
    cancelPendingNoteDelete();
    state.notes = state.notes.filter((note) => note.id !== id);
    saveNotes();
    renderNotes();
    const next = state.notes[Math.min(index, state.notes.length - 1)];
    const button = notesListEl.querySelector(`.note[data-id="${next?.id}"] .note-preview`);
    if (button instanceof HTMLButtonElement) button.focus();
    else addNoteBtn.focus();
    return;
  }
  cancelPendingNoteDelete();
  state.pendingNoteDeleteId = id;
  state.pendingNoteDeleteTimer = setTimeout(cancelPendingNoteDelete, PENDING_DELETE_TIMEOUT_MS);
  setDeleteConfirmation(id, true);
};

export const cancelPendingNoteDelete = () => {
  if (state.pendingNoteDeleteTimer) clearTimeout(state.pendingNoteDeleteTimer);
  state.pendingNoteDeleteTimer = null;
  if (state.pendingNoteDeleteId) setDeleteConfirmation(state.pendingNoteDeleteId, false);
  state.pendingNoteDeleteId = null;
};

export const wireAddNoteButton = () => {
  addNoteBtn.addEventListener('click', addNote);
  wireReorder({
    list: notesListEl,
    cardSelector: '.note',
    handleSelector: '.note-move',
    items: () => state.notes,
    save: saveNotes,
    render: renderNotes,
  });
};

/** @param {string} id */
const enterNoteFocus = (id) => {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return;
  returnFocusId = id;
  noteFocusOverlay.replaceChildren();
  noteFocusOverlay.hidden = false;
  const wrap = document.createElement('div');
  wrap.className = 'note-focus-wrap';
  const header = document.createElement('header');
  header.className = 'note-focus-header';
  const title = document.createElement('h2');
  title.textContent = 'Заметка';
  const status = document.createElement('span');
  status.className = 'note-save-status';
  status.textContent = 'Сохранено';
  status.setAttribute('role', 'status');
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'text-button note-focus-copy';
  copy.textContent = 'Копировать';
  copy.disabled = !note.body;
  copy.addEventListener('click', () => void copyNote(note, copy));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'text-button note-focus-close';
  close.textContent = 'Закрыть';
  close.addEventListener('click', exitNoteFocus);
  header.append(title, status, copy, close);
  const ta = document.createElement('textarea');
  ta.className = 'note-focus-body';
  ta.value = note.body;
  ta.placeholder = 'Напишите заметку…';
  ta.spellcheck = false;
  ta.setAttribute('aria-label', 'Текст заметки');
  const links = document.createElement('div');
  links.className = 'note-links';
  fillLinks(links, note.body);
  wrap.append(header, ta, links);
  noteFocusOverlay.append(wrap);
  noteFocusOverlay.showModal();
  ta.addEventListener('input', () => {
    note.body = ta.value;
    note.updatedAt = Date.now();
    status.textContent = 'Сохранение…';
    copy.disabled = !note.body;
    fillLinks(links, note.body);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      flushNotes();
      status.textContent = 'Сохранено';
    }, SAVE_DEBOUNCE_MS);
  });
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
};

export const exitNoteFocus = () => {
  flushNotes();
  noteFocusOverlay.close();
  noteFocusOverlay.hidden = true;
  noteFocusOverlay.replaceChildren();
  renderNotes();
  const card = notesListEl.querySelector(`.note[data-id="${returnFocusId}"]`);
  const button = card?.querySelector('.note-open');
  if (button instanceof HTMLButtonElement) button.focus();
  returnFocusId = null;
};

export const wireNoteFocus = () => {
  noteFocusOverlay.addEventListener('cancel', (event) => {
    event.preventDefault();
    exitNoteFocus();
  });
  window.addEventListener('pagehide', flushNotes);
};
