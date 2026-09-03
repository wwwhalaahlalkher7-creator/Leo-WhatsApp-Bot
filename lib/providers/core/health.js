const { requestJson } = require('./http');

const state = new Map();
function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DEFAULTS = {
  failureThreshold: 2,
  cooldownMs: 60000,
  successReset: 1,
};

function now() { return Date.now(); }

const { classifyError } = require('./errors');

function get(name) {
  if (!state.has(name)) state.set(name, { name, status: 'healthy', failures: 0, successes: 0, openedAt: null, halfOpenAt: null, probeInFlight: false, lastError: null, lastErrorClass: null, lastSuccessAt: null, lastFailureAt: null, latencyMs: null, checks: 0 });
  return state.get(name);
}
function isOpen(name) {
  const s = get(name);
  if (s.status !== 'open') return false;
  if (now() - s.openedAt >= DEFAULTS.cooldownMs) {
    s.status = 'half-open';
    s.halfOpenAt = now();
    return false;
  }
  return true;
}

function canRun(name) {
  return !isOpen(name);
}
function success(name, latencyMs) {
  const s = get(name);
  s.probeInFlight = false;
  s.halfOpenAt = null;
  s.status = 'healthy';
  s.failures = 0;
  s.successes += 1;
  s.lastSuccessAt = new Date().toISOString();
  s.latencyMs = latencyMs ?? s.latencyMs;
  s.lastError = null;
  s.checks += 1;
}
function failure(name, error) {
  const s = get(name);
  const classification = classifyError(error);
  s.probeInFlight = false;
  s.failures += 1;
  s.successes = 0;
  s.lastFailureAt = new Date().toISOString();
  s.lastError = error?.message || String(error);
  s.lastErrorClass = classification;
  s.checks += 1;
  if (classification === 'permanent') {
    s.status = 'degraded';
    return;
  }
  if (s.failures >= DEFAULTS.failureThreshold) {
    s.status = 'open';
    s.openedAt = now();
  } else {
    s.status = 'degraded';
  }
}
async function run(name, fn) {
  const s = get(name);
  if (isOpen(name)) {
    const error = new Error(`Provider circuit open: ${name}`);
    error.code = 'PROVIDER_CIRCUIT_OPEN';
    throw error;
  }
  if (s.status === 'half-open' && s.probeInFlight) {
    const error = new Error(`Provider circuit half-open probe in progress: ${name}`);
    error.code = 'PROVIDER_PROBE_IN_PROGRESS';
    throw error;
  }
  if (s.status === 'half-open') s.probeInFlight = true;
  const started = now();
  try {
    const result = await fn();
    success(name, now() - started);
    return result;
  } catch (error) {
    failure(name, error);
    throw error;
  }
}


async function probe(name, url, options = {}) {
  const started = now();
  try {
    const result = await run(name, () => requestJson(url, { timeout: options.timeout || 10000, ...options }));
    return { name, ok: true, status: get(name).status, latencyMs: now() - started, result };
  } catch (error) {
    return { name, ok: false, status: get(name).status, latencyMs: now() - started, error: error.message, code: error.code };
  }
}
function reset(name) {
  if (name) state.delete(name); else state.clear();
}
function snapshot() {
  return Array.from(state.values()).map(s => ({ ...s, cooldownRemainingMs: s.status === 'open' ? Math.max(0, DEFAULTS.cooldownMs - (now() - s.openedAt)) : 0 }));
}
module.exports = { run, probe, canRun, reset, snapshot, get, classifyError };
