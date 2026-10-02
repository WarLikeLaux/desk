// @ts-check
/** @typedef {import('./types.js').Task} Task */
/** @typedef {import('./types.js').TaskFilter} TaskFilter */

import { state } from './state.js';
import { saveTasks } from './storage.js';
import { pluralize, generateId, renderTextWithLinks } from './utils.js';
import { showToast } from './toast.js';
import {
  $,
  taskList,
  emptyState,
  emptyTitle,
  emptyHint,
  remaining,
  clearBtn,
  clearCount,
  subtitleEl,
  progressDone,
  progressTotal,
} from './dom.js';

const PENDING_DELETE_TIMEOUT_MS = 3000;

const COMPLETED_COLLAPSE_MAX = 3;

/** @returns {Task[]} */
export const visibleTasks = () => {
  if (state.filter === 'active') return state.tasks.filter((t) => !t.completed);
  if (state.filter === 'completed') return state.tasks.filter((t) => t.completed);
  if (state.showAllCompleted) return state.tasks;
  const completed = state.tasks.filter((t) => t.completed);
  if (completed.length <= COMPLETED_COLLAPSE_MAX) return state.tasks;
  const visibleCompleted = new Set(completed.slice(0, COMPLETED_COLLAPSE_MAX).map((t) => t.id));
  return state.tasks.filter((t) => !t.completed || visibleCompleted.has(t.id));
};

/** @returns {number} count of completed tasks hidden in the all-view */
export const hiddenCompletedCount = () => {
  if (state.filter !== 'all' || state.showAllCompleted) return 0;
  return state.tasks.filter((t) => t.completed).length - COMPLETED_COLLAPSE_MAX;
};

export const toggleShowAllCompleted = () => {
  state.showAllCompleted = !state.showAllCompleted;
  renderTasks();
};

/** Build a plain-text dump of the tasks currently visible in the active filter. */
export const visibleTasksAsText = () =>
  visibleTasks()
    .map((t) => t.text)
    .join('\n');

/**
 * Copy the visible tasks to the clipboard. Falls back to the legacy execCommand
 * path when navigator.clipboard is unavailable (insecure context, old Safari).
 * @returns {Promise<boolean>} true on success.
 */
export const copyVisibleTasks = async () => {
  const text = visibleTasksAsText();
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
};

/**
 * Move a task into the correct section based on its completed flag.
 * Active tasks go before the first completed; completed tasks go to the end.
 * @param {Task} task
 */
const placeTaskInOrder = (task) => {
  const idx = state.tasks.findIndex((t) => t.id === task.id);
  if (idx !== -1) state.tasks.splice(idx, 1);
  if (task.completed) {
    state.tasks.push(task);
  } else {
    const firstCompletedIdx = state.tasks.findIndex((t) => t.completed);
    if (firstCompletedIdx === -1) state.tasks.push(task);
    else state.tasks.splice(firstCompletedIdx, 0, task);
  }
};

/**
 * @param {string} text
 * @param {boolean} [prepend=false] When true, insert at the very top of the list.
 */
export const addTask = (text, prepend = false) => {
  const clean = text.trim();
  if (!clean) return;
  const task = {
    id: generateId('t'),
    text: clean,
    completed: false,
    createdAt: Date.now(),
  };
  if (prepend) {
    state.tasks.unshift(task);
  } else {
    const firstCompletedIdx = state.tasks.findIndex((t) => t.completed);
    if (firstCompletedIdx === -1) state.tasks.push(task);
    else state.tasks.splice(firstCompletedIdx, 0, task);
  }
  state.lastAnimatedIds.add(task.id);
  saveTasks();
  renderTasks();
};

/** @param {string} id */
export const toggleTask = (id) => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  if (t.completed) t.completedAt = Date.now();
  else delete t.completedAt;
  placeTaskInOrder(t);
  state.lastAnimatedIds.add(id);
  saveTasks();
  renderTasks();
};

/** @param {string} id */
const actuallyDeleteTask = (id) => {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  state.pendingDeleteId = null;
  if (state.pendingDeleteTimer) clearTimeout(state.pendingDeleteTimer);
  saveTasks();
  renderTasks();
};

