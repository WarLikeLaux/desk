// @ts-check

import { state } from './state.js';
import { saveTasks } from './storage.js';
import { taskList } from './dom.js';
import { renderTasks } from './tasks.js';

const clearDropMarkers = () => {
  document.querySelectorAll('.drop-target, .drop-target-below').forEach((el) => {
    el.classList.remove('drop-target', 'drop-target-below');
  });
};

/** @param {EventTarget | null} target */
const closestTask = (target) => {
  if (!(target instanceof Element)) return null;
  const li = target.closest('.task');
  return li instanceof HTMLElement ? li : null;
};

export const setupDragDrop = () => {
  taskList.addEventListener('dragstart', (e) => {
    if (e.target instanceof Element && e.target.closest('.task-edit')) {
      e.preventDefault();
      return;
    }
    const li = closestTask(e.target);
    if (!li) return;
    state.dragId = li.dataset.id ?? null;
    li.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', state.dragId ?? '');
      } catch {}
    }
  });

  taskList.addEventListener('dragend', (e) => {
    const li = closestTask(e.target);
    if (li) li.classList.remove('dragging');
    clearDropMarkers();
    state.dragId = null;
  });

  taskList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const li = closestTask(e.target);
    if (!li || !state.dragId || li.dataset.id === state.dragId) return;
    clearDropMarkers();
    const rect = li.getBoundingClientRect();
    const isAbove = e.clientY - rect.top < rect.height / 2;
    if (isAbove) li.classList.add('drop-target');
    else li.classList.add('drop-target-below');
  });

  taskList.addEventListener('dragleave', (e) => {
    if (!(e.relatedTarget instanceof Node) || !taskList.contains(e.relatedTarget)) {
      clearDropMarkers();
    }
  });

  taskList.addEventListener('drop', (e) => {
    e.preventDefault();
    const li = closestTask(e.target);
    if (!li || !state.dragId || li.dataset.id === state.dragId) return;

    const rect = li.getBoundingClientRect();
    const isAbove = e.clientY - rect.top < rect.height / 2;
    const fromIndex = state.tasks.findIndex((t) => t.id === state.dragId);
    let toIndex = state.tasks.findIndex((t) => t.id === li.dataset.id);
    if (fromIndex === -1 || toIndex === -1) return;

    if (!isAbove) toIndex += 1;
    if (fromIndex < toIndex) toIndex -= 1;

    const [moved] = state.tasks.splice(fromIndex, 1);
    state.tasks.splice(toIndex, 0, moved);

    clearDropMarkers();
    saveTasks();
    renderTasks();
  });
};
