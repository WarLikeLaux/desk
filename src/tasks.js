// @ts-check
import { initDeleteButton, setDeleteButtonState } from './delete-button.js';
/** @typedef {import('./types.js').Task} Task */
/** @typedef {import('./types.js').TaskFilter} TaskFilter */
/** @typedef {import('./types.js').TaskCategoryFilter} TaskCategoryFilter */

import { state } from './state.js';
import { saveTasks } from './storage.js';
import { pluralize, generateId, renderTextWithLinks, formatEstimate, copyText } from './utils.js';
import { showToast } from './toast.js';
import { renderCategoryPicker, setCategoryButton, closeCategoryPicker } from './task-categories.js';
import {
  $,
  qs,
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

export const currentDraftCategory = () =>
  state.draftTaskCategory !== undefined
    ? state.draftTaskCategory
    : state.categoryFilter === 'all'
      ? 'work'
      : state.categoryFilter;

/** @returns {Task[]} */
const categoryTasks = () =>
  state.tasks.filter(
    (task) => state.categoryFilter === 'all' || task.category === state.categoryFilter,
  );

/** @returns {Task[]} */
const currentTasks = () =>
  categoryTasks().filter((task) =>
    state.filter === 'later' ? task.bucket === 'later' : task.bucket === 'today',
  );

/** @returns {Task[]} */
export const visibleTasks = () => {
  const tasks = currentTasks();
  if (state.filter === 'active') return tasks.filter((t) => !t.completed);
  if (state.filter === 'completed') return tasks.filter((t) => t.completed);
  if (state.filter === 'later' || state.showAllCompleted) return tasks;
  const completed = tasks.filter((t) => t.completed);
  if (completed.length <= COMPLETED_COLLAPSE_MAX) return tasks;
  const visibleCompleted = new Set(completed.slice(0, COMPLETED_COLLAPSE_MAX).map((t) => t.id));
  return tasks.filter((t) => !t.completed || visibleCompleted.has(t.id));
};

/** @returns {number} */
export const hiddenCompletedCount = () => {
  if (state.filter !== 'all' || state.showAllCompleted) return 0;
  return Math.max(0, currentTasks().filter((t) => t.completed).length - COMPLETED_COLLAPSE_MAX);
};

export const toggleShowAllCompleted = () => {
  state.showAllCompleted = !state.showAllCompleted;
  renderTasks();
};

/** Build a plain-text dump of the tasks currently visible in the active filter. */
export const visibleTasksAsText = () =>
  visibleTasks()
    .map((t) =>
      [
        t.text + (t.estimate ? ` (${formatEstimate(t.estimate)})` : ''),
        ...t.links.map((link) => `${link.label}: ${link.url}`),
      ].join('\n'),
    )
    .join('\n');

/**
 * Copy the visible tasks to the clipboard. Falls back to the legacy execCommand
 * path when navigator.clipboard is unavailable (insecure context, old Safari).
 * @returns {Promise<boolean>} true on success.
 */
export const copyVisibleTasks = () => copyText(visibleTasksAsText());

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
 * @param {Task['estimate']} [estimate]
 * @param {Task['links']} [links]
 * @param {Task['category']} [category]
 */
export const addTask = (
  text,
  prepend = false,
  estimate = null,
  links = [],
  category = currentDraftCategory(),
) => {
  const clean = text.trim();
  if (!clean) return;
  if (state.categoryFilter !== 'all' && state.categoryFilter !== category) setCategoryFilter('all');
  const task = {
    id: generateId('t'),
    text: clean,
    completed: false,
    createdAt: Date.now(),
    bucket: /** @type {'today' | 'later'} */ (state.filter === 'later' ? 'later' : 'today'),
    category,
    estimate,
    links,
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
  if (t.completed) {
    t.completedAt = Date.now();
    t.bucket = 'today';
  } else delete t.completedAt;
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
    setDeleteButtonState(b, false);
  });
  li.classList.add('is-confirming');
  const btn = li.querySelector('.delete');
  setDeleteButtonState(btn, true);
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
    setDeleteButtonState(b, false);
  }
  state.pendingDeleteId = null;
  if (state.pendingDeleteTimer) clearTimeout(state.pendingDeleteTimer);
  state.pendingDeleteTimer = null;
};

