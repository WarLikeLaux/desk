// @ts-check
/** @typedef {import('./types.js').Task} Task */

import { state } from './state.js';
import { saveTasks } from './storage.js';
import { renderTasks } from './tasks.js';
import { formatEstimate, normalizeURL, parseEstimate } from './utils.js';
import { renderCategoryPicker } from './task-categories.js';
import { qs } from './dom.js';

const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('#taskEditor'));
const form = /** @type {HTMLFormElement} */ (document.querySelector('#taskEditorForm'));
const textInput = /** @type {HTMLTextAreaElement} */ (document.querySelector('#editTaskText'));
const estimateInput = /** @type {HTMLInputElement} */ (document.querySelector('#editTaskEstimate'));
const moveButton = /** @type {HTMLButtonElement} */ (document.querySelector('#moveTaskBucket'));
const bucketLabel = /** @type {HTMLElement} */ (document.querySelector('#editTaskBucket'));
const moveLabel = /** @type {HTMLElement} */ (document.querySelector('#moveTaskBucketLabel'));
const linksList = /** @type {HTMLElement} */ (document.querySelector('#editTaskLinks'));
const categoryPicker = /** @type {HTMLElement} */ (document.querySelector('#editTaskCategory'));
let editingId = /** @type {string | null} */ (null);
let draftBucket = /** @type {Task['bucket']} */ ('today');
let draftCategory = /** @type {Task['category']} */ ('work');

const renderBucket = () => {
  bucketLabel.textContent = draftBucket === 'today' ? 'Сегодня' : 'На потом';
  moveLabel.textContent = draftBucket === 'today' ? 'На потом' : 'На сегодня';
  moveButton.setAttribute(
    'aria-label',
    draftBucket === 'today' ? 'Перенести на потом' : 'Перенести на сегодня',
  );
};

const resizeTitle = () => {
  textInput.style.height = 'auto';
  textInput.style.height = `${textInput.scrollHeight}px`;
};

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
  name.addEventListener('input', () => address.setCustomValidity(''));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'link-remove';
  remove.innerHTML =
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>';
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
  draftBucket = task.bucket;
  draftCategory = task.category;
  renderCategoryPicker(categoryPicker, draftCategory);
  renderBucket();
  linksList.replaceChildren();
  task.links.forEach((link) => addLinkRow(link.label, link.url));
  dialog.showModal();
  resizeTitle();
  textInput.focus();
};

export const wireTaskEditor = () => {
  categoryPicker.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const category = button.dataset.category;
    if (category !== 'work' && category !== 'personal') return;
    draftCategory = category;
    renderCategoryPicker(categoryPicker, draftCategory);
    qs(`button[data-category="${category}"]`, categoryPicker)?.focus();
  });
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
  textInput.addEventListener('input', () => {
    textInput.setCustomValidity('');
    resizeTitle();
  });
  window.addEventListener('resize', () => {
    if (dialog.open) resizeTitle();
  });
  textInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
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
  const saveTask = () => {
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
    task.bucket = draftBucket;
    task.category = draftCategory;
    if (task.bucket === 'later') {
      task.completed = false;
      delete task.completedAt;
    }
    saveTasks();
    renderTasks();
    dialog.close();
  };
  moveButton.addEventListener('click', () => {
    draftBucket = draftBucket === 'today' ? 'later' : 'today';
    renderBucket();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveTask();
  });
};
