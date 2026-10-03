// @ts-check
/** @typedef {import('./types.js').Task} Task */

import { state } from './state.js';
import { saveTasks } from './storage.js';
import { renderTasks } from './tasks.js';
import { formatEstimate, normalizeURL, parseEstimate } from './utils.js';

const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('#taskEditor'));
const form = /** @type {HTMLFormElement} */ (document.querySelector('#taskEditorForm'));
const textInput = /** @type {HTMLInputElement} */ (document.querySelector('#editTaskText'));
const estimateInput = /** @type {HTMLInputElement} */ (document.querySelector('#editTaskEstimate'));
const laterInput = /** @type {HTMLSelectElement} */ (document.querySelector('#editTaskLater'));
const linksList = /** @type {HTMLElement} */ (document.querySelector('#editTaskLinks'));
let editingId = /** @type {string | null} */ (null);

/** @param {string} [label] @param {string} [url] */
const addLinkRow = (label = '', url = '') => {
  const row = document.createElement('div');
  row.className = 'link-editor-row';
  const name = document.createElement('input');
  name.className = 'link-label';
  name.placeholder = 'Название';
  name.setAttribute('aria-label', 'Название ссылки (необязательно)');
  name.value = label;
  const address = document.createElement('input');
  address.className = 'link-url';
  address.placeholder = 'https://…';
  address.setAttribute('aria-label', 'Адрес ссылки');
  address.value = url;
  address.addEventListener('input', () => address.setCustomValidity(''));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'link-remove';
  remove.textContent = '×';
  remove.setAttribute('aria-label', 'Убрать ссылку');
  remove.addEventListener('click', () => row.remove());
  row.append(address, name, remove);
  linksList.append(row);
  return address;
};

/** @param {string} id */
export const openTaskEditor = (id) => {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  editingId = id;
  textInput.value = task.text;
  textInput.setCustomValidity('');
  estimateInput.value = formatEstimate(task.estimate);
  estimateInput.setCustomValidity('');
  laterInput.value = task.bucket;
  linksList.replaceChildren();
  task.links.forEach((link) => addLinkRow(link.label, link.url));
  dialog.showModal();
  textInput.focus();
};

export const wireTaskEditor = () => {
  dialog.addEventListener('close', () => {
    const button =
      document.querySelector(`.task[data-id="${editingId}"] .task-menu`) ??
      document.querySelector('.filter.is-active');
    if (button instanceof HTMLButtonElement) button.focus();
  });
  document.querySelector('#addTaskLink')?.addEventListener('click', () => addLinkRow().focus());
  document.querySelector('#cancelTaskEdit')?.addEventListener('click', () => dialog.close());
  document.querySelector('#closeTaskEdit')?.addEventListener('click', () => dialog.close());
  estimateInput.addEventListener('input', () => estimateInput.setCustomValidity(''));
  textInput.addEventListener('input', () => textInput.setCustomValidity(''));
  textInput.addEventListener('paste', (event) => {
    const pasted = event.clipboardData?.getData('text/plain') ?? '';
    const url = normalizeURL(pasted);
    if (
      url &&
      textInput.selectionStart === 0 &&
      textInput.selectionEnd === textInput.value.length &&
      textInput.value
    ) {
      event.preventDefault();
      addLinkRow(new URL(url).hostname, url);
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const task = state.tasks.find((t) => t.id === editingId);
    if (!task) return;
    const text = textInput.value.trim();
    textInput.setCustomValidity(text ? '' : 'Введите название задачи');
    const estimate = parseEstimate(estimateInput.value);
    estimateInput.setCustomValidity(
      estimateInput.value.trim() && !estimate ? 'Например: 30 мин, 1–2 ч или 30 мин – 1 ч' : '',
    );
    const links = /** @type {Task['links']} */ ([]);
    linksList.querySelectorAll('.link-editor-row').forEach((row) => {
      const label = /** @type {HTMLInputElement} */ (row.querySelector('.link-label'));
      const address = /** @type {HTMLInputElement} */ (row.querySelector('.link-url'));
      const url = normalizeURL(address.value);
      address.setCustomValidity(
        address.value.trim() && !url
          ? 'Введите адрес сайта, например https://example.com'
          : label.value.trim() && !url
            ? 'Добавьте адрес ссылки или уберите строку'
            : '',
      );
      if (url) links.push({ label: label.value.trim() || new URL(url).hostname, url });
    });
    if (!form.reportValidity()) return;
    task.text = text;
    task.estimate = estimate;
    task.links = links;
    task.bucket = laterInput.value === 'later' ? 'later' : 'today';
    if (task.bucket === 'later') {
      task.completed = false;
      delete task.completedAt;
    }
    saveTasks();
    renderTasks();
    dialog.close();
  });
};
