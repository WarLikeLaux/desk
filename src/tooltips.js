// @ts-check

export const wireTooltips = () => {
  const tooltip = document.createElement('div');
  tooltip.id = 'deskTooltip';
  tooltip.className = 'ui-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('popover', 'manual');
  document.body.append(tooltip);

  let anchor = /** @type {HTMLElement | null} */ (null);
  let description = /** @type {string | null} */ (null);

  const hide = () => {
    if (tooltip.matches(':popover-open')) tooltip.hidePopover();
    if (anchor) {
      if (description) anchor.setAttribute('aria-describedby', description);
      else anchor.removeAttribute('aria-describedby');
    }
    anchor = null;
    description = null;
  };

  /** @param {EventTarget | null} target */
  const show = (target) => {
    const owner = target instanceof Element ? target.closest('[data-tooltip]') : null;
    if (
      !(owner instanceof HTMLElement) ||
      !owner.dataset.tooltip ||
      (owner.hasAttribute('aria-haspopup') && owner.getAttribute('aria-expanded') === 'true') ||
      (owner instanceof HTMLButtonElement && owner.disabled)
    )
      return;
    if (anchor === owner) return;
    hide();
    anchor = owner;
    description = owner.getAttribute('aria-describedby');
    owner.setAttribute('aria-describedby', [description, tooltip.id].filter(Boolean).join(' '));
    tooltip.textContent = owner.dataset.tooltip;
    tooltip.showPopover();
    position(owner);
  };

  /** @param {HTMLElement} owner */
  const position = (owner) => {
    const bounds = owner.getBoundingClientRect();
    const size = tooltip.getBoundingClientRect();
    const edge = 8;
    const left = Math.max(
      edge,
      Math.min(bounds.left + (bounds.width - size.width) / 2, innerWidth - size.width - edge),
    );
    const above = bounds.top - size.height - edge;
    const top = Math.max(
      edge,
      Math.min(above >= edge ? above : bounds.bottom + edge, innerHeight - size.height - edge),
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const onViewportChange = () => {
    if (anchor?.isConnected && anchor.matches(':focus-visible')) position(anchor);
    else hide();
  };

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'touch') show(event.target);
  });
  document.addEventListener('pointerout', (event) => {
    if (
      anchor &&
      event.target instanceof Node &&
      anchor.contains(event.target) &&
      !anchor.matches(':focus-visible') &&
      (!(event.relatedTarget instanceof Node) || !anchor.contains(event.relatedTarget))
    )
      hide();
  });
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    // Native popovers can restore focus while their top-layer operation is active.
    queueMicrotask(() => {
      if (
        target instanceof Element &&
        target === document.activeElement &&
        target.matches(':focus-visible')
      )
        show(target);
    });
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide);
  document.addEventListener('click', hide);
  document.addEventListener('scroll', onViewportChange, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('blur', hide);
};
