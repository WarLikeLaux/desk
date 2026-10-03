// @ts-check
/** @typedef {import('./types.js').Note} Note */

import { state } from './state.js';
import { saveNotes } from './storage.js';
import { generateId, copyText, normalizeURL } from './utils.js';
import { showToast } from './toast.js';
import { notesListEl, notesCountEl, addNoteBtn, noteFocusOverlay } from './dom.js';

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
  button.textContent = ok ? 'Скопировано' : 'Не скопировано';
  setTimeout(() => {
    button.textContent = 'Копировать';
  }, 2000);
  if (!noteFocusOverlay.open)
    showToast(ok ? 'Заметка скопирована' : 'Не удалось скопировать заметку', null, 'Закрыть');
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
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'note-open';
  open.textContent = 'Открыть';
  open.addEventListener('click', () => enterNoteFocus(note.id));
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'note-copy';
  copy.textContent = 'Копировать';
  copy.disabled = !note.body;
  copy.addEventListener('click', () => void copyNote(note, copy));
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'note-delete';
  del.textContent = '×';
  del.setAttribute('aria-label', 'Удалить заметку');
  del.addEventListener('click', () => requestDeleteNote(note.id));
  actions.append(open, copy, del);
  meta.append(stamp, actions);
  card.append(meta);
  return card;
};

export const renderNotes = () => {
  notesListEl.replaceChildren();
  if (!state.notes.length) {
    const empty = document.createElement('p');
    empty.className = 'note-empty-text';
    empty.textContent = 'Для мыслей, ссылок и всего, что нужно держать под рукой.';
    const add = document.createElement('button');
    add.className = 'note-empty-add';
    add.type = 'button';
    add.textContent = 'Новая заметка';
    add.addEventListener('click', addNote);
    notesListEl.append(empty, add);
  } else {
    [...state.notes]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach((note) => notesListEl.append(buildNoteCard(note)));
  }
  notesCountEl.textContent = String(state.notes.length);
  if (state.pendingNoteDeleteId) {
    const card = notesListEl.querySelector(`.note[data-id="${state.pendingNoteDeleteId}"]`);
    card?.classList.add('is-confirming');
    const btn = card?.querySelector('.note-delete');
    if (btn) btn.textContent = 'Удалить?';
  }
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
    cancelPendingNoteDelete();
    state.notes = state.notes.filter((note) => note.id !== id);
    saveNotes();
    renderNotes();
    return;
  }
  cancelPendingNoteDelete();
  state.pendingNoteDeleteId = id;
  state.pendingNoteDeleteTimer = setTimeout(cancelPendingNoteDelete, PENDING_DELETE_TIMEOUT_MS);
  renderNotes();
};

export const cancelPendingNoteDelete = () => {
  if (state.pendingNoteDeleteTimer) clearTimeout(state.pendingNoteDeleteTimer);
  state.pendingNoteDeleteTimer = null;
  const card = notesListEl.querySelector(`.note[data-id="${state.pendingNoteDeleteId}"]`);
  card?.classList.remove('is-confirming');
  const btn = card?.querySelector('.note-delete');
  if (btn) btn.textContent = '×';
  state.pendingNoteDeleteId = null;
};

export const wireAddNoteButton = () => addNoteBtn.addEventListener('click', addNote);

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
