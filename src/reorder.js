// @ts-check

/** @param {string} className @param {string} label @param {boolean} disabled */
export const createReorderHandle = (className, label, disabled) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${className} reorder-handle`;
  button.disabled = disabled;
  button.setAttribute('aria-label', `${label}: перетащить или использовать стрелки вверх и вниз`);
  button.dataset.tooltip = 'Перетащить · ↑ / ↓';
  button.innerHTML =
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M5 4h.01M11 4h.01M5 8h.01M11 8h.01M5 12h.01M11 12h.01"/></svg>';
  return button;
};

/**
 * @template {{ id: string }} T
 * @param {{ list: HTMLElement, cardSelector: string, handleSelector: string, items: () => T[], save: () => void, render: () => void }} options
 */
export const wireReorder = ({ list, cardSelector, handleSelector, items, save, render }) => {
  let drag =
    /** @type {{ id: string, pointerId: number, handle: HTMLElement, startY: number, x: number, y: number, moving: boolean } | null} */ (
      null
    );
  let destination = /** @type {{ id: string, below: boolean } | null} */ (null);
  let scrollFrame = 0;

  const clearMarkers = () => {
    list.querySelectorAll('.reorder-before, .reorder-after').forEach((card) => {
      card.classList.remove('reorder-before', 'reorder-after');
    });
  };

  /** @param {string} id @param {number} index */
  const moveItem = (id, index) => {
    const ordered = items();
    const from = ordered.findIndex((item) => item.id === id);
    if (from < 0 || from === index || index < 0 || index >= ordered.length) return;
    const [item] = ordered.splice(from, 1);
    ordered.splice(index, 0, item);
    save();
    render();
    const handle = list.querySelector(`${cardSelector}[data-id="${id}"] ${handleSelector}`);
    if (handle instanceof HTMLElement) handle.focus({ preventScroll: true });
  };

  const markDestination = () => {
    clearMarkers();
    destination = null;
    if (!drag?.moving) return;
    const bounds = list.getBoundingClientRect();
    if (
      drag.x < bounds.left ||
      drag.x > bounds.right ||
      drag.y < bounds.top ||
      drag.y > bounds.bottom
    )
      return;
    const cards = [...list.querySelectorAll(cardSelector)];
    const card =
      cards.find((el) => drag && drag.y < el.getBoundingClientRect().bottom + 6) ?? cards.at(-1);
    if (!(card instanceof HTMLElement) || card.dataset.id === drag.id || !card.dataset.id) return;
    const rect = card.getBoundingClientRect();
    const below = drag.y > rect.top + rect.height / 2;
    destination = { id: card.dataset.id, below };
    card.classList.add(below ? 'reorder-after' : 'reorder-before');
  };

  const scrollDuringDrag = () => {
    if (!drag?.moving) return;
    const bounds = list.getBoundingClientRect();
    if (
      drag.x >= bounds.left &&
      drag.x <= bounds.right &&
      drag.y >= bounds.top &&
      drag.y <= bounds.bottom
    ) {
      const edge = 32;
      const speed = drag.y < bounds.top + edge ? -6 : drag.y > bounds.bottom - edge ? 6 : 0;
      if (speed) {
        list.scrollTop += speed;
        markDestination();
      }
    }
    scrollFrame = requestAnimationFrame(scrollDuringDrag);
  };

  list.addEventListener('pointerdown', (event) => {
    const handle = event.target instanceof Element ? event.target.closest(handleSelector) : null;
    if (
      !(handle instanceof HTMLButtonElement) ||
      handle.disabled ||
      !event.isPrimary ||
      event.button !== 0
    )
      return;
    const card = handle.closest(cardSelector);
    if (!(card instanceof HTMLElement) || !card.dataset.id) return;
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    drag = {
      id: card.dataset.id,
      pointerId: event.pointerId,
      handle,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moving: false,
    };
  });

  list.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.moving && Math.abs(drag.y - drag.startY) > 6) {
      drag.moving = true;
      drag.handle.closest(cardSelector)?.classList.add('reorder-dragging');
      scrollFrame = requestAnimationFrame(scrollDuringDrag);
    }
    markDestination();
  });

  /** @param {PointerEvent} event */
  const finishDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const id = drag.id;
    const target = destination;
    drag.handle.closest(cardSelector)?.classList.remove('reorder-dragging');
    if (drag.handle.hasPointerCapture(event.pointerId))
      drag.handle.releasePointerCapture(event.pointerId);
    drag = null;
    destination = null;
    cancelAnimationFrame(scrollFrame);
    clearMarkers();
    if (event.type !== 'pointerup' || !target) return;
    const from = items().findIndex((item) => item.id === id);
    let to = items().findIndex((item) => item.id === target.id);
    if (from < 0 || to < 0) return;
    if (target.below) to += 1;
    if (from < to) to -= 1;
    moveItem(id, to);
  };

  list.addEventListener('pointerup', finishDrag);
  list.addEventListener('pointercancel', finishDrag);
  list.addEventListener('lostpointercapture', finishDrag);
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const handle = event.target instanceof Element ? event.target.closest(handleSelector) : null;
    if (!(handle instanceof HTMLButtonElement) || handle.disabled) return;
    const card = handle.closest(cardSelector);
    if (!(card instanceof HTMLElement) || !card.dataset.id) return;
    event.preventDefault();
    const index = items().findIndex((item) => item.id === card.dataset.id);
    moveItem(card.dataset.id, index + (event.key === 'ArrowUp' ? -1 : 1));
    list
      .querySelector(`${cardSelector}[data-id="${card.dataset.id}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  });
};
