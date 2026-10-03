// @ts-check

import { parseEstimate, normalizeURL } from './utils.js';
import { openTaskEditor, wireTaskEditor } from './task-editor.js';
import { loadTasks, loadTimers, loadNotes, saveTimers } from './storage.js';
import { renderTasks } from './tasks.js';
import {
  renderCategoryPicker,
  openCategoryPicker,
  setCategoryButton,
  closeCategoryPicker,
} from './task-categories.js';
import { positionPopover, wirePopoverMenu } from './popovers.js';
import { renderNotes } from './notes.js';
import { state } from './state.js';
import {
  composer,
  taskInput,
  taskList,
  filtersEl,
  clearBtn,
  timersListEl,
  addTimerBtn,
  $,
  qs,
} from './dom.js';
import {
  addTask,
  toggleTask,
  requestDeleteTask,
  cancelPendingTaskDelete,
  clearCompleted,
  setFilter,
  toggleShowAllCompleted,
  copyVisibleTasks,
  setCategoryFilter,
  clearTaskSelection,
  toggleTaskSelection,
  selectAllLater,
  moveSelectedTasks,
  setTaskCategory,
  currentDraftCategory,
} from './tasks.js';
import { copyBtn, focusOverlay, noteFocusOverlay } from './dom.js';
import { showToast } from './toast.js';
import {
  toggleTimerPaused,
  addTimer,
  resetTimerPhase,
  switchTimerPhase,
  requestDeleteTimer,
  cancelPendingTimerDelete,
  startTimerNameEdit,
  startTimerDurationEdit,
  startTimerTimeEdit,
  renderTimers,
  enterFocusMode,
  exitFocusMode,
} from './timers.js';
import { cancelPendingNoteDelete, exitNoteFocus, wireNoteFocus } from './notes.js';
import { hideToast } from './toast.js';
import { setupDragDrop } from './dragdrop.js';
import { setupAudioUnlock } from './audio.js';
import { wireReorder } from './reorder.js';

