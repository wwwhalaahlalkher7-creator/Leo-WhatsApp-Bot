'use strict';

const store = require('../lib/storage');

const FILE = 'xp';
const BASE_XP = 100;
const GROWTH = 1.25;

function key(id) { return String(id || 'unknown').replace(/[^a-zA-Z0-9_@.:-]/g, '_'); }
function requiredForLevel(level) { return Math.max(1, Math.floor(BASE_XP * Math.pow(Math.max(1, level), GROWTH))); }
function totalRequiredForLevel(level) { let total = 0; for (let i = 1; i < level; i++) total += requiredForLevel(i); return total; }
function calculateLevel(totalXp) {
  let level = 1;
  let spent = 0;
  while (totalXp >= spent + requiredForLevel(level)) { spent += requiredForLevel(level); level += 1; if (level > 1000) break; }
  return { level, intoLevel: Math.max(0, totalXp - spent), required: requiredForLevel(level) };
}
function read() { return store.read(FILE, { users: {} }); }
function get(userId) {
  const data = read();
  const user = data.users?.[key(userId)] || { xp: 0, updatedAt: 0 };
  const totalXp = Math.max(0, Number(user.xp) || 0);
  return { ...user, xp: totalXp, ...calculateLevel(totalXp) };
}
async function add(userId, amount, reason = 'activity') {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return get(userId);
  const k = key(userId);
  let result;
  await store.update(FILE, data => {
    data.users ||= {};
    const user = data.users[k] ||= { xp: 0, createdAt: Date.now() };
    const before = calculateLevel(Number(user.xp) || 0);
    user.xp = Math.max(0, Number(user.xp) || 0) + value;
    user.updatedAt = Date.now();
    user.lastGain = { amount: value, reason, at: Date.now() };
    const after = calculateLevel(user.xp);
    result = { ...user, xp: user.xp, ...after, previousLevel: before.level, levelUp: after.level > before.level };
    return data;
  }, { users: {} });
  return result || get(userId);
}
function luckMultiplier(userId) {
  const level = get(userId).level;
  return 1 + Math.min(0.75, Math.max(0, level - 1) * 0.025);
}
module.exports = { FILE, requiredForLevel, totalRequiredForLevel, calculateLevel, get, add, luckMultiplier };
