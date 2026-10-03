// @ts-check
/** @typedef {import('./types.js').Habit} Habit */

import { state } from './state.js';
import { HABITS_KEY, loadHabits, saveHabits } from './storage.js';
import { generateId } from './utils.js';
import { showToast } from './toast.js';

const section = /** @type {HTMLDetailsElement} */ (document.querySelector('#habitsSection'));
const list = /** @type {HTMLUListElement} */ (document.querySelector('#habitsList'));
const count = /** @type {HTMLElement} */ (document.querySelector('#habitsCount'));
const composer = /** @type {HTMLFormElement} */ (document.querySelector('#habitComposer'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#habitInput'));

const habitDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Omsk',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Habit days run from 09:00 to 09:00 in Omsk, regardless of the device timezone.
const habitDate = () => {
  const parts = habitDayFormatter.formatToParts(new Date(Date.now() - 9 * 60 * 60 * 1000));
  const [year, month, day] = ['year', 'month', 'day'].map(
    (type) => parts.find((part) => part.type === type)?.value,
  );
  return `${year}-${month}-${day}`;
};

let displayedDate = habitDate();
/** @type {string | null} */
let editingId = null;
let editingDraft = '';

/** @param {string} action @param {string} label @param {string} icon */
const actionButton = (action, label, icon) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.className = `habit-action habit-${action}`;
  button.setAttribute('aria-label', label);
  button.innerHTML = icon;
  return button;
};

/** @param {Habit} habit */
const buildHabit = (habit) => {
  const done = habit.completedDates.includes(displayedDate);
  const row = document.createElement('li');
  row.className = `habit${done ? ' is-done' : ''}`;
  row.dataset.id = habit.id;
  const check = actionButton(
    'toggle',
    `${done ? 'Снять отметку за сегодня' : 'Выполнено сегодня'}: ${habit.text}`,
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5"/></svg>',
  );
  check.className = `check habit-check${done ? ' is-checked' : ''}`;
  check.setAttribute('aria-pressed', String(done));
  row.append(check);
  if (editingId === habit.id) {
    const editor = document.createElement('input');
    editor.className = 'habit-name-edit';
    editor.value = editingDraft;
    editor.maxLength = 200;
    editor.setAttribute('aria-label', 'Новое название привычки');
    row.append(editor);
    row.append(
      actionButton(
        'save',
        'Сохранить название привычки',
        '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>',
      ),
    );
    row.append(
      actionButton(
        'cancel',
        'Отменить переименование',
        '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
      ),
    );
  } else {
    const name = document.createElement('span');
    name.className = 'habit-name';
    name.textContent = habit.text;
    name.title = habit.text;
    row.append(name);
    row.append(
      actionButton(
        'rename',
        `Переименовать привычку «${habit.text}»`,
        '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 3 3 3-7 7-4 1 1-4 7-7Z"/></svg>',
      ),
    );
    row.append(
      actionButton(
        'delete',
        `Удалить привычку «${habit.text}»`,
        '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
      ),
    );
  }
  return row;
};

export const renderHabits = () => {
  const focused = document.activeElement;
  const focusedRow = focused instanceof Element ? focused.closest('.habit') : null;
  const index = focusedRow ? Array.from(list.children).indexOf(focusedRow) : -1;
  const focusedId = focusedRow instanceof HTMLElement ? focusedRow.dataset.id : null;
  const action = focused instanceof HTMLElement ? focused.dataset.action : null;
  const editorFocused =
    focused instanceof HTMLInputElement && focused.classList.contains('habit-name-edit');
  const selection = editorFocused ? [focused.selectionStart, focused.selectionEnd] : null;
  if (editorFocused) editingDraft = focused.value;
  displayedDate = habitDate();
  if (!state.habits.items.some((habit) => habit.id === editingId)) editingId = null;
  list.replaceChildren(...state.habits.items.map(buildHabit));
  const done = state.habits.items.filter((habit) =>
    habit.completedDates.includes(displayedDate),
  ).length;
  count.textContent = `${done} / ${state.habits.items.length}`;
  count.setAttribute(
    'aria-label',
    `Выполнено привычек сегодня: ${done} из ${state.habits.items.length}`,
  );
  section.open = state.habits.expanded;
  const rows = Array.from(list.children);
  const row =
    rows.find((row) => row instanceof HTMLElement && row.dataset.id === focusedId) ??
    rows[Math.min(index, rows.length - 1)];
  if (focusedRow && row) {
    const control = /** @type {HTMLElement | null} */ (
      row.querySelector(editorFocused ? '.habit-name-edit' : `[data-action="${action}"]`)
    );
    control?.focus({ preventScroll: true });
    if (control instanceof HTMLInputElement && selection)
      control.setSelectionRange(selection[0], selection[1]);
  } else if (focusedRow) input.focus({ preventScroll: true });
};

export const refreshHabitDay = () => {
  if (habitDate() !== displayedDate) renderHabits();
};

/** @param {boolean} save */
const finishRename = (save) => {
  const row = Array.from(list.children).find(
    (row) => row instanceof HTMLElement && row.dataset.id === editingId,
  );
  const editor = /** @type {HTMLInputElement | null} */ (row?.querySelector('.habit-name-edit'));
  if (save) {
    const text = editor?.value.trim() ?? '';
    if (!text) {
      editor?.setCustomValidity('Введите название привычки');
      editor?.reportValidity();
      return;
    }
    const habit = state.habits.items.find((habit) => habit.id === editingId);
    if (habit) habit.text = text;
    saveHabits();
  }
  const id = editingId;
  editingId = null;
  renderHabits();
  const restored = Array.from(list.children).find(
    (row) => row instanceof HTMLElement && row.dataset.id === id,
  );
  /** @type {HTMLElement | null} */ (restored?.querySelector('[data-action="rename"]'))?.focus();
};

export const wireHabits = () => {
  section.addEventListener('toggle', () => {
    if (state.habits.expanded === section.open) return;
    state.habits.expanded = section.open;
    saveHabits();
  });
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    state.habits.items.push({
      id: generateId('habit'),
      text,
      createdAt: Date.now(),
      completedDates: [],
    });
    saveHabits();
    input.value = '';
    renderHabits();
    list.lastElementChild?.scrollIntoView({ block: 'nearest' });
    input.focus({ preventScroll: true });
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      input.blur();
    }
  });
  list.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button');
    const row = button?.closest('.habit');
    if (!(row instanceof HTMLElement) || !button) return;
    const habit = state.habits.items.find((habit) => habit.id === row.dataset.id);
    if (!habit) return;
    if (button.dataset.action === 'toggle') {
      const today = habitDate();
      habit.completedDates = habit.completedDates.includes(today)
        ? habit.completedDates.filter((date) => date !== today)
        : [...habit.completedDates, today];
      saveHabits();
      renderHabits();
    } else if (button.dataset.action === 'rename') {
      editingId = habit.id;
      editingDraft = habit.text;
      renderHabits();
      const editor = /** @type {HTMLInputElement | null} */ (
        list.querySelector('.habit-name-edit')
      );
      editor?.focus();
      editor?.select();
    } else if (button.dataset.action === 'save' || button.dataset.action === 'cancel') {
      finishRename(button.dataset.action === 'save');
    } else if (button.dataset.action === 'delete') {
      const index = state.habits.items.indexOf(habit);
      state.habits.items.splice(index, 1);
      saveHabits();
      renderHabits();
      showToast('Привычка удалена', () => {
        if (state.habits.items.some((item) => item.id === habit.id)) return;
        state.habits.items.splice(index, 0, habit);
        saveHabits();
        renderHabits();
      });
    }
  });
  list.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement) {
      editingDraft = event.target.value;
      event.target.setCustomValidity('');
    }
  });
  list.addEventListener('keydown', (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      finishRename(event.key === 'Enter');
    }
  });
  document.addEventListener('visibilitychange', refreshHabitDay);
  window.addEventListener('focus', refreshHabitDay);
  window.addEventListener('storage', (event) => {
    if (event.key !== HABITS_KEY && event.key !== null) return;
    state.habits = loadHabits();
    renderHabits();
  });
};
