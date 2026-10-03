// @ts-check

const DELETE_PATH = 'm4 4 8 8M12 4l-8 8';
const CONFIRM_PATH = 'm3 8 3 3 7-7';

/** @param {Element | null} button @param {boolean} confirming */
export const setDeleteButtonState = (button, confirming) => {
  if (!(button instanceof HTMLButtonElement)) return;
  button.classList.toggle('is-confirming', confirming);
  button.setAttribute(
    'aria-label',
    confirming ? 'Подтвердить удаление' : (button.dataset.deleteLabel ?? 'Удалить'),
  );
  button.dataset.tooltip = confirming ? 'Подтвердить удаление' : 'Удалить';
  // Keep the clicked SVG node attached so outside-click handlers see its card.
  button.querySelector('path')?.setAttribute('d', confirming ? CONFIRM_PATH : DELETE_PATH);
};

/** @param {HTMLButtonElement} button @param {string} label */
export const initDeleteButton = (button, label) => {
  button.classList.add('delete-button');
  button.dataset.deleteLabel = label;
  button.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${DELETE_PATH}"/></svg>`;
  setDeleteButtonState(button, false);
};