/**
 * @param {HTMLElement} li
 * @param {string} id
 */
export const requestDeleteTask = (li, id) => {
  if (state.pendingDeleteId === id) {
    actuallyDeleteTask(id);
    return;
  }
  document.querySelectorAll('.task.is-confirming').forEach((el) => {
    el.classList.remove('is-confirming');
    const b = el.querySelector('.delete');
    if (b) b.textContent = '×';
  });
  li.classList.add('is-confirming');
  const btn = li.querySelector('.delete');
  if (btn) btn.textContent = 'Удалить?';
  state.pendingDeleteId = id;
  if (state.pendingDeleteTimer) clearTimeout(state.pendingDeleteTimer);
  state.pendingDeleteTimer = setTimeout(() => cancelPendingTaskDelete(), PENDING_DELETE_TIMEOUT_MS);
};

export const cancelPendingTaskDelete = () => {
  if (!state.pendingDeleteId) return;
  const li = taskList.querySelector(`.task[data-id="${state.pendingDeleteId}"]`);
  if (li) {
    li.classList.remove('is-confirming');
    const b = li.querySelector('.delete');
    if (b) b.textContent = '×';
  }
  state.pendingDeleteId = null;
  if (state.pendingDeleteTimer) clearTimeout(state.pendingDeleteTimer);
  state.pendingDeleteTimer = null;
};

export const clearCompleted = () => {
  const removed = state.tasks.filter((t) => t.completed);
  if (removed.length === 0) return;
  cancelPendingTaskDelete();
  state.tasks = state.tasks.filter((t) => !t.completed);
  saveTasks();
  renderTasks();
  showToast(
    `${pluralize(removed.length, ['Удалена', 'Удалены', 'Удалено'])} ${removed.length} ${pluralize(removed.length, ['задача', 'задачи', 'задач'])}`,
    () => {
      state.tasks = [...state.tasks, ...removed];
      removed.forEach((t) => state.lastAnimatedIds.add(t.id));
      saveTasks();
      renderTasks();
    },
  );
};

/**
 * @param {Task} task
 * @param {number} index
 * @returns {HTMLElement}
 */
