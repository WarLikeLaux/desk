// @ts-check
/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 * @property {number} createdAt
 * @property {number} [completedAt]
 */

/**
 * @typedef {'work' | 'break'} TimerPhase
 */

/**
 * @typedef {Object} Timer
 * @property {string} id
 * @property {string} name
 * @property {number} workDuration          seconds
 * @property {number} breakDuration         seconds
 * @property {TimerPhase} phase
 * @property {number} startedAt             ms epoch
 * @property {boolean} paused
 * @property {number | null} pausedAt       ms epoch
 * @property {number} pausedDuration        ms
 * @property {boolean} expired
 */

/**
 * @typedef {'all' | 'active' | 'completed'} TaskFilter
 */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} body
 * @property {number} createdAt
 * @property {number} updatedAt
 */

export {};
