// @ts-check

import { state } from './state.js';
import { toastEl, toastText, toastAction } from './dom.js';

const TOAST_DURATION_MS = 8000;
const TOAST_HIDE_ANIMATION_MS = 200;

/**
 * @param {string} text
 * @param {(() => void) | null | undefined} onAction
 * @param {string} [actionLabel='Отменить']
 */
export const showToast = (text, onAction, actionLabel = 'Отменить') => {
  if (state.toastTimer) clearTimeout(state.toastTimer);
  toastText.textContent = text;
  toastAction.textContent = actionLabel;
  toastAction.onclick = () => {
    if (onAction) onAction();
    hideToast();
  };
  toastEl.classList.remove('hiding');
  toastEl.hidden = false;
  // Force reflow so the entrance animation restarts cleanly.
  void toastEl.offsetWidth;
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth;
  toastEl.style.animation = '';
  state.toastTimer = setTimeout(() => hideToast(), TOAST_DURATION_MS);
};

/** @param {boolean} [immediate=false] */
export const hideToast = (immediate = false) => {
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
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
  }, TOAST_HIDE_ANIMATION_MS);
};
