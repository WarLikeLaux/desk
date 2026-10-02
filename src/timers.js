// @ts-check
/** @typedef {import('./types.js').Timer} Timer */
/** @typedef {import('./types.js').TimerPhase} TimerPhase */
/** @typedef {import('./types.js').TimerType} TimerType */

import { state } from './state.js';
import { saveTimers } from './storage.js';
import { formatMMSS, formatDuration, generateId, parseDuration, parseMMSS } from './utils.js';
import { showToast, hideToast } from './toast.js';
import { playBeep } from './audio.js';
import { fireBrowserNotification } from './notifications.js';
import { timersCountEl, timersListEl, focusOverlay, qs } from './dom.js';

const RING_CIRCUMFERENCE = 2 * Math.PI * 50;
const RING_RADIUS = 50;
const PENDING_DELETE_TIMEOUT_MS = 3000;
const TICK_INTERVAL_MS = 250;

/** @param {TimerType} [type='pomodoro'] @returns {Timer} */
export const createDefaultTimer = (type = 'pomodoro') => {
  const idx = state.timers.length;
  const isFirst = idx === 0;
  const nameBase = type === 'pomodoro' ? 'Pomodoro' : 'Таймер';
  return {
    id: generateId('tm'),
    name: isFirst ? nameBase : `${nameBase} ${idx + 1}`,
    type,
    workDuration: type === 'work' ? 8 * 3600 : 52 * 60,
    breakDuration: 17 * 60,
    phase: 'work',
    startedAt: Date.now(),
    paused: false,
    pausedAt: null,
    pausedDuration: 0,
    expired: false,
  };
};

/** @param {Timer} timer */
const getPhaseDuration = (timer) => {
  if (timer.type === 'work') return timer.workDuration;
  return timer.phase === 'work' ? timer.workDuration : timer.breakDuration;
};

/** @param {Timer} timer @returns {number} */
const getRemainingSeconds = (timer) => {
  const total = getPhaseDuration(timer);
  let elapsedMs;
  if (timer.paused) {
    const ref = timer.pausedAt ?? Date.now();
    elapsedMs = ref - timer.startedAt - timer.pausedDuration;
  } else {
    elapsedMs = Date.now() - timer.startedAt - timer.pausedDuration;
  }
  return Math.max(0, Math.ceil(total - elapsedMs / 1000));
};

/** @param {Timer} timer */
const updateTimerDisplay = (timer, root = timersListEl) => {
  const card = qs(`.timer-card[data-id="${timer.id}"]`, root);
  if (!card) return;
  const remaining = getRemainingSeconds(timer);
  const total = getPhaseDuration(timer);
  const timeEl = qs('.timer-time', card);
  if (timeEl) {
    timeEl.textContent = formatMMSS(remaining);
    timeEl.classList.toggle('has-hours', remaining >= 3600);
  }
  card.classList.toggle('is-paused', timer.paused && !timer.expired);
  card.classList.toggle('is-expired', timer.expired);
  card.classList.toggle('is-break', timer.phase === 'break');
  card.classList.toggle('is-work', timer.type === 'work');
  const phaseEl = qs('.timer-phase', card);
  if (phaseEl) phaseEl.textContent = timer.phase === 'work' ? 'работа' : 'перерыв';
  const ringProgress = qs('.timer-ring-progress', card);
  if (ringProgress instanceof SVGElement) {
    const progress = timer.expired
      ? 1
      : total > 0
        ? Math.max(0, Math.min(1, 1 - remaining / total))
        : 0;
    ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
  }
  const toggleBtn = qs('.timer-toggle', card);
  if (toggleBtn) {
    if (timer.expired) {
      toggleBtn.textContent = '↻';
      toggleBtn.title = 'Сбросить';
    } else {
      toggleBtn.textContent = timer.paused ? '▶' : '⏸';
      toggleBtn.title = timer.paused ? 'Запустить' : 'Пауза';
    }
  }
  // Keep the focus-mode clone in sync with the canonical card.
  if (root === timersListEl && state.focusedTimerId === timer.id) {
    updateTimerDisplay(timer, focusOverlay);
  }
};