const wireComposer = () => {
  const categoryButton = /** @type {HTMLButtonElement} */ (
    document.querySelector('#newTaskCategory')
  );
  categoryButton.addEventListener('click', () => {
    openCategoryPicker(categoryButton, currentDraftCategory(), (category) => {
      state.draftTaskCategory = category;
      setCategoryButton(categoryButton, category, 'Категория новой задачи');
      taskInput.focus();
    });
  });
  const estimateInput = /** @type {HTMLInputElement} */ (document.querySelector('#taskEstimate'));
  const linkInput = /** @type {HTMLInputElement} */ (document.querySelector('#taskLink'));
  const linkName = /** @type {HTMLInputElement} */ (document.querySelector('#taskLinkName'));
  const estimatePanel = /** @type {HTMLElement} */ (
    document.querySelector('#composerEstimatePanel')
  );
  const linkPanel = /** @type {HTMLElement} */ (document.querySelector('#composerLinkPanel'));
  const estimateButton = /** @type {HTMLButtonElement} */ (
    document.querySelector('#toggleTaskEstimate')
  );
  const linkButton = /** @type {HTMLButtonElement} */ (document.querySelector('#toggleTaskLink'));
  const meta = /** @type {HTMLElement} */ (document.querySelector('#composerMeta'));
  /** @type {{label: string, url: string}[]} */
  let draftLinks = [];
  const removeIcon =
    '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>';

  /** @param {'estimate' | 'link' | null} panel */
  const showPanel = (panel) => {
    estimatePanel.hidden = panel !== 'estimate' && !estimateInput.value.trim();
    linkPanel.hidden = panel !== 'link';
    estimateButton.setAttribute('aria-expanded', String(!estimatePanel.hidden));
    linkButton.setAttribute('aria-expanded', String(panel === 'link'));
    if (panel === 'estimate') estimateInput.focus();
    if (panel === 'link') linkInput.focus();
  };
  /** @param {string} label @param {string} removeLabel @param {() => void} remove */
  const addChip = (label, removeLabel, remove) => {
    const chip = document.createElement('span');
    chip.className = 'composer-chip';
    const text = document.createElement('span');
    text.textContent = label;
    text.title = label;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', removeLabel);
    button.innerHTML = removeIcon;
    button.addEventListener('click', remove);
    chip.append(text, button);
    meta.append(chip);
  };
  const refreshMeta = () => {
    meta.replaceChildren();
    draftLinks.forEach((link, index) =>
      addChip(link.label, `Убрать ссылку «${link.label}»`, () => {
        draftLinks.splice(index, 1);
        refreshMeta();
        linkButton.focus();
      }),
    );
    meta.hidden = !meta.children.length;
  };
  const clearPendingLink = () => {
    linkInput.value = '';
    linkName.value = '';
    linkInput.setCustomValidity('');
  };
  const attachLink = () => {
    const url = normalizeURL(linkInput.value);
    linkInput.setCustomValidity(url ? '' : 'Введите адрес сайта, например https://example.com');
    if (!url) {
      showPanel('link');
      linkInput.reportValidity();
      return false;
    }
    draftLinks.push({ label: linkName.value.trim() || new URL(url).hostname, url });
    clearPendingLink();
    showPanel(null);
    refreshMeta();
    taskInput.focus();
    return true;
  };
  const validateEstimate = () => {
    const valid = !estimateInput.value.trim() || !!parseEstimate(estimateInput.value);
    estimateInput.setCustomValidity(valid ? '' : 'Например: 30 мин, 1–2 ч или 30 мин – 1 ч');
    if (!valid) {
      showPanel('estimate');
      estimateInput.reportValidity();
    }
    return valid;
  };
  estimateButton.addEventListener('click', () => {
    showPanel(estimatePanel.hidden || estimateInput.value.trim() ? 'estimate' : null);
  });
  linkButton.addEventListener('click', () => {
    showPanel(linkPanel.hidden ? 'link' : null);
  });
  const applyEstimate = () => {
    if (!validateEstimate()) return;
    showPanel(null);
    refreshMeta();
    taskInput.focus();
  };
  estimatePanel.addEventListener('keydown', (event) => {
    if (
      event.key === 'Enter' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.target === estimateInput
    ) {
      event.preventDefault();
      applyEstimate();
    }
  });
  document.querySelector('#attachTaskLink')?.addEventListener('click', attachLink);
  document.querySelector('#cancelTaskLink')?.addEventListener('click', () => {
    clearPendingLink();
    showPanel(null);
    linkButton.focus();
  });
  linkPanel.addEventListener('keydown', (event) => {
    if (
      event.key === 'Enter' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      (event.target === linkInput || event.target === linkName)
    ) {
      event.preventDefault();
      attachLink();
    }
  });
  /** @param {boolean} prepend */
  const submit = (prepend) => {
    if (!taskInput.value.trim() || !validateEstimate()) return;
    if ((linkInput.value.trim() || linkName.value.trim()) && !attachLink()) return;
    const category = currentDraftCategory();
    state.draftTaskCategory = undefined;
    addTask(taskInput.value, prepend, parseEstimate(estimateInput.value), draftLinks, category);
    taskInput.value = '';
    estimateInput.value = '';
    draftLinks = [];
    clearPendingLink();
    showPanel(null);
    refreshMeta();
    taskInput.focus();
  };
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(false);
  });
  estimateInput.addEventListener('input', () => {
    estimateInput.setCustomValidity('');
    refreshMeta();
  });
  linkInput.addEventListener('input', () => linkInput.setCustomValidity(''));
  taskInput.addEventListener('paste', (event) => {
    const pasted = event.clipboardData?.getData('text/plain') ?? '';
    const url = normalizeURL(pasted);
    if (
      url &&
      taskInput.value &&
      taskInput.selectionStart === 0 &&
      taskInput.selectionEnd === taskInput.value.length
    ) {
      event.preventDefault();
      draftLinks.push({ label: new URL(url).hostname, url });
      refreshMeta();
    }
  });
  composer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault();
      submit(true);
    } else if (e.key === 'Escape' && !estimatePanel.hidden) {
      e.preventDefault();
      showPanel(null);
      estimateButton.focus();
    } else if (e.key === 'Escape' && !linkPanel.hidden) {
      e.preventDefault();
      clearPendingLink();
      showPanel(null);
      linkButton.focus();
    }
  });
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && estimatePanel.hidden && linkPanel.hidden) {
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
    const categoryButton = target.closest('.task-category-mark');
    if (categoryButton instanceof HTMLButtonElement) {
      const task = state.tasks.find((item) => item.id === id);
      if (task)
        openCategoryPicker(categoryButton, task.category, (category) =>
          setTaskCategory(id, category),
        );
    } else if (target.closest('.check')) {
      if (state.filter === 'later') toggleTaskSelection(id);
      else toggleTask(id);
    } else if (target.closest('.delete')) requestDeleteTask(li, id);
    else if (target.closest('.task-edit-button')) openTaskEditor(id);
  });

  taskList.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('.task-show-all')) {
      toggleShowAllCompleted();
    }
  });

  taskList.addEventListener('dblclick', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, .handle')) return;
    const li = target.closest('.task');
    if (!li || !(li instanceof HTMLElement)) return;
    if (li.dataset.id) openTaskEditor(li.dataset.id);
  });
};