export const clearCompleted = () => {
  const removed = categoryTasks().filter((t) => t.completed);
  if (removed.length === 0) return;
  cancelPendingTaskDelete();
  const removedIds = new Set(removed.map((task) => task.id));
  state.tasks = state.tasks.filter((t) => !removedIds.has(t.id));
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

/** @param {Task} task @returns {HTMLElement} */
const buildTaskEl = (task) => {
  const li = document.createElement('li');
  const selecting = state.filter === 'later';
  const selected = selecting && state.selectedTaskIds.has(task.id);
  li.className = `task${task.completed ? ' is-done' : ''}${selected ? ' is-selected' : ''}`;
  li.draggable = !(selecting && state.selectedTaskIds.size > 0);
  li.dataset.id = task.id;
  if (state.lastAnimatedIds.has(task.id)) {
    li.classList.add('is-new');
    state.lastAnimatedIds.delete(task.id);
  }
  const handle = document.createElement('span');
  handle.className = 'handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.innerHTML =
    '<svg viewBox="0 0 16 20" width="16" height="20" fill="currentColor"><circle cx="5" cy="5" r="1"/><circle cx="11" cy="5" r="1"/><circle cx="5" cy="10" r="1"/><circle cx="11" cy="10" r="1"/><circle cx="5" cy="15" r="1"/><circle cx="11" cy="15" r="1"/></svg>';
  li.appendChild(handle);

  const check = document.createElement('button');
  check.className = `check${(selecting ? selected : task.completed) ? ' is-checked' : ''}`;
  check.type = 'button';
  check.setAttribute(
    'aria-label',
    selecting
      ? `${selected ? 'Снять выбор' : 'Выбрать задачу'} «${task.text}»`
      : task.completed
        ? 'Отметить как невыполненную'
        : 'Отметить как выполненную',
  );
  check.setAttribute('aria-pressed', String(selecting ? selected : task.completed));
  check.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 5"/></svg>';
  li.appendChild(check);

  const content = document.createElement('div');
  content.className = 'task-content';
  if (task.links.length) {
    const links = document.createElement('div');
    links.className = 'task-links';
    for (const link of task.links) {
      const a = document.createElement('a');
      a.className = 'task-link';
      a.href = link.url;
      a.textContent = link.label;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      links.append(a);
    }
    content.append(links);
  }
  const text = document.createElement('span');
  text.className = 'task-text';
  text.title = task.text;
  text.appendChild(renderTextWithLinks(task.text, document));
  const titleLine = document.createElement('div');
  titleLine.className = 'task-title-line';
  const category = document.createElement('button');
  category.type = 'button';
  category.className = 'task-category-mark';
  setCategoryButton(category, task.category, `Категория задачи «${task.text}»`);
  titleLine.append(category);
  titleLine.append(text);
  content.appendChild(titleLine);
  li.appendChild(content);

  const estimate = document.createElement('button');
  estimate.className = 'task-estimate task-edit-button';
  estimate.type = 'button';
  estimate.textContent = formatEstimate(task.estimate);
  estimate.dataset.tooltip = formatEstimate(task.estimate);
  estimate.hidden = !task.estimate;
  estimate.setAttribute(
    'aria-label',
    `Оценка времени для «${task.text}»: ${formatEstimate(task.estimate) || 'не указана'}. Изменить`,
  );
  li.append(estimate);

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const edit = document.createElement('button');
  edit.className = 'task-edit-button task-menu';
  edit.type = 'button';
  edit.innerHTML =
    '<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg>';
  edit.setAttribute('aria-label', `Изменить задачу «${task.text}»`);
  actions.append(edit);
  const del = document.createElement('button');
  del.className = 'delete';
  del.type = 'button';
  initDeleteButton(del, `Удалить задачу «${task.text}»`);
  actions.append(del);
  li.append(actions);
  return li;
};

export const renderTasks = () => {
  closeCategoryPicker();
  const selectionMenu = $('#taskSelectionMenu');
  if (selectionMenu?.matches(':popover-open')) selectionMenu.hidePopover();
  $('#taskSelectionMore')?.setAttribute('aria-expanded', 'false');
  setCategoryButton(
    /** @type {HTMLButtonElement} */ (document.querySelector('#newTaskCategory')),
    currentDraftCategory(),
    'Категория новой задачи',
  );
  document
    .querySelectorAll('.task.is-confirming')
    .forEach((el) => el.classList.remove('is-confirming'));

  const visible = visibleTasks();
  const visibleIds = new Set(visible.map((task) => task.id));
  state.selectedTaskIds.forEach((id) => {
    if (!visibleIds.has(id)) state.selectedTaskIds.delete(id);
  });
  renderTaskSelection();
  taskList.innerHTML = '';
  visible.forEach((task) => taskList.appendChild(buildTaskEl(task)));

  const hidden = hiddenCompletedCount();
  if (hidden > 0) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'task-show-all';
    toggle.textContent = `Показать ещё ${hidden} ${pluralize(hidden, ['завершённую', 'завершённые', 'завершённых'])}`;
    const row = document.createElement('li');
    row.append(toggle);
    taskList.append(row);
  } else if (state.filter === 'all' && state.showAllCompleted) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'task-show-all';
    toggle.textContent = 'Скрыть завершённые';
    const row = document.createElement('li');
    row.append(toggle);
    taskList.append(row);
  }

  if (state.pendingDeleteId) {
    const li = taskList.querySelector(`.task[data-id="${state.pendingDeleteId}"]`);
    if (li) {
      li.classList.add('is-confirming');
      const btn = li.querySelector('.delete');
      setDeleteButtonState(btn, true);
    } else {
      state.pendingDeleteId = null;
      if (state.pendingDeleteTimer) clearTimeout(state.pendingDeleteTimer);
    }
  }

  const today = categoryTasks().filter((t) => t.bucket === 'today');
  const activeCount = today.filter((t) => !t.completed).length;
  const completedCount = today.filter((t) => t.completed).length;
  const laterCount = categoryTasks().filter((t) => t.bucket === 'later').length;
  const isLater = state.filter === 'later';
  const unfinishedTasks = (isLater ? currentTasks() : today).filter((task) => !task.completed);
  const unfinished = { min: 0, max: 0 };
  let estimatedCount = 0;
  let unestimatedCount = 0;
  unfinishedTasks.forEach((task) => {
    if (!task.estimate) {
      unestimatedCount += 1;
      return;
    }
    estimatedCount += 1;
    unfinished.min += task.estimate.min;
    unfinished.max += task.estimate.max;
  });
  const planEl = /** @type {HTMLElement} */ (document.querySelector('#taskPlan'));
  const valueEl = /** @type {HTMLElement} */ (document.querySelector('#taskPlanValue'));
  const prefixEl = /** @type {HTMLElement} */ (document.querySelector('#taskPlanPrefix'));
  const labelEl = /** @type {HTMLElement} */ (document.querySelector('#taskPlanLabel'));
  prefixEl.textContent = unfinishedTasks.length === 1 ? 'Осталась задача на' : 'Осталось задач на';
  prefixEl.hidden = estimatedCount === 0;
  const estimateText = formatEstimate(unfinished);
  const splitRange =
    unfinished.min !== unfinished.max &&
    unfinished.max >= 60 &&
    (unfinished.min % 60 !== 0 || unfinished.max % 60 !== 0);
  const timeParts = !estimatedCount
    ? ['без оценки']
    : splitRange
      ? [
          formatEstimate({ min: unfinished.min, max: unfinished.min }),
          ` - ${formatEstimate({ min: unfinished.max, max: unfinished.max })}`,
        ]
      : [estimateText];
  valueEl.replaceChildren(
    ...timeParts.map((text) => {
      const part = document.createElement('span');
      part.textContent = text;
      return part;
    }),
  );
  labelEl.textContent = estimatedCount
    ? `${unestimatedCount} без оценки`
    : `${unestimatedCount} ${pluralize(unestimatedCount, ['задача', 'задачи', 'задач'])}`;
  labelEl.hidden = unestimatedCount === 0;
  planEl.setAttribute(
    'aria-label',
    estimatedCount
      ? `Осталось по оценённым задачам: ${estimateText}${unestimatedCount ? `. Без оценки: ${unestimatedCount}` : ''}`
      : `Без оценки: ${unestimatedCount} ${pluralize(unestimatedCount, ['задача', 'задачи', 'задач'])}`,
  );
  planEl.hidden = unfinishedTasks.length === 0;
  const active = isLater ? laterCount : activeCount;
  emptyState.hidden = visible.length !== 0;
  if (isLater) {
    emptyTitle.textContent = 'Пока ничего отложенного';
    emptyHint.textContent = 'Добавьте задачу здесь или выберите «На потом» в редакторе ⋯';
  } else if (state.filter === 'completed') {
    emptyTitle.textContent = 'Нет завершённых';
    emptyHint.textContent = 'Отмечайте выполненные задачи чекбоксом';
  } else if (activeCount === 0 && completedCount > 0) {
    emptyTitle.textContent = 'Все задачи завершены';
    emptyHint.textContent = 'Можно выдохнуть или добавить новую задачу';
  } else {
    emptyTitle.textContent = 'Список пуст';
    emptyHint.textContent = 'Введите первую задачу и нажмите Enter';
  }
  subtitleEl.textContent = isLater
    ? `${laterCount} ${pluralize(laterCount, ['задача отложена', 'задачи отложены', 'задач отложено'])}`
    : activeCount === 0
      ? 'Сегодня можно выдохнуть'
      : `${activeCount} ${pluralize(activeCount, ['задача', 'задачи', 'задач'])} в работе`;
  const title = document.querySelector('.title');
  if (title) title.textContent = isLater ? 'На потом' : 'Сегодня';
  remaining.textContent = `${active} ${pluralize(active, ['осталась', 'осталось', 'осталось'])}`;
  clearBtn.hidden = completedCount === 0 || isLater;
  clearCount.textContent = String(completedCount);
  progressDone.textContent = String(completedCount);
  progressTotal.textContent = String(today.length);
  document.querySelectorAll('[data-count]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const f = el.dataset.count;
    if (f === 'all') el.textContent = String(today.length);
    if (f === 'active') el.textContent = String(activeCount);
    if (f === 'completed') el.textContent = String(completedCount);
    if (f === 'later') el.textContent = String(laterCount);
  });
};

