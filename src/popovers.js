// @ts-check

/** @param {HTMLElement} popup @param {HTMLElement} anchor @param {'start' | 'end'} [align] */
export const positionPopover = (popup, anchor, align = 'start') => {
  const bounds = anchor.getBoundingClientRect();
  const size = popup.getBoundingClientRect();
  const edge = 8;
  const left = align === 'end' ? bounds.right - size.width : bounds.left;
  popup.style.left = `${Math.max(edge, Math.min(left, innerWidth - size.width - edge))}px`;
  const top =
    bounds.bottom + 6 + size.height <= innerHeight - edge
      ? bounds.bottom + 6
      : bounds.top - size.height - 6;
  popup.style.top = `${Math.max(edge, Math.min(top, innerHeight - size.height - edge))}px`;
};

/** @param {HTMLElement} root @param {(restoreFocus?: boolean) => void} close */
export const wirePopoverMenu = (root, close) => {
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...root.querySelectorAll('button')].filter((button) => !button.disabled);
    if (!buttons.length) return;
    const index = buttons.findIndex((button) => button === document.activeElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons.forEach((button, i) => {
      button.tabIndex = i === next ? 0 : -1;
    });
    buttons[next]?.focus({ preventScroll: true });
  });
  root.addEventListener('toggle', () => {
    if (!root.matches(':popover-open')) close();
  });
  root.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && !root.contains(event.relatedTarget)) close();
  });
  document.addEventListener('scroll', () => close(), true);
  window.addEventListener('resize', () => close());
};
