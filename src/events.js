// @ts-check

import { state } from './state.js';
import {
  composer,
  taskInput,
  taskList,
  filtersEl,
  clearBtn,
  timersListEl,
  addTimerBtn,
} from './dom.js';
import {
  addTask,
  toggleTask,
  requestDeleteTask,
  cancelPendingTaskDelete,
  clearCompleted,
  startTaskEdit,
  setFilter,
} from './tasks.js';
import {
  toggleTimerPaused,
  resetTimerPhase,
  switchTimerPhase,
  requestDeleteTimer,
  cancelPendingTimerDelete,
  startTimerNameEdit,
  startTimerDurationEdit,
  renderTimers,
} from './timers.js';
import { hideToast } from './toast.js';
import { setupDragDrop } from './dragdrop.js';
import { setupAudioUnlock } from './audio.js';

const wireComposer = () => {
  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (taskInput.value.trim()) {
      addTask(taskInput.value);
      taskInput.value = '';
    }
    taskInput.focus();
  });

  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      taskInput.value = '';
      taskInput.blur();
    }
  });
};

const wireTaskList = () => {
  taskList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const li = target.closest('.task');
    if (!li || !(li instanceof HTMLElement)) return;
    const id = li.dataset.id;
    if (!id) return;
    if (target.closest('.check')) toggleTask(id);
    else if (target.closest('.delete')) requestDeleteTask(li, id);
  });

  taskList.addEventListener('dblclick', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.check') || target.closest('.handle') || target.closest('.delete')) return;
    const li = target.closest('.task');
    if (!li || !(li instanceof HTMLElement)) return;
    startTaskEdit(li);
  });
};

const wireFilters = () => {
  filtersEl.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('.filter');
    if (!(btn instanceof HTMLElement)) return;
    const f = btn.dataset.filter;
    if (f === 'all' || f === 'active' || f === 'completed') setFilter(f);
  });
};

const wireClearCompleted = () => {
  clearBtn.addEventListener('click', clearCompleted);
};

const wireOutsideClicks = () => {
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (state.pendingDeleteId && !target.closest(`.task[data-id="${state.pendingDeleteId}"]`)) {
      requestAnimationFrame(() => {
        if (state.pendingDeleteId) cancelPendingTaskDelete();
      });
    }
    if (
      state.pendingTimerDeleteId &&
      !target.closest(`.timer-card[data-id="${state.pendingTimerDeleteId}"]`)
    ) {
      requestAnimationFrame(() => {
        if (state.pendingTimerDeleteId) cancelPendingTimerDelete();
      });
    }
  });
};

const wireGlobalKeys = () => {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      taskInput.focus();
      taskInput.select();
      return;
    }
    const target = e.target;
    const tag = (target instanceof Element ? target.tagName : '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (target instanceof HTMLElement && target.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;
    taskInput.focus();
  });
};

const wireTimers = () => {
  addTimerBtn.addEventListener('click', () => {
    import('./timers.js').then((m) => m.addTimer());
  });

  timersListEl.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const card = target.closest('.timer-card');
    if (!card || !(card instanceof HTMLElement)) return;
    const id = card.dataset.id;
    if (!id) return;
    if (target.closest('.timer-toggle')) toggleTimerPaused(id);
    else if (target.closest('.timer-reset')) resetTimerPhase(id);
    else if (target.closest('.timer-phase-btn')) switchTimerPhase(id);
    else if (target.closest('.timer-delete')) requestDeleteTimer(id);
    else if (target.closest('.timer-dur')) {
      const btn = target.closest('.timer-dur');
      if (btn instanceof HTMLButtonElement) {
        const field = /** @type {'work' | 'break'} */ (btn.dataset.field ?? 'work');
        startTimerDurationEdit(card, field, btn);
      }
    }
  });

  timersListEl.addEventListener('dblclick', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.timer-name')) return;
    const card = target.closest('.timer-card');
    if (card instanceof HTMLElement) startTimerNameEdit(card);
  });

  // Notification click → switch phase
  window.addEventListener('desk:phase-switch', (e) => {
    const detail = e instanceof CustomEvent ? e.detail : null;
    if (detail && typeof detail.id === 'string') switchTimerPhase(detail.id);
  });

  // Hide toast on Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideToast(true);
  });

  // Re-render on storage changes from another tab
  window.addEventListener('storage', () => renderTimers());
};

export const setupEventListeners = () => {
  wireComposer();
  wireTaskList();
  wireFilters();
  wireClearCompleted();
  wireOutsideClicks();
  wireGlobalKeys();
  wireTimers();
  setupDragDrop();
  setupAudioUnlock();
};
