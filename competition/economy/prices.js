'use strict';

/**
 * Competition-only economy table.
 * Values are copied from the existing competition configuration and MUST NOT
 * be changed as part of the economy architecture refactor.
 */
const PRICES = Object.freeze({
  QUESTION_COSTS: Object.freeze({
    1: 5, 2: 5, 3: 5, 4: 5, 5: 5,
    6: 10, 7: 10, 8: 10, 9: 10, 10: 25,
    11: 20, 12: 20, 13: 20, 14: 20, 15: 50,
    16: 25, 17: 25, 18: 25, 19: 25, 20: 25,
  }),
  QUESTION_REWARDS: Object.freeze({
    1: 10, 2: 15, 3: 15, 4: 15, 5: 15,
    6: 20, 7: 20, 8: 20, 9: 20, 10: 50,
    11: 50, 12: 50, 13: 50, 14: 50, 15: 100,
    16: 100, 17: 100, 18: 100, 19: 100, 20: 100,
  }),
  OPTION_COSTS: Object.freeze({ 1: 10, 2: 25, 3: 50, 4: null }),
  REMOVE_OPTION_COSTS: Object.freeze({ 1: null, 2: 15, 3: 30, 4: null }),
});

module.exports = PRICES;
