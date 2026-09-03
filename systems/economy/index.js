'use strict';
const legacy = require('../../lib/economy/credits');
const config = require('./config');
const reasons = require('./reasons');
const currency = require('./currency');
const { PRICES, REWARDS, EARNINGS, getPrice, getReward } = require('./prices');

const DEFAULT_POLICY = Object.freeze({ mode: 'free', price: 0, reason: 'usage', refundOnFailure: false });

function policy(input = {}) {
  const p = { ...DEFAULT_POLICY, ...input };
  if (!['free', 'paid', 'earn', 'reward', 'transfer', 'none'].includes(p.mode)) throw new Error(`Unknown economy mode: ${p.mode}`);
  if (p.price != null && typeof p.price !== 'function') p.price = Math.max(0, Math.floor(Number(p.price) || 0));
  return Object.freeze(p);
}

function createEconomy() {
  return {
    policy,
    balance: userId => legacy.getBalance(userId),
    history: (userId, limit) => legacy.getTransactions(userId, limit),
    charge: (userId, amount, reason) => legacy.charge(userId, amount, reason),
    chargeFor: (userId, priceKey, reason = null) => {
      const amount = getPrice(priceKey);
      return legacy.charge(userId, amount, reason || `command:${priceKey}`);
    },
    reward: (userId, amount, reason) => legacy.add(userId, amount, reason),
    rewardFor: (userId, rewardKey, reason = null) => {
      const amount = getReward(rewardKey);
      return legacy.add(userId, amount, reason || `reward:${rewardKey}`);
    },
    transfer: (from, to, amount, reason) => legacy.transfer(from, to, amount, reason),
    refund: (userId, amount, reason) => legacy.refund(userId, amount, reason),
    refundFor: (userId, priceKey, reason = null) => {
      const amount = getPrice(priceKey);
      return legacy.refund(userId, amount, reason || `refund:${priceKey}`);
    },
    async runPaid({ userId, priceKey, amount: inputAmount = null, reason = null, refundReason = null, task }) {
      if (typeof task !== 'function') throw new TypeError('runPaid requires a task function');
      const amount = inputAmount != null ? Math.max(0, Math.floor(Number(inputAmount) || 0)) : getPrice(priceKey);
      const payment = await legacy.charge(userId, amount, reason || `command:${priceKey}`);
      if (!payment.ok) return { ok: false, charged: false, cost: amount, balance: payment.balance };
      try {
        const result = await task({ cost: amount, payment });
        return { ok: true, charged: true, cost: amount, balance: result?.balance, result };
      } catch (error) {
        if (amount > 0) {
          try {
            await legacy.refund(userId, amount, refundReason || `refund:${priceKey}`);
            error.__leoEconomyRefunded = true;
          } catch (refundError) {
            error.__leoEconomyRefundError = refundError;
          }
        }
        throw error;
      }
    },
    formatReason: reasons.formatReason,
    normalizeId: legacy.normalizeId,
    currency,
    prices: PRICES,
    costs: PRICES,
    cost: getPrice,
    rewards: REWARDS,
    rewardAmount: getReward,
    earnings: EARNINGS,
    config,
  };
}

module.exports = { DEFAULT_POLICY, policy, createEconomy };
