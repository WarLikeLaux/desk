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

/** @param {Date} d */
export const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** @param {number} n @param {[string, string, string]} forms */
export const pluralize = (n, forms) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
};

/** @param {number} secs */
export const formatMMSS = (secs) => {
  const m = Math.floor(secs / 60);
  const s = Math.max(0, secs % 60);
  return `${pad(m)}:${pad(s)}`;
};

/** Generate a short, collision-resistant id. */
/** @param {string} prefix */
export const generateId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
