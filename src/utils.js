// @ts-check

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const WEEKDAYS = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

/** @param {number} n */
export const pad = (n) => String(n).padStart(2, '0');

/** @param {Date} d */
export const formatDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;

/** @param {Date} d @param {boolean} [withSeconds=false] */
export const formatTime = (d, withSeconds = false) => {
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base;
};

/**
 * Parse a countdown string into seconds. Accepts "MM:SS" ("12:30"), and, for
 * timers of an hour or more, "H:MM:SS" ("8:00:00"). A bare number is minutes.
 * Returns null on bad input.
 * @param {string} value
 * @returns {number | null}
 */
export const parseMMSS = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hmmss = /^(\d{1,3}):([0-5]?\d):([0-5]?\d)$/.exec(trimmed);
  if (hmmss) {
    return Number(hmmss[1]) * 3600 + Number(hmmss[2]) * 60 + Number(hmmss[3]);
  }
  const mmss = /^(\d{1,3}):([0-5]?\d)$/.exec(trimmed);
  if (mmss) {
    const m = Number(mmss[1]);
    const s = Number(mmss[2]);
    return m * 60 + s;
  }
  const mins = /^\d{1,4}$/.exec(trimmed);
  if (mins) return Number(mins[0]) * 60;
  return null;
};

/**
 * Parse a timer-duration input. "H:MM" reads as hours:minutes ("8:00" → 8 h,
 * "1:30" → 1 h 30 min, "0:45" → 45 min); a plain number is minutes ("90" →
 * 90 min). Returns seconds, or null on bad or out-of-range input (1 min..24 h).
 * @param {string} value
 * @returns {number | null}
 */
export const parseDuration = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hm = /^(\d{1,3}):([0-5]?\d)$/.exec(trimmed);
  const totalMinutes = hm
    ? Number(hm[1]) * 60 + Number(hm[2])
    : /^\d{1,4}$/.exec(trimmed)
      ? Number(trimmed)
      : null;
  if (totalMinutes === null || totalMinutes < 1 || totalMinutes > 1440) return null;
  return totalMinutes * 60;
};

/** @param {number} n @param {[string, string, string]} forms */
export const pluralize = (n, forms) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
};

/** Format a countdown: "25:00" below an hour, "8:00:00" from an hour up. @param {number} secs */
export const formatMMSS = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.max(0, secs % 60);
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
};

/** Render a duration in human-friendly form: "8 ч", "2 ч 30 мин", or "45 мин". @param {number} secs */
export const formatDuration = (secs) => {
  const minutes = Math.max(0, Math.round(secs / 60));
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
};

/** Generate a short, collision-resistant id. */
/** @param {string} prefix */
export const generateId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// Match plain http(s) URLs as well as bare host.tld/path — but only when the host
// has a TLD, so we don't linkify things like "1.2.3" mid-sentence.
const URL_RE = /\b((?:https?:\/\/)?(?:[\w-]+\.[\w-]{2,})[^\s<]*)/gi;

/**
 * Render a task description into a DocumentFragment where any detected URL
 * becomes an anchor that opens in a new tab. Plain text becomes a text node.
 * @param {string} text
 * @param {Document} doc
 * @returns {DocumentFragment}
 */
export const renderTextWithLinks = (text, doc) => {
  const frag = doc.createDocumentFragment();
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = /** @type {number} */ (match.index);
    const raw = match[1];
    if (start > last) frag.appendChild(doc.createTextNode(text.slice(last, start)));
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const a = doc.createElement('a');
    a.href = href;
    a.textContent = raw;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'task-link';
    frag.appendChild(a);
    last = start + raw.length;
  }
  if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
  return frag;
};
