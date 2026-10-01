// ── Storage ────────────────────────────────────────────────
const TASKS_KEY = 'todolist-minimal:v2';
const TIMERS_KEY = 'todolist-minimal:timers:v2';

const loadTasks = () => {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) {
      const old = localStorage.getItem('todolist-minimal:v1');
      if (old) return JSON.parse(old).filter((t) => t && typeof t.id === 'string');
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === 'string');
  } catch {
    return [];
  }
};

const saveTasks = () => {
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
};

const loadTimers = () => {
  try {
    const raw = localStorage.getItem(TIMERS_KEY);
    if (!raw) {
      // Migrate from v1 if present
      const old = localStorage.getItem('todolist-minimal:timers:v1');
      if (old) {
        const arr = JSON.parse(old);
        if (Array.isArray(arr)) {
          return arr.filter((t) => t && typeof t.id === 'string').map((t) => ({
            ...t,
            expired: false,
          }));
        }
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.id === 'string')
      .map((t) => ({ ...t, expired: !!t.expired }));
  } catch {
    return [];
  }
};

const saveTimers = () => {
  try { localStorage.setItem(TIMERS_KEY, JSON.stringify(timers)); } catch {}
};

// ── State ──────────────────────────────────────────────────
let tasks = loadTasks();
let timers = loadTimers();
let filter = 'all';
let pendingDeleteId = null;
let pendingDeleteTimer = null;
let pendingTimerDeleteId = null;
let pendingTimerDeleteTimerId = null;
let toastTimer = null;
let tickIntervalId = null;
let audioCtx = null;
const lastAnimatedIds = new Set();

// ── DOM ────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const taskList = $('#taskList');
const taskInput = $('#taskInput');
const composer = $('#composer');
const emptyState = $('#emptyState');
const remaining = $('#remaining');
const clearBtn = $('#clearCompleted');
const clearCount = $('#clearCount');
const dateEl = $('#date');
const subtitleEl = $('#subtitle');
const progressDone = $('#progressDone');
const progressTotal = $('#progressTotal');
const filtersEl = $('#filters');
const toastEl = $('#toast');
const toastText = $('#toastText');
const toastAction = $('#toastAction');
const timersListEl = $('#timersList');
const timersCountEl = $('#timersCount');
const addTimerBtn = $('#addTimer');

// ── Date formatting (Russian) ─────────────────────────────
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const WEEKDAYS = [
  'воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота',
];
const pad = (n) => String(n).padStart(2, '0');

const formatDate = (d) =>
  `${d.getDate()} ${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;

const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const renderDate = () => {
  const now = new Date();
  dateEl.textContent = `${formatDate(now)} · ${formatTime(now)}`;
};

// ── Pluralization (Russian) ────────────────────────────────
const pluralize = (n, forms) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
};

// ── Task ordering helpers ──────────────────────────────────
const placeTaskInOrder = (task) => {
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx !== -1) tasks.splice(idx, 1);
  if (task.completed) {
    tasks.push(task);
  } else {
    const firstCompletedIdx = tasks.findIndex((t) => t.completed);
    if (firstCompletedIdx === -1) tasks.push(task);
    else tasks.splice(firstCompletedIdx, 0, task);
  }
};

// ── Task render ────────────────────────────────────────────
const visibleTasks = () => {
  if (filter === 'active') return tasks.filter((t) => !t.completed);
  if (filter === 'completed') return tasks.filter((t) => t.completed);
  return tasks;
};

const buildTaskEl = (task, index) => {
  const li = document.createElement('li');
  li.className = 'task' + (task.completed ? ' is-done' : '');
  li.draggable = true;
  li.dataset.id = task.id;
  if (lastAnimatedIds.has(task.id)) {
    li.classList.add('is-new');
    lastAnimatedIds.delete(task.id);
  }

  const handle = document.createElement('span');
  handle.className = 'handle';
  handle.setAttribute('aria-label', 'Перетащить');
  handle.innerHTML = `
    <span class="handle-dot"><span></span><span></span></span>
    <span class="handle-dot"><span></span><span></span></span>
    <span class="handle-dot"><span></span><span></span></span>
  `;
  li.appendChild(handle);

  const check = document.createElement('button');
  check.className = 'check' + (task.completed ? ' is-checked' : '');
  check.setAttribute('aria-label', task.completed ? 'Отметить как невыполненную' : 'Отметить как выполненную');
  check.type = 'button';
  check.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 8.5l3.2 3.2L13 5"/>
    </svg>
  `;
  li.appendChild(check);

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;
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

const renderTasks = () => {
  document.querySelectorAll('.task.is-confirming').forEach((el) => el.classList.remove('is-confirming'));

  const visible = visibleTasks();
  taskList.innerHTML = '';
  visible.forEach((task, i) => taskList.appendChild(buildTaskEl(task, i)));

  if (pendingDeleteId) {
    const li = taskList.querySelector(`.task[data-id="${pendingDeleteId}"]`);
    if (li) {
      li.classList.add('is-confirming');
      const btn = li.querySelector('.delete');
      if (btn) btn.textContent = 'Удалить?';
    } else {
      pendingDeleteId = null;
      if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
    }
  }

  const isEmpty = visible.length === 0;
  emptyState.hidden = !isEmpty;
  if (isEmpty) {
    if (tasks.length === 0) {
      $('#emptyTitle').textContent = 'Список пуст';
      $('#emptyHint').textContent = 'Введите первую задачу и нажмите Enter';
    } else if (filter === 'active') {
      $('#emptyTitle').textContent = 'Все задачи завершены';
      $('#emptyHint').textContent = 'Хорошая работа. Можно выдохнуть.';
    } else if (filter === 'completed') {
      $('#emptyTitle').textContent = 'Нет завершённых';
      $('#emptyHint').textContent = 'Отмечайте задачи чекбоксом, чтобы видеть их здесь';
    }
  }

  if (tasks.length === 0) {
    subtitleEl.textContent = 'Список текущих задач';
  } else {
    const active = tasks.filter((t) => !t.completed).length;
    subtitleEl.textContent = active === 0
      ? 'Все задачи на сегодня закрыты'
      : `${active} ${pluralize(active, ['задача', 'задачи', 'задач'])} в работе`;
  }

  const activeCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;
  remaining.textContent = `${activeCount} ${pluralize(activeCount, ['осталась', 'осталось', 'осталось'])}`;

  clearBtn.hidden = completedCount === 0;
  clearCount.textContent = completedCount;

  progressDone.textContent = completedCount;
  progressTotal.textContent = tasks.length;

  document.querySelectorAll('[data-count]').forEach((el) => {
    const f = el.dataset.count;
    if (f === 'all') el.textContent = tasks.length;
    if (f === 'active') el.textContent = activeCount;
    if (f === 'completed') el.textContent = completedCount;
  });
};

// ── Task actions ───────────────────────────────────────────
const addTask = (text) => {
  const clean = text.trim();
  if (!clean) return;
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const task = {
    id,
    text: clean,
    completed: false,
    createdAt: Date.now(),
  };
  const firstCompletedIdx = tasks.findIndex((t) => t.completed);
  if (firstCompletedIdx === -1) tasks.push(task);
  else tasks.splice(firstCompletedIdx, 0, task);
  lastAnimatedIds.add(id);
  saveTasks();
  renderTasks();
};

const toggleTask = (id) => {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  if (t.completed) t.completedAt = Date.now();
  else delete t.completedAt;
  placeTaskInOrder(t);
  lastAnimatedIds.add(id);
  saveTasks();
  renderTasks();
};

const actuallyDeleteTask = (id) => {
  tasks = tasks.filter((t) => t.id !== id);
  pendingDeleteId = null;
  if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
  saveTasks();
  renderTasks();
};

const requestDeleteTask = (li, id) => {
  if (pendingDeleteId === id) {
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
  pendingDeleteId = id;
  if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
  pendingDeleteTimer = setTimeout(() => cancelPendingTaskDelete(), 3000);
};

const cancelPendingTaskDelete = () => {
  if (!pendingDeleteId) return;
  const li = taskList.querySelector(`.task[data-id="${pendingDeleteId}"]`);
  if (li) {
    li.classList.remove('is-confirming');
    const b = li.querySelector('.delete');
    if (b) b.textContent = '×';
  }
  pendingDeleteId = null;
  if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
  pendingDeleteTimer = null;
};

const clearCompleted = () => {
  const removed = tasks.filter((t) => t.completed);
  if (removed.length === 0) return;
  cancelPendingTaskDelete();
  tasks = tasks.filter((t) => !t.completed);
  saveTasks();
  renderTasks();
  showToast(
    `${pluralize(removed.length, ['Удалена', 'Удалены', 'Удалено'])} ${removed.length} ${pluralize(removed.length, ['задача', 'задачи', 'задач'])}`,
    () => {
      tasks = [...tasks, ...removed];
      removed.forEach((t) => lastAnimatedIds.add(t.id));
      saveTasks();
      renderTasks();
    }
  );
};

// ── Inline edit (task) ─────────────────────────────────────
const startTaskEdit = (li) => {
  if (li.querySelector('.task-edit')) return;
  const text = li.querySelector('.task-text');
  if (!text) return;
  const id = li.dataset.id;
  const task = tasks.find((t) => t.id === id);
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
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
};

// ── Toast ──────────────────────────────────────────────────
// actionLabel defaults to "Отменить" for backward compat with task toasts
const showToast = (text, onAction, actionLabel = 'Отменить') => {
  if (toastTimer) clearTimeout(toastTimer);
  toastText.textContent = text;
  toastAction.textContent = actionLabel;
  toastAction.onclick = () => {
    if (onAction) onAction();
    hideToast();
  };
  toastEl.classList.remove('hiding');
  toastEl.hidden = false;
  void toastEl.offsetWidth;
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth;
  toastEl.style.animation = '';
  toastTimer = setTimeout(() => hideToast(), 8000);
};

const hideToast = (immediate = false) => {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (toastEl.hidden) return;
  if (immediate) {
    toastEl.hidden = true;
    toastEl.classList.remove('hiding');
    return;
  }
  toastEl.classList.add('hiding');
  setTimeout(() => {
    toastEl.hidden = true;
    toastEl.classList.remove('hiding');
  }, 200);
};

// ════════════════════════════════════════════════════════════
// ── TIMERS ──────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════

const RING_CIRCUMFERENCE = 2 * Math.PI * 50;

const createDefaultTimer = () => ({
  id: `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  name: timers.length === 0 ? 'Pomodoro' : `Pomodoro ${timers.length + 1}`,
  workDuration: 52 * 60,
  breakDuration: 17 * 60,
  phase: 'work',
  startedAt: Date.now(),
  paused: false,
  pausedAt: null,
  pausedDuration: 0,
  expired: false,
});

const getRemainingSeconds = (timer) => {
  const total = getPhaseDuration(timer);
  let elapsedMs;
  if (timer.paused) {
    const ref = timer.pausedAt || Date.now();
    elapsedMs = ref - timer.startedAt - timer.pausedDuration;
  } else {
    elapsedMs = Date.now() - timer.startedAt - timer.pausedDuration;
  }
  const remaining = total - elapsedMs / 1000;
  return Math.max(0, Math.ceil(remaining));
};

const getPhaseDuration = (timer) =>
  timer.phase === 'work' ? timer.workDuration : timer.breakDuration;

const formatMMSS = (secs) => {
  const m = Math.floor(secs / 60);
  const s = Math.max(0, secs % 60);
  return `${pad(m)}:${pad(s)}`;
};

const updateTimerDisplay = (timer) => {
  const card = timersListEl.querySelector(`.timer-card[data-id="${timer.id}"]`);
  if (!card) return;
  const remaining = getRemainingSeconds(timer);
  const total = getPhaseDuration(timer);
  const timeEl = card.querySelector('.timer-time');
  if (timeEl) timeEl.textContent = formatMMSS(remaining);
  const ringProgress = card.querySelector('.timer-ring-progress');
  if (ringProgress) {
    const progress = timer.expired
      ? 1
      : total > 0 ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0;
    ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
  }
  const toggleBtn = card.querySelector('.timer-toggle');
  if (toggleBtn) {
    if (timer.expired) {
      toggleBtn.textContent = '↻';
      toggleBtn.title = 'Сбросить';
    } else {
      toggleBtn.textContent = timer.paused ? '▶' : '⏸';
      toggleBtn.title = timer.paused ? 'Запустить' : 'Пауза';
    }
  }
};

// ── Audio (Web Audio API beep) ─────────────────────────────
const ensureAudioCtx = () => {
  if (audioCtx) return audioCtx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    audioCtx = new AudioCtx();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
};

const playBeep = (variant = 'work') => {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  try {
    const tone = (freq, start, duration, gain = 0.14) => {
      const osc = ctx.createOscillator();
      const node = ctx.createGain();
      osc.connect(node);
      node.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      node.gain.setValueAtTime(0, ctx.currentTime + start);
      node.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
      node.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    // Two short tones. Ascending for work→break, descending for break→work.
    if (variant === 'work') {
      tone(660, 0, 0.18);
      tone(880, 0.20, 0.32);
    } else {
      tone(880, 0, 0.18);
      tone(660, 0.20, 0.32);
    }
  } catch {}
};

// ── Browser notifications ──────────────────────────────────
const ensureNotificationPermission = () => {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  try {
    return Notification.requestPermission().then((p) => p === 'granted').catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
};

const fireBrowserNotification = (timer) => {
  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  const wasPhase = timer.phase === 'work' ? 'работа' : 'перерыв';
  const nextPhase = timer.phase === 'work' ? 'перерыв' : 'работа';
  try {
    const n = new Notification(`${wasPhase.charAt(0).toUpperCase() + wasPhase.slice(1)} завершена`, {
      body: `Переключиться на ${nextPhase}?`,
      tag: `pomodoro-${timer.id}`,
      silent: false,
    });
    n.onclick = () => {
      switchTimerPhase(timer.id);
      try { n.close(); } catch {}
      if (window.focus) try { window.focus(); } catch {}
    };
    setTimeout(() => { try { n.close(); } catch {} }, 12000);
    return n;
  } catch {
    return null;
  }
};

// ── Phase end ──────────────────────────────────────────────
const onPhaseEnd = (timer) => {
  playBeep(timer.phase === 'work' ? 'work' : 'break');
  fireBrowserNotification(timer);
  const wasPhase = timer.phase === 'work' ? 'Работа' : 'Перерыв';
  const nextPhase = timer.phase === 'work' ? 'Перерыв' : 'Работа';
  showToast(
    `${wasPhase} заверш${timer.phase === 'work' ? 'а' : ''}`,
    () => switchTimerPhase(timer.id),
    `→ ${nextPhase}`
  );
  triggerPhaseFlash(timer.id);
  // Also briefly highlight the timer card
  const card = timersListEl.querySelector(`.timer-card[data-id="${timer.id}"]`);
  if (card) {
    card.classList.add('is-expired');
  }
};

const triggerPhaseFlash = (id) => {
  const card = timersListEl.querySelector(`.timer-card[data-id="${id}"]`);
  if (!card) return;
  card.classList.remove('phase-flash');
  void card.offsetWidth;
  card.classList.add('phase-flash');
};

// ── Timer actions ──────────────────────────────────────────
const addTimer = () => {
  const newTimer = createDefaultTimer();
  timers.push(newTimer);
  saveTimers();
  renderTimers();
  updateTimerDisplay(newTimer);
  ensureNotificationPermission();
};

const actuallyDeleteTimer = (id) => {
  timers = timers.filter((t) => t.id !== id);
  pendingTimerDeleteId = null;
  if (pendingTimerDeleteTimerId) clearTimeout(pendingTimerDeleteTimerId);
  saveTimers();
  renderTimers();
};

const requestDeleteTimer = (id) => {
  if (pendingTimerDeleteId === id) {
    actuallyDeleteTimer(id);
    return;
  }
  document.querySelectorAll('.timer-card.is-confirming').forEach((el) => {
    el.classList.remove('is-confirming');
    const b = el.querySelector('.timer-delete');
    if (b) b.textContent = '×';
  });
  const card = timersListEl.querySelector(`.timer-card[data-id="${id}"]`);
  if (!card) return;
  card.classList.add('is-confirming');
  const btn = card.querySelector('.timer-delete');
  if (btn) btn.textContent = '× удалить?';
  pendingTimerDeleteId = id;
  if (pendingTimerDeleteTimerId) clearTimeout(pendingTimerDeleteTimerId);
  pendingTimerDeleteTimerId = setTimeout(() => cancelPendingTimerDelete(), 3000);
};

const cancelPendingTimerDelete = () => {
  if (!pendingTimerDeleteId) return;
  const card = timersListEl.querySelector(`.timer-card[data-id="${pendingTimerDeleteId}"]`);
  if (card) {
    card.classList.remove('is-confirming');
    const btn = card.querySelector('.timer-delete');
    if (btn) btn.textContent = '×';
  }
  pendingTimerDeleteId = null;
  if (pendingTimerDeleteTimerId) clearTimeout(pendingTimerDeleteTimerId);
  pendingTimerDeleteTimerId = null;
};

const toggleTimerPaused = (id) => {
  const timer = timers.find((t) => t.id === id);
  if (!timer) return;
  // If expired, treat pause-button click as a reset to current phase
  if (timer.expired) {
    resetTimerPhase(id);
    return;
  }
  if (timer.paused) {
    timer.pausedDuration += Date.now() - timer.pausedAt;
    timer.pausedAt = null;
    timer.paused = false;
  } else {
    timer.pausedAt = Date.now();
    timer.paused = true;
  }
  saveTimers();
  const card = timersListEl.querySelector(`.timer-card[data-id="${id}"]`);
  if (card) card.classList.toggle('is-paused', timer.paused);
  updateTimerDisplay(timer);
};

const resetTimerPhase = (id) => {
  const timer = timers.find((t) => t.id === id);
  if (!timer) return;
  timer.startedAt = Date.now();
  timer.pausedDuration = 0;
  timer.paused = false;
  timer.pausedAt = null;
  timer.expired = false;
  saveTimers();
  const card = timersListEl.querySelector(`.timer-card[data-id="${id}"]`);
  if (card) {
    card.classList.remove('is-expired', 'is-paused');
  }
  updateTimerDisplay(timer);
};

// Manually switch phase (the "→ перерыв / → работа" button)
const switchTimerPhase = (id) => {
  const timer = timers.find((t) => t.id === id);
  if (!timer) return;
  // Hide the phase-end toast if it was showing for this timer
  hideToast();
  timer.phase = timer.phase === 'work' ? 'break' : 'work';
  timer.startedAt = Date.now();
  timer.pausedDuration = 0;
  timer.paused = false;
  timer.pausedAt = null;
  timer.expired = false;
  saveTimers();
  // Update card in place to preserve any pending delete state etc.
  const card = timersListEl.querySelector(`.timer-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle('is-break', timer.phase === 'break');
    card.classList.remove('is-expired', 'is-paused');
    const phaseEl = card.querySelector('.timer-phase');
    if (phaseEl) phaseEl.textContent = timer.phase === 'work' ? 'работа' : 'перерыв';
    const phaseBtn = card.querySelector('.timer-phase-btn');
    if (phaseBtn) phaseBtn.textContent = timer.phase === 'work' ? '→ перерыв' : '→ работа';
    const toggleBtn = card.querySelector('.timer-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = '⏸';
      toggleBtn.title = 'Пауза';
    }
  }
  updateTimerDisplay(timer);
};

const renameTimer = (id, newName) => {
  const timer = timers.find((t) => t.id === id);
  if (!timer) return;
  const clean = newName.trim();
  if (!clean || clean === timer.name) return;
  timer.name = clean;
  saveTimers();
};

const setTimerDuration = (id, type, value) => {
  const timer = timers.find((t) => t.id === id);
  if (!timer) return false;
  const mins = parseInt(value, 10);
  if (isNaN(mins) || mins < 1 || mins > 240) return false;
  if (type === 'work') timer.workDuration = mins * 60;
  else timer.breakDuration = mins * 60;
  saveTimers();
  return true;
};

// ── Timer render ───────────────────────────────────────────
const renderTimers = () => {
  document.querySelectorAll('.timer-card.is-confirming').forEach((el) => {
    el.classList.remove('is-confirming');
    const b = el.querySelector('.timer-delete');
    if (b) b.textContent = '×';
  });

  timersListEl.innerHTML = '';
  timers.forEach((timer) => timersListEl.appendChild(buildTimerCard(timer)));
  timersCountEl.textContent = timers.length;

  if (pendingTimerDeleteId) {
    const card = timersListEl.querySelector(`.timer-card[data-id="${pendingTimerDeleteId}"]`);
    if (card) {
      card.classList.add('is-confirming');
      const btn = card.querySelector('.timer-delete');
      if (btn) btn.textContent = '× удалить?';
    } else {
      pendingTimerDeleteId = null;
      if (pendingTimerDeleteTimerId) clearTimeout(pendingTimerDeleteTimerId);
    }
  }
};

const buildTimerCard = (timer) => {
  const card = document.createElement('div');
  card.className = 'timer-card' +
    (timer.phase === 'break' ? ' is-break' : '') +
    (timer.paused ? ' is-paused' : '') +
    (timer.expired ? ' is-expired' : '');
  card.dataset.id = timer.id;

  // Header
  const header = document.createElement('div');
  header.className = 'timer-header';

  const name = document.createElement('span');
  name.className = 'timer-name';
  name.textContent = timer.name;
  name.title = 'Двойной клик — переименовать';
  header.appendChild(name);

  const del = document.createElement('button');
  del.className = 'timer-delete';
  del.type = 'button';
  del.setAttribute('aria-label', 'Удалить таймер');
  del.textContent = '×';
  header.appendChild(del);

  card.appendChild(header);

  // Ring + time display
  const display = document.createElement('div');
  display.className = 'timer-display';

  const ringWrap = document.createElement('div');
  ringWrap.className = 'timer-ring-wrap';

  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('class', 'timer-ring');
  ring.setAttribute('viewBox', '0 0 120 120');
  ring.innerHTML = `
    <circle class="timer-ring-track" cx="60" cy="60" r="50"/>
    <circle class="timer-ring-progress" cx="60" cy="60" r="50"
            transform="rotate(-90 60 60)"
            stroke-dasharray="${RING_CIRCUMFERENCE}"
            stroke-dashoffset="0"/>
  `;
  ringWrap.appendChild(ring);

  const timeWrap = document.createElement('div');
  timeWrap.className = 'timer-time-wrap';

  const time = document.createElement('div');
  time.className = 'timer-time';
  time.textContent = formatMMSS(getPhaseDuration(timer));
  timeWrap.appendChild(time);

  const phase = document.createElement('div');
  phase.className = 'timer-phase';
  phase.textContent = timer.phase === 'work' ? 'работа' : 'перерыв';
  timeWrap.appendChild(phase);

  ringWrap.appendChild(timeWrap);
  display.appendChild(ringWrap);
  card.appendChild(display);

  // Durations
  const durations = document.createElement('div');
  durations.className = 'timer-durations';

  const workDur = document.createElement('button');
  workDur.className = 'timer-dur';
  workDur.type = 'button';
  workDur.dataset.field = 'work';
  workDur.textContent = `${timer.workDuration / 60} мин работа`;
  workDur.title = 'Клик — изменить длительность работы';
  durations.appendChild(workDur);

  const breakDur = document.createElement('button');
  breakDur.className = 'timer-dur';
  breakDur.type = 'button';
  breakDur.dataset.field = 'break';
  breakDur.textContent = `${timer.breakDuration / 60} мин перерыв`;
  breakDur.title = 'Клик — изменить длительность перерыва';
  durations.appendChild(breakDur);

  card.appendChild(durations);

  // Controls: [reset] [pause] [phase switch]
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

  const phaseBtn = document.createElement('button');
  phaseBtn.className = 'timer-phase-btn';
  phaseBtn.type = 'button';
  phaseBtn.textContent = timer.phase === 'work' ? '→ перерыв' : '→ работа';
  phaseBtn.title = 'Переключить фазу';
  controls.appendChild(phaseBtn);

  card.appendChild(controls);

  return card;
};

// ── Timer inline edit ──────────────────────────────────────
const startTimerNameEdit = (id) => {
  const timer = timers.find((t) => t.id === id);
  if (!timer) return;
  const card = timersListEl.querySelector(`.timer-card[data-id="${id}"]`);
  if (!card) return;
  const name = card.querySelector('.timer-name');
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
  const finish = (save) => {
    if (done) return;
    done = true;
    const next = save ? input.value.trim() : timer.name;
    if (save && next) {
      timer.name = next;
      saveTimers();
    }
    const restored = document.createElement('span');
    restored.className = 'timer-name';
    restored.textContent = next || timer.name;
    restored.title = 'Двойной клик — переименовать';
    if (input.parentNode) input.replaceWith(restored);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
};

const startTimerDurationEdit = (id, field, btn) => {
  const timer = timers.find((t) => t.id === id);
  if (!timer) return;
  const current = (field === 'work' ? timer.workDuration : timer.breakDuration) / 60;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'timer-dur-edit';
  input.value = current;
  input.min = 1;
  input.max = 240;
  input.step = 1;

  btn.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const restore = () => {
    const restored = document.createElement('button');
    restored.className = 'timer-dur';
    restored.type = 'button';
    restored.dataset.field = field;
    restored.textContent = `${(field === 'work' ? timer.workDuration : timer.breakDuration) / 60} мин ${field === 'work' ? 'работа' : 'перерыв'}`;
    restored.title = 'Клик — изменить';
    if (input.parentNode) input.replaceWith(restored);
  };

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
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
};

// ── Timer tick ─────────────────────────────────────────────
const tick = () => {
  let urgentRemaining = null;
  timers.forEach((timer) => {
    if (timer.paused || timer.expired) {
      updateTimerDisplay(timer);
      return;
    }
    const remaining = getRemainingSeconds(timer);
    if (remaining <= 0) {
      timer.expired = true;
      timer.paused = false;
      timer.pausedAt = null;
      saveTimers();
      onPhaseEnd(timer);
    } else {
      updateTimerDisplay(timer);
      if (urgentRemaining === null || remaining < urgentRemaining) {
        urgentRemaining = remaining;
      }
    }
  });

  document.title = urgentRemaining !== null
    ? `${formatMMSS(urgentRemaining)} · Сегодня`
    : 'Сегодня — список дел';
};

const startTick = () => {
  if (tickIntervalId) return;
  tickIntervalId = setInterval(tick, 250);
};

// ── Events: composer ───────────────────────────────────────
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

// ── Events: task list ──────────────────────────────────────
taskList.addEventListener('click', (e) => {
  const li = e.target.closest('.task');
  if (!li) return;
  const id = li.dataset.id;
  if (e.target.closest('.check')) toggleTask(id);
  else if (e.target.closest('.delete')) requestDeleteTask(li, id);
});

taskList.addEventListener('dblclick', (e) => {
  if (e.target.closest('.check')) return;
  if (e.target.closest('.handle')) return;
  if (e.target.closest('.delete')) return;
  const li = e.target.closest('.task');
  if (!li) return;
  startTaskEdit(li);
});

// ── Events: filters ────────────────────────────────────────
filtersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  filter = btn.dataset.filter;
  document.querySelectorAll('.filter').forEach((f) => f.classList.remove('is-active'));
  btn.classList.add('is-active');
  cancelPendingTaskDelete();
  renderTasks();
});

clearBtn.addEventListener('click', clearCompleted);

document.addEventListener('click', (e) => {
  if (pendingDeleteId && !e.target.closest(`.task[data-id="${pendingDeleteId}"]`)) {
    requestAnimationFrame(() => {
      if (pendingDeleteId) cancelPendingTaskDelete();
    });
  }
  if (pendingTimerDeleteId && !e.target.closest(`.timer-card[data-id="${pendingTimerDeleteId}"]`)) {
    requestAnimationFrame(() => {
      if (pendingTimerDeleteId) cancelPendingTimerDelete();
    });
  }
});

// ── Events: timers ─────────────────────────────────────────
addTimerBtn.addEventListener('click', addTimer);

timersListEl.addEventListener('click', (e) => {
  const card = e.target.closest('.timer-card');
  if (!card) return;
  const id = card.dataset.id;
  if (e.target.closest('.timer-toggle')) toggleTimerPaused(id);
  else if (e.target.closest('.timer-reset')) resetTimerPhase(id);
  else if (e.target.closest('.timer-phase-btn')) switchTimerPhase(id);
  else if (e.target.closest('.timer-delete')) requestDeleteTimer(id);
  else if (e.target.closest('.timer-dur')) {
    const btn = e.target.closest('.timer-dur');
    startTimerDurationEdit(id, btn.dataset.field, btn);
  }
});

timersListEl.addEventListener('dblclick', (e) => {
  if (e.target.closest('.timer-name')) {
    const card = e.target.closest('.timer-card');
    if (card) startTimerNameEdit(card.dataset.id);
  }
});

// ── Events: global keydown ─────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    taskInput.focus();
    taskInput.select();
    return;
  }
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length !== 1) return;
  taskInput.focus();
});