/** Set the active filter and re-render. @param {TaskFilter} f */
export const setFilter = (f) => {
  state.filter = f;
  state.selectedTaskIds.clear();
  state.showAllCompleted = false;
  document.querySelectorAll('.filter').forEach((el) => el.classList.remove('is-active'));
  const active = /** @type {HTMLElement | null} */ ($(`[data-filter="${f}"]`));
  if (active) active.classList.add('is-active');
  document
    .querySelectorAll('.filter')
    .forEach((el) => el.setAttribute('aria-pressed', String(el === active)));
  taskList.scrollTop = 0;
  cancelPendingTaskDelete();
  renderTasks();
};

/** @param {TaskCategoryFilter} category */
export const setCategoryFilter = (category) => {
  state.categoryFilter = category;
  state.draftTaskCategory = undefined;
  state.selectedTaskIds.clear();
  state.showAllCompleted = false;
  cancelPendingTaskDelete();
  renderCategoryPicker(
    /** @type {HTMLElement} */ (document.querySelector('#taskCategories')),
    category,
    true,
  );
  taskList.scrollTop = 0;
  renderTasks();
};

/** @param {string} id @param {Task['category']} category */
export const setTaskCategory = (id, category) => {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.category = category;
  saveTasks();
  renderTasks();
  const anchor =
    qs(`.task[data-id="${id}"] .task-category-mark`, taskList) ??
    $(`#taskCategories [data-category="${state.categoryFilter}"]`);
  anchor?.focus({ preventScroll: true });
};