const wireFilters = () => {
  const categories = /** @type {HTMLElement} */ (document.querySelector('#taskCategories'));
  renderCategoryPicker(categories, state.categoryFilter, true);
  categories.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const category = button.dataset.category;
    if (category !== 'all' && category !== 'work' && category !== 'personal') return;
    setCategoryFilter(category);
    qs(`button[data-category="${category}"]`, categories)?.focus();
  });
  filtersEl.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('.filter');
    if (!(btn instanceof HTMLElement)) return;
    const f = btn.dataset.filter;
    if (f === 'all' || f === 'active' || f === 'completed' || f === 'later') setFilter(f);
  });
};

const focusTaskSelectionExit = () => {
  const more = $('#taskSelectionMore');
  (more && !more.hidden ? more : $('[data-filter="later"]'))?.focus({ preventScroll: true });
};

const wireTaskSelection = () => {
  const menu = /** @type {HTMLElement} */ ($('#taskSelectionMenu'));
  const more = /** @type {HTMLButtonElement} */ ($('#taskSelectionMore'));
  /** @param {boolean} [restoreFocus] */
  const closeMenu = (restoreFocus = false) => {
    if (menu.matches(':popover-open')) menu.hidePopover();
    more.setAttribute('aria-expanded', 'false');
    if (restoreFocus) focusTaskSelectionExit();
  };
  wirePopoverMenu(menu, closeMenu);
  more.addEventListener('click', () => {
    if (menu.matches(':popover-open')) {
      closeMenu(true);
      return;
    }
    closeCategoryPicker();
    const buttons = [...menu.querySelectorAll('button')].filter((button) => !button.disabled);
    buttons.forEach((button, index) => {
      button.tabIndex = index === 0 ? 0 : -1;
    });
    more.setAttribute('aria-expanded', 'true');
    menu.showPopover();
    positionPopover(menu, more, 'end');
    buttons[0]?.focus({ preventScroll: true });
  });
  document.querySelector('#cancelTaskSelection')?.addEventListener('click', () => {
    closeMenu();
    clearTaskSelection();
    focusTaskSelectionExit();
  });
  document.querySelector('#selectAllLater')?.addEventListener('click', () => {
    closeMenu();
    selectAllLater();
    focusTaskSelectionExit();
  });
  document.querySelector('#moveSelectedTasks')?.addEventListener('click', () => {
    moveSelectedTasks();
    focusTaskSelectionExit();
  });
  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      state.selectedTaskIds.size &&
      !document.querySelector('dialog[open]')
    ) {
      clearTaskSelection();
      focusTaskSelectionExit();
    }
  });
};

const wireClearCompleted = () => {
  clearBtn.addEventListener('click', clearCompleted);
};

const wireCopyTasks = () => {
  copyBtn.addEventListener('click', async () => {
    const ok = await copyVisibleTasks();
    showToast(ok ? 'Задачи скопированы' : 'Не удалось скопировать задачи', null, 'Закрыть');
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
    if (document.querySelector('dialog[open]')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      taskInput.focus();
      taskInput.select();
      return;
    }
    const target = e.target;
    const tag = (target instanceof Element ? target.tagName : '').toLowerCase();
    if (['input', 'textarea', 'select', 'button', 'a', 'summary'].includes(tag)) return;
    if (target instanceof HTMLElement && target.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;
    taskInput.focus();
  });
};

const wireTimers = () => {
  wireReorder({
    list: timersListEl,
    cardSelector: '.timer-card',
    handleSelector: '.timer-move',
    items: () => state.timers,
    save: saveTimers,
    render: renderTimers,
  });
  addTimerBtn.addEventListener('click', (e) => {
    const t = e.shiftKey ? 'pomodoro' : 'work';
    addTimer(t);
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
    else if (target.closest('.timer-phase-switch')) switchTimerPhase(id);
    else if (target.closest('.timer-delete')) requestDeleteTimer(id);
    else if (target.closest('.timer-expand')) enterFocusMode(id);
    else if (target.closest('.timer-time')) {
      startTimerTimeEdit(card);
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
  focusOverlay.addEventListener('cancel', (event) => {
    event.preventDefault();
    exitFocusMode();
  });

  // Hide toast and close focus overlay on Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.focusedTimerId) exitFocusMode();
      else if (!noteFocusOverlay.hidden) exitNoteFocus();
      else hideToast(true);
    }
  });

  // Re-render on storage changes from another tab
  window.addEventListener('storage', () => {
    if (
      document.querySelector('dialog[open]') ||
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    )
      return;
    state.tasks = loadTasks();
    state.timers = loadTimers();
    state.notes = loadNotes();
    renderTasks();
    renderTimers();
    renderNotes();
  });
};

export const setupEventListeners = () => {
  wireTaskEditor();
  wireComposer();
  wireTaskList();
  wireFilters();
  wireTaskSelection();
  wireClearCompleted();
  wireCopyTasks();
  wireOutsideClicks();
  wireGlobalKeys();
  wireTimers();
  wireNoteFocus();
  setupDragDrop();
  setupAudioUnlock();
};