// ── Drag & drop (tasks) ────────────────────────────────────
let dragId = null;

const clearDropMarkers = () => {
  document.querySelectorAll('.drop-target, .drop-target-below').forEach((el) => {
    el.classList.remove('drop-target', 'drop-target-below');
  });
};

taskList.addEventListener('dragstart', (e) => {
  if (e.target.closest('.task-edit')) {
    e.preventDefault();
    return;
  }
  const li = e.target.closest('.task');
  if (!li) return;
  dragId = li.dataset.id;
  li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', dragId); } catch {}
});

taskList.addEventListener('dragend', (e) => {
  const li = e.target.closest('.task');
  if (li) li.classList.remove('dragging');
  clearDropMarkers();
  dragId = null;
});

taskList.addEventListener('dragover', (e) => {
  e.preventDefault();
  const li = e.target.closest('.task');
  if (!li || !dragId || li.dataset.id === dragId) return;
  clearDropMarkers();
  const rect = li.getBoundingClientRect();
  const isAbove = (e.clientY - rect.top) < rect.height / 2;
  if (isAbove) li.classList.add('drop-target');
  else li.classList.add('drop-target-below');
});

taskList.addEventListener('dragleave', (e) => {
  if (!taskList.contains(e.relatedTarget)) clearDropMarkers();
});

