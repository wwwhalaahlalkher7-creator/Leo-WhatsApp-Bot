'use strict';

/**
 * Single source of truth for the user-facing economy currency.
 * The final public name can be changed here (or via environment) without
 * rewriting command text throughout the bot.
 */
const CURRENCY = Object.freeze({
  key: 'currency',
  name: 'عملة',
  symbol: '🪙',
  amount: amount => `${Number(amount) || 0} ${CURRENCY.name}`,
  enough: amount => `ما يكفي من ${CURRENCY.name}`,
  unit: amount => `${Number(amount) || 0} ${CURRENCY.name}`,
  insufficient: () => `رصيدك غير كافٍ`,
  balance: amount => `${Number(amount) || 0} ${CURRENCY.name}`,
  balanceLabel: amount => `رصيدك الحالي: *${Number(amount) || 0} ${CURRENCY.name}*`,
});

module.exports = CURRENCY;
