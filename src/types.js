// @ts-check
/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 * @property {number} createdAt
 * @property {'today' | 'later'} bucket
 * @property {'work' | 'personal'} category
 * @property {{min: number, max: number} | null} estimate Minutes
 * @property {{label: string, url: string}[]} links
 * @property {number} [completedAt]
 */

/**
 * @typedef {Object} Habit
 * @property {string} id
 * @property {string} text
 * @property {number} createdAt
 * @property {string[]} completedDates Omsk habit-day dates, YYYY-MM-DD, starting at 09:00
 */

/**
 * @typedef {Object} HabitsData
 * @property {Habit[]} items
 * @property {boolean} expanded Legacy storage field; habits are always visible
 */

/**
 * @typedef {'work' | 'break'} TimerPhase
 */

/**
 * @typedef {'pomodoro' | 'work'} TimerType
 *
 * `pomodoro` alternates work -> break -> work, requires a phase toggle.
 * `work` is a single-phase countdown that never switches.
 */

/**
 * @typedef {Object} Timer
 * @property {string} id
 * @property {string} name
 * @property {TimerType} type
 * @property {number} workDuration          seconds
 * @property {number} breakDuration         seconds (unused when type='work')
 * @property {TimerPhase} phase
 * @property {number} startedAt             ms epoch
 * @property {boolean} paused
 * @property {number | null} pausedAt       ms epoch
 * @property {number} pausedDuration        ms
 * @property {boolean} expired
 */

/**
 * @typedef {'all' | 'active' | 'completed' | 'later'} TaskFilter
 */

/** @typedef {'all' | 'work' | 'personal'} TaskCategoryFilter */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} body
 * @property {number} createdAt
 * @property {number} updatedAt
 */

export {};