taskList.addEventListener('drop', (e) => {
  e.preventDefault();
  const li = e.target.closest('.task');
  if (!li || !dragId || li.dataset.id === dragId) return;

  const rect = li.getBoundingClientRect();
  const isAbove = (e.clientY - rect.top) < rect.height / 2;
  const fromIndex = tasks.findIndex((t) => t.id === dragId);
  let toIndex = tasks.findIndex((t) => t.id === li.dataset.id);
  if (fromIndex === -1 || toIndex === -1) return;

  if (!isAbove) toIndex += 1;
  if (fromIndex < toIndex) toIndex -= 1;

  const [moved] = tasks.splice(fromIndex, 1);
  tasks.splice(toIndex, 0, moved);

  clearDropMarkers();
  saveTasks();
  renderTasks();
});

// ── Boot ────────────────────────────────────────────────────
if (timers.length === 0) {
  timers.push(createDefaultTimer());
  saveTimers();
}

ensureNotificationPermission();

// Warm up audio context on first user interaction (required by browser autoplay policy)
{
  const warmAudio = () => {
    const ctx = ensureAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('click', warmAudio, { capture: true, once: true });
  document.addEventListener('keydown', warmAudio, { capture: true, once: true });
}

renderDate();
renderTasks();
renderTimers();
timers.forEach(updateTimerDisplay);

// Catch up any timer that may have ended while the tab was closed
{
  let notified = false;
  for (const timer of timers) {
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
  timers.forEach(updateTimerDisplay);
}

startTick();
setInterval(renderDate, 30 * 1000);