const buildTaskEl = (task, index) => {
  const li = document.createElement('li');
  li.className = `task${task.completed ? ' is-done' : ''}`;
  li.draggable = true;
  li.dataset.id = task.id;
  if (state.lastAnimatedIds.has(task.id)) {
    li.classList.add('is-new');
    state.lastAnimatedIds.delete(task.id);
  }

  const dragHandle = document.createElement('span');
  dragHandle.className = 'handle';
  dragHandle.setAttribute('aria-label', 'Перетащить');
  dragHandle.innerHTML = `
    <span class="handle-dot"><span></span><span></span></span>
    <span class="handle-dot"><span></span><span></span></span>
    <span class="handle-dot"><span></span><span></span></span>
  `;
  li.appendChild(dragHandle);

  const check = document.createElement('button');
  check.className = `check${task.completed ? ' is-checked' : ''}`;
  check.type = 'button';
  check.setAttribute(
    'aria-label',
    task.completed ? 'Отметить как невыполненную' : 'Отметить как выполненную',
  );
  check.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 8.5l3.2 3.2L13 5"/>
    </svg>
  `;
  li.appendChild(check);

  const text = document.createElement('span');
  text.className = 'task-text';
  text.appendChild(renderTextWithLinks(task.text, document));
  text.title = 'Двойной клик — редактировать';
  li.appendChild(text);

  const id = document.createElement('span');
  id.className = 'task-id';
  id.textContent = String(index + 1).padStart(2, '0');
  li.appendChild(id);

  const del = document.createElement('button');
  del.className = 'delete';
  del.type = 'button';
  del.setAttribute('aria-label', 'Удалить');
  del.textContent = '×';
  li.appendChild(del);

  return li;
};

export const renderTasks = () => {
  document
    .querySelectorAll('.task.is-confirming')
    .forEach((el) => el.classList.remove('is-confirming'));

  const visible = visibleTasks();
  taskList.innerHTML = '';
  visible.forEach((task, i) => taskList.appendChild(buildTaskEl(task, i)));

  const hidden = hiddenCompletedCount();
  if (hidden > 0) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'task-show-all';
    toggle.textContent = `Показать ещё ${hidden} ${pluralize(hidden, ['завершённую', 'завершённые', 'завершённых'])}`;
    taskList.appendChild(toggle);
  } else if (state.filter === 'all' && state.showAllCompleted) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'task-show-all';
    toggle.textContent = 'Скрыть завершённые';
    taskList.appendChild(toggle);
  }

  if (state.pendingDeleteId) {
    const li = taskList.querySelector(`.task[data-id="${state.pendingDeleteId}"]`);
    if (li) {
      li.classList.add('is-confirming');
      const btn = li.querySelector('.delete');
      if (btn) btn.textContent = 'Удалить?';
    } else {
      state.pendingDeleteId = null;
      if (state.pendingDeleteTimer) clearTimeout(state.pendingDeleteTimer);
    }
  }

  const isEmpty = visible.length === 0;
  emptyState.hidden = !isEmpty;
  if (isEmpty) {
    if (state.tasks.length === 0) {
      emptyTitle.textContent = 'Список пуст';
      emptyHint.textContent = 'Введите первую задачу и нажмите Enter';
    } else if (state.filter === 'active') {
      emptyTitle.textContent = 'Все задачи завершены';
      emptyHint.textContent = 'Хорошая работа. Можно выдохнуть.';
    } else if (state.filter === 'completed') {
      emptyTitle.textContent = 'Нет завершённых';
      emptyHint.textContent = 'Отмечайте задачи чекбоксом, чтобы видеть их здесь';
    }
  }

  if (state.tasks.length === 0) {
    subtitleEl.textContent = 'Список текущих задач';
  } else {
    const active = state.tasks.filter((t) => !t.completed).length;
    subtitleEl.textContent =
      active === 0
        ? 'Все задачи на сегодня закрыты'
        : `${active} ${pluralize(active, ['задача', 'задачи', 'задач'])} в работе`;
  }

  const activeCount = state.tasks.filter((t) => !t.completed).length;
  const completedCount = state.tasks.filter((t) => t.completed).length;
  remaining.textContent = `${activeCount} ${pluralize(activeCount, ['осталась', 'осталось', 'осталось'])}`;

  clearBtn.hidden = completedCount === 0;
  clearCount.textContent = String(completedCount);

  progressDone.textContent = String(completedCount);
  progressTotal.textContent = String(state.tasks.length);

  document.querySelectorAll('[data-count]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const f = el.dataset.count;
    if (f === 'all') el.textContent = String(state.tasks.length);
    if (f === 'active') el.textContent = String(activeCount);
    if (f === 'completed') el.textContent = String(completedCount);
  });
};

/** @param {HTMLElement} li */
export const startTaskEdit = (li) => {
  if (li.querySelector('.task-edit')) return;
  const text = li.querySelector('.task-text');
  if (!text) return;
  const id = li.dataset.id;
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  const originalText = task.text;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit';
  input.value = originalText;
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Редактировать задачу');

  text.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  /** @param {boolean} save */
  const finish = (save) => {
    if (done) return;
    done = true;
    const next = save ? input.value.trim() : originalText;
    if (save && next && next !== originalText) {
      task.text = next;
      saveTasks();
    }
    const restored = document.createElement('span');
    restored.className = 'task-text';
    restored.textContent = next || originalText;
    restored.title = 'Двойной клик — редактировать';
    if (input.parentNode) input.replaceWith(restored);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
};

/** Set the active filter and re-render. @param {TaskFilter} f */
export const setFilter = (f) => {
  state.filter = f;
  state.showAllCompleted = false;
  document.querySelectorAll('.filter').forEach((el) => el.classList.remove('is-active'));
  const active = /** @type {HTMLElement | null} */ ($(`[data-filter="${f}"]`));
  if (active) active.classList.add('is-active');
  cancelPendingTaskDelete();
  renderTasks();
};
