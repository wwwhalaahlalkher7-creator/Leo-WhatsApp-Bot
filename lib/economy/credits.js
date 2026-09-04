'use strict';
const store = require('../storage');
const { INITIAL_BALANCE, STORAGE_FILE: FILE } = require('../../systems/economy/config');
const { formatReason } = require('../../systems/economy/reasons');

// Compatibility adapter: storage primitives stay here; economy configuration
// and user-facing reason labels live under systems/economy.
const COSTS = Object.freeze({});

function normalizeId(id) {
  return String(id || 'unknown').replace(/[^a-zA-Z0-9_@.:-]/g, '_');
}

function readData() {
  return store.read(FILE, { users: {} });
}

function appendTransaction(user, type, amount, reason, extra = {}) {
  user.transactions ||= [];
  user.transactions.push({ type, amount, reason, at: Date.now(), ...extra });
  if (user.transactions.length > 50) user.transactions = user.transactions.slice(-50);
}

function getTransactions(userId, limit = 10) {
  const key = normalizeId(userId);
  const user = readData().users?.[key];
  return (user?.transactions || []).slice(-Math.max(1, Number(limit) || 10)).reverse();
}

async function ensureUser(userId) {
  const key = normalizeId(userId);
  const data = readData();
  if (!data.users[key]) {
    data.users[key] = { balance: INITIAL_BALANCE, createdAt: Date.now(), updatedAt: Date.now(), transactions: [{ type: 'credit', amount: INITIAL_BALANCE, reason: 'welcome:initial-balance', at: Date.now() }] };
    await store.write(FILE, data);
    return { ...data.users[key], isNew: true };
  }
  return { ...data.users[key], isNew: false };
}

async function getBalance(userId) {
  const user = await ensureUser(userId);
  return Number(user.balance || 0);
}

async function add(userId, amount, reason = 'reward') {
  const key = normalizeId(userId);
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return getBalance(userId);
  const result = await store.update(FILE, data => {
    data.users ||= {};
    const user = data.users[key] ||= { balance: INITIAL_BALANCE, createdAt: Date.now(), transactions: [{ type: 'credit', amount: INITIAL_BALANCE, reason: 'welcome:initial-balance', at: Date.now() }] };
    user.balance = Math.max(0, Number(user.balance || 0)) + value;
    user.updatedAt = Date.now();
    user.lastTransaction = { type: 'credit', amount: value, reason, at: Date.now() };
    appendTransaction(user, 'credit', value, reason);
    return data;
  }, { users: {} });
  return Number(result.users[key]?.balance || 0);
}

async function spend(userId, amount, reason = 'usage') {
  const key = normalizeId(userId);
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return { ok: true, balance: await getBalance(userId), cost: 0 };
  const result = await store.update(FILE, data => {
    data.users ||= {};
    const user = data.users[key] ||= { balance: INITIAL_BALANCE, createdAt: Date.now() };
    const balance = Math.max(0, Number(user.balance || 0));
    if (balance < value) return data;
    user.balance = balance - value;
    user.updatedAt = Date.now();
    user.lastTransaction = { type: 'debit', amount: value, reason, at: Date.now() };
    appendTransaction(user, 'debit', value, reason);
    return data;
  }, { users: {} });
  const balance = Number(result.users[key]?.balance || 0);
  return { ok: balance >= 0 && Number(result.users[key]?.lastTransaction?.type === 'debit' ? result.users[key].lastTransaction.amount : 0) === value && result.users[key].lastTransaction.reason === reason, balance, cost: value };
}

async function charge(userId, amount, reason = 'usage') {
  const key = normalizeId(userId);
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return { ok: true, balance: await getBalance(userId), cost: 0 };
  let charged = false;
  let resultingBalance = 0;
  await store.update(FILE, data => {
    data.users ||= {};
    const user = data.users[key] ||= { balance: INITIAL_BALANCE, createdAt: Date.now() };
    const balance = Math.max(0, Number(user.balance || 0));
    if (balance < value) {
      resultingBalance = balance;
      return data;
    }
    user.balance = balance - value;
    user.updatedAt = Date.now();
    user.lastTransaction = { type: 'debit', amount: value, reason, at: Date.now() };
    appendTransaction(user, 'debit', value, reason);
    resultingBalance = user.balance;
    charged = true;
    return data;
  }, { users: {} });
  return { ok: charged, balance: resultingBalance, cost: value };
}

async function transfer(fromUserId, toUserId, amount, reason = 'bank:transfer') {
  const fromKey = normalizeId(fromUserId);
  const toKey = normalizeId(toUserId);
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value || fromKey === toKey) return { ok: false, senderBalance: await getBalance(fromUserId) };
  let ok = false;
  let senderBalance = 0;
  let receiverBalance = 0;
  await store.update(FILE, data => {
    data.users ||= {};
    const from = data.users[fromKey] ||= { balance: INITIAL_BALANCE, createdAt: Date.now(), transactions: [] };
    const to = data.users[toKey] ||= { balance: INITIAL_BALANCE, createdAt: Date.now(), transactions: [] };
    const current = Math.max(0, Number(from.balance || 0));
    if (current < value) { senderBalance = current; return data; }
    from.balance = current - value;
    to.balance = Math.max(0, Number(to.balance || 0)) + value;
    from.updatedAt = to.updatedAt = Date.now();
    appendTransaction(from, 'debit', value, reason, { to: toKey });
    appendTransaction(to, 'credit', value, reason, { from: fromKey });
    from.lastTransaction = { type: 'debit', amount: value, reason, at: Date.now(), to: toKey };
    to.lastTransaction = { type: 'credit', amount: value, reason, at: Date.now(), from: fromKey };
    senderBalance = from.balance;
    receiverBalance = to.balance;
    ok = true;
    return data;
  }, { users: {} });
  return { ok, senderBalance, receiverBalance, amount: value };
}

async function refund(userId, amount, reason = 'refund') { return add(userId, amount, reason); }

function __readRaw() { return readData(); }
module.exports = { INITIAL_BALANCE, COSTS, normalizeId, ensureUser, getBalance, getTransactions, add, spend, charge, transfer, refund, formatReason, __readRaw };
