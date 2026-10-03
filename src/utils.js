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

/** Format a countdown. @param {number} secs @param {boolean} [withHours] */
export const formatMMSS = (secs, withHours = secs >= 3600) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.max(0, secs % 60);
  if (withHours) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
};

/** Render a duration with full Russian unit names. @param {number} secs */
export const formatDuration = (secs) => {
  const minutes = Math.max(0, Math.round(secs / 60));
  const minuteText = (/** @type {number} */ value) =>
    `${value} ${pluralize(value, ['минута', 'минуты', 'минут'])}`;
  if (minutes < 60) return minuteText(minutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = `${h} ${pluralize(h, ['час', 'часа', 'часов'])}`;
  return m === 0 ? hours : `${hours} ${minuteText(m)}`;
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

/** @param {string} value @returns {string | null} */
export const normalizeURL = (value) => {
  const raw = value.trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
};

/** @param {string} value @returns {{min: number, max: number} | null} */
export const parseEstimate = (value) => {
  const raw = value
    .trim()
    .toLowerCase()
    .replaceAll(',', '.')
    .replace(/\s+до\s+/, '–');
  if (!raw) return null;
  const parts = raw.split(/\s*[-–—]\s*/);
  if (parts.length > 2) return null;
  const hourUnit = '(?:ч(?:ас(?:а|ов)?)?|h(?:ours?|rs?)?)';
  const minuteUnit = '(?:м(?:ин(?:ут(?:а|ы)?)?)?|m(?:in(?:ute)?s?)?)';
  const clockPattern = /^(\d{1,3}):([0-5]\d)$/;
  const hourSuffix = new RegExp(`${hourUnit}\\.?$`);
  const durationPattern = new RegExp(
    `^(?:(\\d+(?:\\.\\d+)?)\\s*${hourUnit}\\.?\\s*)?(?:(\\d+(?:\\.\\d+)?)\\s*(?:${minuteUnit}\\.?)?)?$`,
  );
  const inferredHours =
    parts.length === 2 && parts.some((part) => hourSuffix.test(part) || clockPattern.test(part));
  /** @param {string} part @param {boolean} hours */
  const parsePart = (part, hours) => {
    const clock = clockPattern.exec(part);
    const match = durationPattern.exec(part);
    if (!clock && (!match || (!match[1] && !match[2]))) return null;
    const minutes = clock
      ? Number(clock[1]) * 60 + Number(clock[2])
      : Number(match?.[1] ?? 0) * 60 +
        Number(match?.[2] ?? 0) * (hours && /^\d+(?:\.\d+)?$/.test(part) ? 60 : 1);
    return minutes >= 1 && minutes <= 10080 ? Math.round(minutes) : null;
  };
  const min = parsePart(parts[0], inferredHours);
  const max = parts.length === 2 ? parsePart(parts[1], inferredHours) : min;
  return min !== null && max !== null && max >= min ? { min, max } : null;
};

/** @param {{min: number, max: number} | null} estimate */
export const formatEstimate = (estimate) => {
  if (!estimate) return '';
  const { min, max } = estimate;
  if (min === max) return formatDuration(min * 60);
  if (min % 60 === 0 && max % 60 === 0)
    return `${min / 60} - ${max / 60} ${pluralize(max / 60, ['час', 'часа', 'часов'])}`;
  if (max < 60) return `${min} - ${max} ${pluralize(max, ['минута', 'минуты', 'минут'])}`;
  return `${formatDuration(min * 60)} - ${formatDuration(max * 60)}`;
};

/** @param {string} text @returns {Promise<boolean>} */
export const copyText = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }
};