/** @param {Timer} timer */
const onPhaseEnd = (timer) => {
  playBeep(timer.phase === 'work' ? 'work' : 'break');
  fireBrowserNotification(timer);
  const wasPhase = timer.phase === 'work' ? 'Работа' : 'Перерыв';
  const isSinglePhase = timer.type === 'work';
  showToast(
    `${wasPhase} заверш${timer.phase === 'work' ? 'а' : ''}`,
    isSinglePhase ? null : () => switchTimerPhase(timer.id),
    isSinglePhase ? 'Закрыть' : '→ Перерыв',
  );
  triggerPhaseFlash(timer.id);
  const card = qs(`.timer-card[data-id="${timer.id}"]`, timersListEl);
  if (card) card.classList.add('is-expired');
};

/** @param {string} id */
const triggerPhaseFlash = (id) => {
  const card = qs(`.timer-card[data-id="${id}"]`, timersListEl);
  if (!card) return;
  card.classList.remove('phase-flash');
  void card.offsetWidth;
  card.classList.add('phase-flash');
};

/** @param {TimerType} [type] */
export const addTimer = (type) => {
  const timer = createDefaultTimer(type);
  state.timers.push(timer);
  saveTimers();
  renderTimers();
  updateTimerDisplay(timer);
};

/** @param {string} id */
const actuallyDeleteTimer = (id) => {
  state.timers = state.timers.filter((t) => t.id !== id);
  state.pendingTimerDeleteId = null;
  if (state.pendingTimerDeleteTimerId) clearTimeout(state.pendingTimerDeleteTimerId);
  saveTimers();
  renderTimers();
};

/** @param {string} id */
export const requestDeleteTimer = (id) => {
  if (state.pendingTimerDeleteId === id) {
    actuallyDeleteTimer(id);
    return;
  }
  document.querySelectorAll('.timer-card.is-confirming').forEach((el) => {
    el.classList.remove('is-confirming');
    const b = el.querySelector('.timer-delete');
    if (b) b.textContent = '×';
  });
  const card = qs(`.timer-card[data-id="${id}"]`, timersListEl);
  if (!card) return;
  card.classList.add('is-confirming');
  const btn = qs('.timer-delete', card);
  if (btn) btn.textContent = '× удалить?';
  state.pendingTimerDeleteId = id;
  if (state.pendingTimerDeleteTimerId) clearTimeout(state.pendingTimerDeleteTimerId);
  state.pendingTimerDeleteTimerId = setTimeout(
    () => cancelPendingTimerDelete(),
    PENDING_DELETE_TIMEOUT_MS,
  );
};

export const cancelPendingTimerDelete = () => {
  if (!state.pendingTimerDeleteId) return;
  const card = qs(`.timer-card[data-id="${state.pendingTimerDeleteId}"]`, timersListEl);
  if (card) {
    card.classList.remove('is-confirming');
    const btn = qs('.timer-delete', card);
    if (btn) btn.textContent = '×';
  }
  state.pendingTimerDeleteId = null;
  if (state.pendingTimerDeleteTimerId) clearTimeout(state.pendingTimerDeleteTimerId);
  state.pendingTimerDeleteTimerId = null;
};

/** @param {string} id */
export const toggleTimerPaused = (id) => {
  const timer = state.timers.find((t) => t.id === id);
  if (!timer) return;
  if (timer.expired) {
    resetTimerPhase(id);
    return;
  }
  if (timer.paused) {
    timer.pausedDuration += Date.now() - (timer.pausedAt ?? Date.now());
    timer.pausedAt = null;
    timer.paused = false;
  } else {
    timer.pausedAt = Date.now();
    timer.paused = true;
  }
  saveTimers();
  const card = qs(`.timer-card[data-id="${id}"]`, timersListEl);
  if (card) card.classList.toggle('is-paused', timer.paused);
  updateTimerDisplay(timer);
};

