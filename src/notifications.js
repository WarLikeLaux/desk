// @ts-check
/** @typedef {import('./types.js').Timer} Timer */

const NOTIFICATION_CLOSE_MS = 12_000;
let permissionRequested = false;

/** @returns {Promise<boolean>} */
export const ensureNotificationPermission = () => {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  if (permissionRequested) return Promise.resolve(false);
  permissionRequested = true;
  try {
    return Notification.requestPermission()
      .then((p) => p === 'granted')
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
};

/**
 * Fire a native browser notification for a finished phase.
 * @param {Timer} timer
 * @returns {Notification | null}
 */
export const fireBrowserNotification = (timer) => {
  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  const wasPhase = timer.phase === 'work' ? 'работа' : 'перерыв';
  const isSinglePhase = timer.type === 'work';
  const nextPhase = timer.phase === 'work' ? 'перерыв' : 'работа';
  try {
    const n = new Notification(
      `${wasPhase.charAt(0).toUpperCase() + wasPhase.slice(1)} ${timer.phase === 'work' ? 'завершена' : 'завершён'}`,
      {
        body: isSinglePhase ? 'Время вышло.' : `Переключиться на ${nextPhase}?`,
        tag: `pomodoro-${timer.id}`,
        silent: false,
      },
    );
    n.onclick = () => {
      try {
        n.close();
      } catch {}
      try {
        window.focus();
      } catch {}
      if (isSinglePhase) return;
      // The click handler dispatches a custom event that timers.js listens for.
      window.dispatchEvent(new CustomEvent('desk:phase-switch', { detail: { id: timer.id } }));
    };
    setTimeout(() => {
      try {
        n.close();
      } catch {}
    }, NOTIFICATION_CLOSE_MS);
    return n;
  } catch {
    return null;
  }
};
