'use strict';

const MAX_EVENTS = 40;
const state = { retries: [], fallbacks: [] };

function push(list, item) {
  list.push({ at: new Date().toISOString(), ...item });
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
}

function recordRetry(details = {}) {
  push(state.retries, {
    provider: details.provider || null,
    attempt: Number(details.attempt) || 1,
    delayMs: Math.max(0, Number(details.delayMs) || 0),
    code: details.code || null,
    status: Number.isFinite(Number(details.status)) ? Number(details.status) : null,
    classification: details.classification || null,
  });
}

function recordFallback(details = {}) {
  push(state.fallbacks, {
    label: details.label || null,
    provider: details.provider || null,
    outcome: details.outcome || 'failed',
    code: details.code || null,
    classification: details.classification || null,
    reason: String(details.reason || '').slice(0, 180),
  });
}

function snapshot() {
  return {
    retries: [...state.retries],
    fallbacks: [...state.fallbacks],
  };
}

function reset() {
  state.retries.length = 0;
  state.fallbacks.length = 0;
}

module.exports = { recordRetry, recordFallback, snapshot, reset, MAX_EVENTS };
