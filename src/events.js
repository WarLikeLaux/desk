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
  toggleShowAllCompleted,
  copyVisibleTasks,
} from './tasks.js';
import { copyBtn, focusOverlay, noteFocusOverlay } from './dom.js';
import { showToast } from './toast.js';
import {
  toggleTimerPaused,
  resetTimerPhase,
  switchTimerPhase,
  requestDeleteTimer,
  cancelPendingTimerDelete,
  startTimerNameEdit,
  startTimerDurationEdit,
  startTimerRemainingEdit,
  renderTimers,
  enterFocusMode,
  exitFocusMode,
} from './timers.js';
import { cancelPendingNoteDelete, exitNoteFocus, wireNoteFocus } from './notes.js';
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
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter prepends the new task to the top of the list.
      e.preventDefault();
      if (taskInput.value.trim()) {
        addTask(taskInput.value, true);
        taskInput.value = '';
        taskInput.focus();
      }
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

  taskList.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('.task-show-all')) {
      toggleShowAllCompleted();
    }
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

const wireCopyTasks = () => {
  copyBtn.addEventListener('click', async () => {
    const ok = await copyVisibleTasks();
    if (ok) showToast('Задачи скопированы', null, 'Закрыть');
  });
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
    if (
      state.pendingNoteDeleteId &&
      !target.closest(`.note[data-id="${state.pendingNoteDeleteId}"]`)
    ) {
      requestAnimationFrame(() => {
        if (state.pendingNoteDeleteId) cancelPendingNoteDelete();
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
  addTimerBtn.addEventListener('click', (e) => {
    const t = e.shiftKey ? 'work' : 'pomodoro';
    import('./timers.js').then((m) => m.addTimer(t));
  });

  // Shared by the timers list and the focus-mode overlay, whose card is a clone.
  /** @param {MouseEvent} e */
  const onTimerCardClick = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const card = target.closest('.timer-card');
    if (!card || !(card instanceof HTMLElement)) return;
    const id = card.dataset.id;
    if (!id) return;
    if (target.closest('.timer-toggle')) toggleTimerPaused(id);
    else if (target.closest('.timer-reset')) resetTimerPhase(id);
    else if (target.closest('.timer-phase-option')) {
      const opt = target.closest('.timer-phase-option');
      if (opt instanceof HTMLElement) {
        const target = /** @type {'work' | 'break'} */ (opt.dataset.target ?? 'work');
        const timer = state.timers.find((t) => t.id === id);
        if (timer && timer.phase !== target) switchTimerPhase(id);
      }
    } else if (target.closest('.timer-delete')) requestDeleteTimer(id);
    else if (target.closest('.timer-expand')) enterFocusMode(id);
    else if (target.closest('.timer-time')) {
      if (card.classList.contains('is-paused') && !card.classList.contains('is-expired')) {
        startTimerRemainingEdit(card);
      }
      return;
    } else if (target.closest('.timer-dur')) {
      const btn = target.closest('.timer-dur');
      if (btn instanceof HTMLButtonElement) {
        const field = /** @type {'work' | 'break'} */ (btn.dataset.field ?? 'work');
        startTimerDurationEdit(card, field, btn);
      }
    }
  };

  /** @param {MouseEvent} e */
  const onTimerCardDblClick = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.timer-name')) return;
    const card = target.closest('.timer-card');
    if (card instanceof HTMLElement) startTimerNameEdit(card);
  };

  timersListEl.addEventListener('click', onTimerCardClick);
  timersListEl.addEventListener('dblclick', onTimerCardDblClick);

  // Notification click → switch phase
  window.addEventListener('desk:phase-switch', (e) => {
    const detail = e instanceof CustomEvent ? e.detail : null;
    if (detail && typeof detail.id === 'string') switchTimerPhase(detail.id);
  });

  // Focus overlay: close on backdrop click, Esc, or × button; otherwise the
  // clone's controls behave exactly like the canonical card.
  focusOverlay.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('.focus-close') || t === focusOverlay) exitFocusMode();
    else onTimerCardClick(e);
  });
  focusOverlay.addEventListener('dblclick', onTimerCardDblClick);

  // Hide toast and close focus overlay on Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.focusedTimerId) exitFocusMode();
      else if (!noteFocusOverlay.hidden) exitNoteFocus();
      else hideToast(true);
    }
  });

  // Re-render on storage changes from another tab
  window.addEventListener('storage', () => renderTimers());
};

export const setupEventListeners = () => {
  wireComposer();
  wireTaskList();
  wireFilters();
  wireClearCompleted();
  wireCopyTasks();
  wireOutsideClicks();
  wireGlobalKeys();
  wireTimers();
  wireNoteFocus();
  setupDragDrop();
  setupAudioUnlock();
};
