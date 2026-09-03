'use strict';

/** Central runtime configuration for the economy storage layer. */
const INITIAL_BALANCE = 100;
const STORAGE_FILE = 'credits';

module.exports = Object.freeze({
  INITIAL_BALANCE: Number.isFinite(INITIAL_BALANCE) && INITIAL_BALANCE >= 0 ? Math.floor(INITIAL_BALANCE) : 100,
  STORAGE_FILE,
});