/** @param {string} id */
export const resetTimerPhase = (id) => {
  const timer = state.timers.find((t) => t.id === id);
  if (!timer) return;
  const now = Date.now();
  timer.startedAt = now;
  timer.pausedDuration = 0;
  timer.paused = true;
  timer.pausedAt = now;
  timer.expired = false;
  saveTimers();
  const card = qs(`.timer-card[data-id="${id}"]`, timersListEl);
  if (card) {
    card.classList.remove('is-expired');
    card.classList.add('is-paused');
  }
  updateTimerDisplay(timer);
};

/** @param {string} id */
export const switchTimerPhase = (id) => {
  const timer = state.timers.find((t) => t.id === id);
  if (!timer) return;
  // Single-phase timers have no break to switch into.
  if (timer.type === 'work') return;
  hideToast();
  const now = Date.now();
  timer.phase = timer.phase === 'work' ? 'break' : 'work';
  timer.startedAt = now;
  timer.pausedDuration = 0;
  timer.paused = true;
  timer.pausedAt = now;
  timer.expired = false;
  saveTimers();
  const card = qs(`.timer-card[data-id="${id}"]`, timersListEl);
  if (card) {
    card.classList.toggle('is-break', timer.phase === 'break');
    card.classList.remove('is-expired');
    card.classList.add('is-paused');
    const phaseEl = qs('.timer-phase', card);
    if (phaseEl) phaseEl.textContent = timer.phase === 'work' ? 'работа' : 'перерыв';
    const phaseToggle = qs('.timer-phase-toggle', card);
    if (phaseToggle) {
      phaseToggle.querySelectorAll('.timer-phase-option').forEach((opt) => {
        if (!(opt instanceof HTMLElement)) return;
        const target = opt.dataset.target;
        const active = target === timer.phase;
        opt.classList.toggle('is-active', active);
        opt.setAttribute('aria-selected', String(active));
      });
    }
    const toggleBtn = qs('.timer-toggle', card);
    if (toggleBtn) {
      toggleBtn.textContent = '▶';
      toggleBtn.title = 'Запустить';
    }
  }
  updateTimerDisplay(timer);
};

/** @param {string} id @param {string} newName */
export const renameTimer = (id, newName) => {
  const timer = state.timers.find((t) => t.id === id);
  if (!timer) return;
  const clean = newName.trim();
  if (!clean || clean === timer.name) return;
  timer.name = clean;
  saveTimers();
};

/**
 * @param {string} id
 * @param {'work' | 'break'} type
 * @param {string | number} value
 * @returns {boolean} true if the new duration was applied
 */
export const setTimerDuration = (id, type, value) => {
  const timer = state.timers.find((t) => t.id === id);
  if (!timer) return false;
  const totalSeconds = parseDuration(String(value));
  if (totalSeconds === null) return false;
  if (type === 'work') timer.workDuration = totalSeconds;
  else timer.breakDuration = totalSeconds;
  saveTimers();
  return true;
};

/** @returns {HTMLButtonElement} */
const buildFocusCloseBtn = () => {
  const closeBtn = document.createElement('button');
  closeBtn.className = 'focus-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  return closeBtn;
};

/** @param {string} id */
export const enterFocusMode = (id) => {
  const card = timersListEl.querySelector(`.timer-card[data-id="${id}"]`);
  if (!(card instanceof HTMLElement)) return;
  /** @type {HTMLElement} */
  const clone = /** @type {HTMLElement} */ (card.cloneNode(true));
  clone.classList.add('is-focus');
  clone.appendChild(buildFocusCloseBtn());
  focusOverlay.innerHTML = '';
  focusOverlay.appendChild(clone);
  focusOverlay.hidden = false;
  focusOverlay.setAttribute('aria-hidden', 'false');
  state.focusedTimerId = id;
};

export const exitFocusMode = () => {
  state.focusedTimerId = null;
  focusOverlay.innerHTML = '';
  focusOverlay.hidden = true;
  focusOverlay.setAttribute('aria-hidden', 'true');
};

/**
 * Replace the displayed remaining time with an inline editor for a paused timer.
 * On commit we shift `startedAt` so that `getRemainingSeconds` returns the new value.
 * @param {HTMLElement} card
 */
