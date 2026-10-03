// @ts-check
/** @typedef {import('./types.js').Task['category'] | 'all'} CategoryChoice */
/** @typedef {import('./types.js').Task['category']} TaskCategory */

import { positionPopover, wirePopoverMenu } from './popovers.js';

/** @param {CategoryChoice} category */
export const categoryLabel = (category) =>
  category === 'work' ? 'Работа' : category === 'personal' ? 'Личное' : 'Все';

/** @param {HTMLElement} root @param {CategoryChoice} selected @param {boolean} [allowAll] */
export const renderCategoryPicker = (root, selected, allowAll = false) => {
  const choices = /** @type {CategoryChoice[]} */ (
    allowAll ? ['all', 'work', 'personal'] : ['work', 'personal']
  );
  root.replaceChildren(
    ...choices.map((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-option';
      button.dataset.category = category;
      if (category !== 'all') button.innerHTML = categoryIcon(category);
      const label = document.createElement('span');
      label.textContent = categoryLabel(category);
      button.append(label);
      button.setAttribute('aria-pressed', String(category === selected));
      return button;
    }),
  );
};

/** @param {TaskCategory} category */
export const categoryIcon = (category) =>
  `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    category === 'work'
      ? '<path d="M7 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 6h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM2 10a20 20 0 0 0 16 0M10 10v3" />'
      : '<circle cx="10" cy="6" r="3" /><path d="M4 17v-1a6 6 0 0 1 12 0v1" />'
  }</svg>`;

/** @param {HTMLButtonElement} button @param {TaskCategory} category @param {string} label */
export const setCategoryButton = (button, category, label) => {
  popup ??= createPopup();
  button.innerHTML = categoryIcon(category);
  button.setAttribute('aria-label', `${label}: ${categoryLabel(category)}`);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-controls', 'categoryPopover');
  button.setAttribute('aria-expanded', 'false');
  button.dataset.tooltip = `${label}: ${categoryLabel(category)}`;
};

let popup = /** @type {HTMLDivElement | null} */ (null);
let activeAnchor = /** @type {HTMLButtonElement | null} */ (null);
let onPick = /** @type {((category: TaskCategory) => void) | null} */ (null);

/** @param {boolean} [restoreFocus] */
export const closeCategoryPicker = (restoreFocus = false) => {
  const anchor = activeAnchor;
  if (popup?.matches(':popover-open')) popup.hidePopover();
  anchor?.setAttribute('aria-expanded', 'false');
  activeAnchor = null;
  onPick = null;
  if (restoreFocus && anchor?.isConnected) anchor.focus({ preventScroll: true });
};

const createPopup = () => {
  const root = document.createElement('div');
  root.id = 'categoryPopover';
  root.className = 'category-picker menu-popover category-popover';
  root.setAttribute('popover', 'auto');
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', 'Категория задачи');
  document.body.append(root);
  root.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const category = button.dataset.category;
    if (category !== 'work' && category !== 'personal') return;
    const apply = onPick;
    closeCategoryPicker();
    apply?.(category);
  });
  wirePopoverMenu(root, closeCategoryPicker);
  return root;
};

/** @param {HTMLButtonElement} anchor @param {TaskCategory} selected @param {(category: TaskCategory) => void} apply */
export const openCategoryPicker = (anchor, selected, apply) => {
  if (activeAnchor === anchor && popup?.matches(':popover-open')) {
    closeCategoryPicker(true);
    return;
  }
  closeCategoryPicker();
  popup ??= createPopup();
  activeAnchor = anchor;
  onPick = apply;
  renderCategoryPicker(popup, selected);
  popup.querySelectorAll('button').forEach((button) => {
    const chosen = button.getAttribute('aria-pressed') === 'true';
    button.removeAttribute('aria-pressed');
    button.setAttribute('role', 'menuitemradio');
    button.setAttribute('aria-checked', String(chosen));
    button.tabIndex = chosen ? 0 : -1;
  });
  anchor.setAttribute('aria-expanded', 'true');
  popup.showPopover();
  positionPopover(popup, anchor);
  [...popup.querySelectorAll('button')]
    .find((button) => button.tabIndex === 0)
    ?.focus({ preventScroll: true });
};
