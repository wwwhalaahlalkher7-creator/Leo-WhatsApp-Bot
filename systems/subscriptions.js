'use strict';
const store = require('../lib/storage');
const FILE = 'subscriptions';
const DEFAULT_PLANS = Object.freeze({
  basic: { name: 'Leo Basic', dailyReward: 10, xpBoost: 1.10, luckBoost: 0.05, price: 2 },
  pro: { name: 'Leo Pro', dailyReward: 25, xpBoost: 1.25, luckBoost: 0.12, price: 5 },
  ultra: { name: 'Leo Ultra', dailyReward: 50, xpBoost: 1.50, luckBoost: 0.20, price: 10 },
});
function key(id) { return String(id || 'unknown').replace(/[^a-zA-Z0-9_@.:-]/g, '_'); }
function read() { return store.read(FILE, { plans: DEFAULT_PLANS, users: {} }); }
function plans() { const d = read(); return { ...DEFAULT_PLANS, ...(d.plans || {}) }; }
function get(userId) {
  const d = read(); const sub = d.users?.[key(userId)];
  if (!sub || Number(sub.expiresAt || 0) <= Date.now()) return null;
  return { ...sub, plan: plans()[sub.plan] ? sub.plan : null, details: plans()[sub.plan] || null };
}
async function set(userId, plan, days = 30, meta = {}) {
  const p = plans()[String(plan).toLowerCase()];
  if (!p) throw new Error('Unknown subscription plan');
  const now = Date.now(); const k = key(userId); const duration = Math.max(1, Number(days) || 30) * 86400000;
  let result;
  await store.update(FILE, d => {
    d.plans ||= { ...DEFAULT_PLANS };
    d.users ||= {};
    const old = d.users[k];
    const base = old && Number(old.expiresAt) > now ? Number(old.expiresAt) : now;
    d.users[k] = { plan: String(plan).toLowerCase(), startedAt: old?.startedAt || now, expiresAt: base + duration, updatedAt: now, ...meta };
    result = d.users[k]; return d;
  }, { plans: DEFAULT_PLANS, users: {} });
  return { ...result, details: p };
}
async function cancel(userId) { const k = key(userId); await store.update(FILE, d => { if (d.users?.[k]) d.users[k].expiresAt = Date.now(); return d; }, { plans: DEFAULT_PLANS, users: {} }); }
async function updatePlan(plan, patch) { const p = String(plan).toLowerCase(); if (!DEFAULT_PLANS[p] && !plans()[p]) throw new Error('Unknown subscription plan'); await store.update(FILE, d => { d.plans ||= { ...DEFAULT_PLANS }; d.plans[p] = { ...(d.plans[p] || DEFAULT_PLANS[p]), ...patch }; return d; }, { plans: DEFAULT_PLANS, users: {} }); return plans()[p]; }
async function claimDaily(userId) {
  const sub = get(userId); if (!sub) return { ok: false, reason: 'inactive' };
  const tz = 'Africa/Khartoum';
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const k = key(userId); let claimed = false;
  await store.update(FILE, d => {
    d.users ||= {}; const u = d.users[k];
    if (!u || u.plan !== sub.plan || Number(u.expiresAt || 0) <= Date.now() || u.lastDailyRewardDay === day) return d;
    u.lastDailyRewardDay = day; u.lastDailyRewardAt = Date.now(); claimed = true; return d;
  }, { plans: DEFAULT_PLANS, users: {} });
  return claimed ? { ok: true, amount: Number(sub.details.dailyReward || 0), plan: sub.plan, day } : { ok: false, reason: 'already_claimed' };
}
async function unclaimDaily(userId, day) {
  const k=key(userId);
  await store.update(FILE,d=>{ const u=d.users?.[k]; if(u && u.lastDailyRewardDay===day) { delete u.lastDailyRewardDay; delete u.lastDailyRewardAt; } return d; },{plans:DEFAULT_PLANS,users:{}});
}
function allUsers() { return read().users || {}; }
module.exports = { FILE, DEFAULT_PLANS, plans, get, set, cancel, updatePlan, claimDaily, unclaimDaily, allUsers };
