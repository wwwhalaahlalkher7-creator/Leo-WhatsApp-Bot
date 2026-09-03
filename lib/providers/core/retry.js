'use strict';

const { classifyError } = require('./errors');
const telemetry = require('./telemetry');

const DEFAULTS = Object.freeze({
  maxRetries: 1,
  baseDelayMs: 400,
  maxDelayMs: 5000,
  retryAfterMaxMs: 10000,
});

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function retryAfterMs(error, nowMs = Date.now()) {
  const headers = error?.response?.headers || error?.headers || {};
  let value = headers['retry-after'] ?? headers['Retry-After'];
  if (Array.isArray(value)) value = value[0];
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Math.max(0, Math.round(Number(raw) * 1000));
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - nowMs) : null;
}

function shouldRetry(error) {
  if (!error) return false;
  if (error.code === 'PROVIDER_CIRCUIT_OPEN' || error.code === 'PROVIDER_PROBE_IN_PROGRESS') return false;
  return classifyError(error) === 'transient';
}

function delayFor(error, attempt, options = {}, nowMs = Date.now()) {
  const base = positiveInt(options.baseDelayMs, DEFAULTS.baseDelayMs);
  const max = positiveInt(options.maxDelayMs, DEFAULTS.maxDelayMs);
  const retryCap = positiveInt(options.retryAfterMaxMs, DEFAULTS.retryAfterMaxMs);
  const hinted = retryAfterMs(error, nowMs);
  if (hinted != null) return Math.min(hinted, retryCap);
  return Math.min(max, base * (2 ** Math.max(0, attempt - 1)));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(operation, options = {}) {
  const maxRetries = positiveInt(options.maxRetries, DEFAULTS.maxRetries);
  let attempt = 0;
  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error)) throw error;
      attempt += 1;
      const delayMs = delayFor(error, attempt, options);
      telemetry.recordRetry({ provider: options.providerName, attempt, delayMs, code: error?.code, status: error?.status ?? error?.response?.status, classification: classifyError(error) });
      if (delayMs > 0) await sleep(delayMs);
    }
  }
}

module.exports = {
  DEFAULTS,
  retryAfterMs,
  shouldRetry,
  delayFor,
  withRetry,
};