const renderTaskSelection = () => {
  const available = currentTasks();
  const isLater = state.filter === 'later';
  const hasSelection = isLater && state.selectedTaskIds.size > 0;
  taskList.classList.toggle('is-selecting', hasSelection);
  const defaultFooter = /** @type {HTMLElement} */ (document.querySelector('#taskFooterDefault'));
  defaultFooter.hidden = hasSelection;
  const toolbar = /** @type {HTMLElement} */ (document.querySelector('#taskBulk'));
  toolbar.hidden = !hasSelection;
  const more = /** @type {HTMLButtonElement} */ (document.querySelector('#taskSelectionMore'));
  more.hidden = !isLater || available.length === 0;
  const controls = /** @type {HTMLElement} */ (document.querySelector('#taskBulkSelection'));
  controls.hidden = !hasSelection;
  const all = /** @type {HTMLButtonElement} */ (document.querySelector('#selectAllLater'));
  const allSelected =
    available.length > 0 && available.every((task) => state.selectedTaskIds.has(task.id));
  all.disabled = available.length === 0 || allSelected;
  const clear = /** @type {HTMLButtonElement} */ (document.querySelector('#cancelTaskSelection'));
  clear.disabled = !hasSelection;
  const count = /** @type {HTMLElement} */ (document.querySelector('#taskSelectionCount'));
  count.textContent = `Выбрано: ${state.selectedTaskIds.size}`;
  const move = /** @type {HTMLButtonElement} */ (document.querySelector('#moveSelectedTasks'));
  move.disabled = state.selectedTaskIds.size === 0;
};