export const startTimerRemainingEdit = (card) => {
  const id = card.dataset.id;
  const timer = state.timers.find((t) => t.id === id);
  if (!timer || !id || !timer.paused || timer.expired) return;
  if (card.querySelector('.timer-time-edit')) return;
  const timeEl = card.querySelector('.timer-time');
  if (!(timeEl instanceof HTMLElement)) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'timer-time-edit';
  input.value = formatMMSS(getRemainingSeconds(timer));
  input.maxLength = 8;
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Оставшееся время (ММ:СС или Ч:ММ:СС)');

  timeEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  /** @param {boolean} save */
  const finish = (save) => {
    if (done) return;
    done = true;
    if (save) {
      const parsed = parseMMSS(input.value);
      if (parsed !== null && parsed >= 0) {
        const total = getPhaseDuration(timer);
        const newRemaining = Math.min(parsed, total);
        const elapsedMs = (total - newRemaining) * 1000;
        const refPausedAt = timer.pausedAt ?? Date.now();
        // Keep `pausedAt` anchored to "now-ish" and shift `startedAt` so the elapsed
        // portion equals `(total - newRemaining)`. This lets the ring redraw
        // immediately and survives a reload.
        timer.startedAt = refPausedAt - timer.pausedDuration - elapsedMs;
        saveTimers();
      }
    }
    const restored = document.createElement('div');
    restored.className = 'timer-time';
    const restoredRemaining = getRemainingSeconds(timer);
    restored.textContent = formatMMSS(restoredRemaining);
    restored.classList.toggle('has-hours', restoredRemaining >= 3600);
    if (input.parentNode) input.replaceWith(restored);
    // Re-trigger the ring fill animation since elapsed has changed.
    const ringProgress = card.querySelector('.timer-ring-progress');
    if (ringProgress instanceof SVGElement) updateTimerDisplay(timer);
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

/** @param {Timer} timer @returns {HTMLElement} */
const buildTimerCard = (timer) => {
  const card = document.createElement('div');
  card.className = `timer-card${timer.phase === 'break' ? ' is-break' : ''}${timer.paused ? ' is-paused' : ''}${timer.expired ? ' is-expired' : ''}${timer.type === 'work' ? ' is-work' : ''}`;
  card.dataset.id = timer.id;

  const header = document.createElement('div');
  header.className = 'timer-header';

  const name = document.createElement('span');
  name.className = 'timer-name';
  name.textContent = timer.name;
  name.title = 'Двойной клик — переименовать';
  header.appendChild(name);

  const expand = document.createElement('button');
  expand.className = 'timer-expand';
  expand.type = 'button';
  expand.setAttribute('aria-label', 'На весь экран');
  expand.title = 'На весь экран';
  expand.textContent = '⛶';
  header.appendChild(expand);

  const del = document.createElement('button');
  del.className = 'timer-delete';
  del.type = 'button';
  del.setAttribute('aria-label', 'Удалить таймер');
  del.textContent = '×';
  header.appendChild(del);

  card.appendChild(header);

  const ringWrap = document.createElement('div');
  ringWrap.className = 'timer-ring-wrap';

  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('class', 'timer-ring');
  ring.setAttribute('viewBox', '0 0 120 120');
  ring.innerHTML = `
    <circle class="timer-ring-track" cx="60" cy="60" r="${RING_RADIUS}"/>
    <circle class="timer-ring-progress" cx="60" cy="60" r="${RING_RADIUS}"
            transform="rotate(-90 60 60)"
            stroke-dasharray="${RING_CIRCUMFERENCE}"
            stroke-dashoffset="0"/>
  `;
  ringWrap.appendChild(ring);

  const timeWrap = document.createElement('div');
  timeWrap.className = 'timer-time-wrap';

  const timeEl = document.createElement('div');
  timeEl.className = 'timer-time';
  const initialRemaining = getPhaseDuration(timer);
  timeEl.textContent = formatMMSS(initialRemaining);
  timeEl.classList.toggle('has-hours', initialRemaining >= 3600);
  timeWrap.appendChild(timeEl);

  const phase = document.createElement('div');
  phase.className = 'timer-phase';
  phase.textContent = timer.phase === 'work' ? 'работа' : 'перерыв';
  timeWrap.appendChild(phase);

  ringWrap.appendChild(timeWrap);

  const display = document.createElement('div');
  display.className = 'timer-display';
  display.appendChild(ringWrap);
  card.appendChild(display);

  const durations = document.createElement('div');
  durations.className = 'timer-durations';

  const workDur = document.createElement('button');
  workDur.className = 'timer-dur';
  workDur.type = 'button';
  workDur.dataset.field = 'work';
  workDur.textContent = `${formatDuration(timer.workDuration)} работа`;
  workDur.title = 'Клик — изменить длительность работы';
  durations.appendChild(workDur);

  if (timer.type === 'pomodoro') {
    const breakDur = document.createElement('button');
    breakDur.className = 'timer-dur';
    breakDur.type = 'button';
    breakDur.dataset.field = 'break';
    breakDur.textContent = `${formatDuration(timer.breakDuration)} перерыв`;
    breakDur.title = 'Клик — изменить длительность перерыва';
    durations.appendChild(breakDur);
  }

  card.appendChild(durations);

  let phaseToggle = null;
  if (timer.type === 'pomodoro') {
    phaseToggle = document.createElement('div');
    phaseToggle.className = 'timer-phase-toggle';
    phaseToggle.setAttribute('role', 'tablist');
    phaseToggle.setAttribute('aria-label', 'Фаза таймера');

    /**
     * @param {'work' | 'break'} target
     * @param {string} label
     */
    const buildPhaseOption = (target, label) => {
      const opt = document.createElement('button');
      opt.className = `timer-phase-option${timer.phase === target ? ' is-active' : ''}`;
      opt.type = 'button';
      opt.dataset.target = target;
      opt.setAttribute('role', 'tab');
      opt.setAttribute('aria-selected', String(timer.phase === target));
      const text = document.createElement('span');
      text.className = 'timer-phase-option-label';
      text.textContent = label;
      opt.append(text);
      return opt;
    };

    phaseToggle.appendChild(buildPhaseOption('work', 'работа'));
    phaseToggle.appendChild(buildPhaseOption('break', 'перерыв'));
    card.appendChild(phaseToggle);
  }

  const controls = document.createElement('div');
  controls.className = 'timer-controls';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'timer-reset';
  resetBtn.type = 'button';
  resetBtn.textContent = '↺';
  resetBtn.title = 'Сбросить фазу';
  controls.appendChild(resetBtn);

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'timer-toggle';
  toggleBtn.type = 'button';
  if (timer.expired) {
    toggleBtn.textContent = '↻';
    toggleBtn.title = 'Сбросить';
  } else {
    toggleBtn.textContent = timer.paused ? '▶' : '⏸';
    toggleBtn.title = timer.paused ? 'Запустить' : 'Пауза';
  }
  controls.appendChild(toggleBtn);

  card.appendChild(controls);

  return card;
};

export const renderTimers = () => {
  document.querySelectorAll('.timer-card.is-confirming').forEach((el) => {
    el.classList.remove('is-confirming');
    const b = el.querySelector('.timer-delete');
    if (b) b.textContent = '×';
  });

  timersListEl.innerHTML = '';
  state.timers.forEach((timer) => timersListEl.appendChild(buildTimerCard(timer)));
  timersCountEl.textContent = String(state.timers.length);

  // Keep the focus-mode clone in sync with the canonical card.
  if (state.focusedTimerId) {
    const focusedCard = focusOverlay.querySelector('.timer-card');
    const sourceCard = timersListEl.querySelector(`.timer-card[data-id="${state.focusedTimerId}"]`);
    if (focusedCard && sourceCard) {
      const fresh = /** @type {HTMLElement} */ (sourceCard.cloneNode(true));
      fresh.classList.add('is-focus');
      fresh.appendChild(buildFocusCloseBtn());
      focusedCard.replaceWith(fresh);
    }
  }

  if (state.pendingTimerDeleteId) {
    const card = timersListEl.querySelector(`.timer-card[data-id="${state.pendingTimerDeleteId}"]`);
    if (card) {
      card.classList.add('is-confirming');
      const btn = card.querySelector('.timer-delete');
      if (btn) btn.textContent = '× удалить?';
    } else {
      state.pendingTimerDeleteId = null;
      if (state.pendingTimerDeleteTimerId) clearTimeout(state.pendingTimerDeleteTimerId);
    }
  }
};

export const tick = () => {
  /** @type {number | null} */
  let urgentRemaining = null;
  state.timers.forEach((timer) => {
    if (timer.paused || timer.expired) {
      updateTimerDisplay(timer);
      return;
    }
    let remaining = getRemainingSeconds(timer);
    let safety = 0;
    while (remaining <= 0 && safety < 100) {
      timer.expired = true;
      timer.paused = false;
      timer.pausedAt = null;
      onPhaseEnd(timer);
      remaining = getRemainingSeconds(timer);
      safety += 1;
    }
    updateTimerDisplay(timer);
    if (urgentRemaining === null || remaining < urgentRemaining) {
      urgentRemaining = remaining;
    }
  });

  // Drop the focus overlay if its timer was deleted; live updates are mirrored
  // by updateTimerDisplay itself.
  if (state.focusedTimerId && !state.timers.some((t) => t.id === state.focusedTimerId)) {
    exitFocusMode();
  }

  document.title =
    urgentRemaining !== null ? `${formatMMSS(urgentRemaining)} · Сегодня` : 'Сегодня — список дел';
};

/** Catch up timers that may have ended while the tab was closed. */
export const tickOnBoot = () => {
  let notified = false;
  for (const timer of state.timers) {
    if (timer.paused || timer.expired) continue;
    if (getRemainingSeconds(timer) <= 0) {
      timer.expired = true;
      timer.paused = false;
      timer.pausedAt = null;
      if (!notified) {
        onPhaseEnd(timer);
        notified = true;
      }
    }
  }
  saveTimers();
  renderTimers();
  state.timers.forEach((t) => updateTimerDisplay(t));
};

export const startTick = () => {
  if (state.tickIntervalId) return;
  state.tickIntervalId = setInterval(tick, TICK_INTERVAL_MS);
};

export const stopTick = () => {
  if (state.tickIntervalId) clearInterval(state.tickIntervalId);
  state.tickIntervalId = null;
};

/** @param {HTMLElement} li */
export const startTimerNameEdit = (li) => {
  const id = li.dataset.id;
  const timer = state.timers.find((t) => t.id === id);
  if (!timer) return;
  const name = li.querySelector('.timer-name');
  if (!name) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'timer-name-edit';
  input.value = timer.name;
  input.maxLength = 32;
  input.spellcheck = false;

  name.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  /** @param {boolean} save */
  const finish = (save) => {
    if (done) return;
    done = true;
    const next = save ? input.value.trim() : timer.name;
    if (save && next && id) renameTimer(id, next);
    const restored = document.createElement('span');
    restored.className = 'timer-name';
    restored.textContent = next || timer.name;
    restored.title = 'Двойной клик — переименовать';
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

/**
 * @param {HTMLElement} li
 * @param {'work' | 'break'} field
 * @param {HTMLButtonElement} btn
 */
export const startTimerDurationEdit = (li, field, btn) => {
  const id = li.dataset.id;
  const timer = state.timers.find((t) => t.id === id);
  if (!timer || !id) return;
  const current = (field === 'work' ? timer.workDuration : timer.breakDuration) / 60;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'timer-dur-edit';
  input.value = String(Math.round(current));
  input.placeholder = 'минуты или Ч:ММ';
  input.setAttribute('inputmode', 'numeric');

  btn.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const restore = () => {
    const restored = document.createElement('button');
    restored.className = 'timer-dur';
    restored.type = 'button';
    restored.dataset.field = field;
    restored.textContent = `${formatDuration(field === 'work' ? timer.workDuration : timer.breakDuration)} ${field === 'work' ? 'работа' : 'перерыв'}`;
    restored.title = 'Клик — изменить';
    if (input.parentNode) input.replaceWith(restored);
  };

  /** @param {boolean} save */
  const finish = (save) => {
    if (done) return;
    done = true;
    if (save) {
      const ok = setTimerDuration(id, field, input.value);
      if (ok) {
        renderTimers();
        return;
      }
    }
    restore();
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
