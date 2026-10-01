// @ts-check

import { state } from './state.js';

const AudioCtxCtor =
  /** @type {typeof AudioContext | undefined} */
  (window.AudioContext || /** @type {any} */ (window).webkitAudioContext);

/** @returns {AudioContext | null} */
export const ensureAudioCtx = () => {
  if (!AudioCtxCtor) return null;
  if (state.audioCtx) return state.audioCtx;
  try {
    state.audioCtx = new AudioCtxCtor();
  } catch {
    state.audioCtx = null;
  }
  return state.audioCtx;
};

/**
 * Play a notification beep. Two short tones — ascending for work→break,
 * descending for break→work. Silent if AudioContext is unavailable or
 * blocked by the autoplay policy.
 * @param {'work' | 'break'} [variant='work']
 */
export const playBeep = (variant = 'work') => {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  try {
    const baseFreq = variant === 'work' ? 660 : 880;
    const altFreq = variant === 'work' ? 880 : 660;
    /** @param {number} freq @param {number} start @param {number} duration */
    const tone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const node = ctx.createGain();
      osc.connect(node);
      node.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const now = ctx.currentTime;
      node.gain.setValueAtTime(0, now + start);
      node.gain.linearRampToValueAtTime(0.14, now + start + 0.02);
      node.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };
    tone(baseFreq, 0, 0.18);
    tone(altFreq, 0.2, 0.32);
  } catch {}
};

/** Wire up first-click/keydown listeners to unlock AudioContext. */
export const setupAudioUnlock = () => {
  const warm = () => {
    const ctx = ensureAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  document.addEventListener('click', warm, { capture: true, once: true });
  document.addEventListener('keydown', warm, { capture: true, once: true });
};