export const clearTaskSelection = () => {
  state.selectedTaskIds.clear();
  cancelPendingTaskDelete();
  renderTasks();
};

/** @param {string} id */
export const toggleTaskSelection = (id) => {
  if (state.filter !== 'later' || !currentTasks().some((task) => task.id === id)) return;
  if (state.selectedTaskIds.has(id)) state.selectedTaskIds.delete(id);
  else state.selectedTaskIds.add(id);
  renderTasks();
  qs(`.task[data-id="${id}"] .check`, taskList)?.focus();
};

export const selectAllLater = () => {
  if (state.filter !== 'later') return;
  const available = currentTasks();
  state.selectedTaskIds = new Set(available.map((task) => task.id));
  renderTasks();
};

export const moveSelectedTasks = () => {
  if (state.filter !== 'later') return;
  const moved = currentTasks().filter((task) => state.selectedTaskIds.has(task.id));
  if (!moved.length) return;
  const originalPositions = new Map(state.tasks.map((task, index) => [task.id, index]));
  const movedIds = new Set(moved.map((task) => task.id));
  state.tasks = state.tasks.filter((task) => !movedIds.has(task.id));
  moved.forEach((task) => {
    task.bucket = 'today';
  });
  const firstCompleted = state.tasks.findIndex((task) => task.completed);
  state.tasks.splice(firstCompleted < 0 ? state.tasks.length : firstCompleted, 0, ...moved);
  state.selectedTaskIds.clear();
  saveTasks();
  renderTasks();
  showToast(
    `На сегодня: ${moved.length} ${pluralize(moved.length, ['задача', 'задачи', 'задач'])}`,
    () => {
      const restored = state.tasks.filter(
        (task) => movedIds.has(task.id) && task.bucket === 'today' && !task.completed,
      );
      const restoredIds = new Set(restored.map((task) => task.id));
      state.tasks = state.tasks.filter((task) => !restoredIds.has(task.id));
      restored.forEach((task) => {
        task.bucket = 'later';
        state.tasks.splice(
          Math.min(originalPositions.get(task.id) ?? state.tasks.length, state.tasks.length),
          0,
          task,
        );
      });
      saveTasks();
      renderTasks();
    },
  );
};
