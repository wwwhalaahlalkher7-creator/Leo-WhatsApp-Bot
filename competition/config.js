'use strict';

const COMPETITION_PRICES = require('./economy/prices');

module.exports = Object.freeze({
  VERSION: '1.31.0',
  TOTAL_QUESTIONS: 20,
  QUESTION_TIMEOUT_MS: 2 * 60 * 1000,
  SAFE_DECISION_TIMEOUT_MS: 2 * 60 * 1000,
  NORMAL_COOLDOWN_MS: 5 * 60 * 1000,
  LEAVE_COOLDOWN_MS: 15 * 60 * 1000,
  SAFE_LEAVE_COOLDOWN_MS: 5 * 60 * 1000,
  STAGES: Object.freeze({
    1: Object.freeze({ from: 1, to: 5, optionCount: 2 }),
    2: Object.freeze({ from: 6, to: 10, optionCount: 4 }),
    3: Object.freeze({ from: 11, to: 15, optionCount: 4, deceptive: true }),
    4: Object.freeze({ from: 16, to: 20, optionCount: 0 }),
  }),
  SAFE_QUESTIONS: Object.freeze([1, 5, 10, 15]),
  ...COMPETITION_PRICES,
});
