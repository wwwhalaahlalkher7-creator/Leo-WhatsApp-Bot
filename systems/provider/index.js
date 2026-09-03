'use strict';

const { classifyError } = require('../../lib/providers/core/health');
const { withRetry } = require('../../lib/providers/core/retry');
const telemetry = require('../../lib/providers/core/telemetry');

function errorInfo(error) {
  return {
    provider: error?.provider || null,
    code: error?.code || null,
    status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
    classification: classifyError(error),
    error: error?.message || String(error),
  };
}

async function firstAvailable(providers, operation, ...args) {
  const errors = [];
  for (const provider of providers || []) {
    try {
      if (typeof provider.enabled === 'function' && !provider.enabled()) continue;
      if (typeof provider[operation] !== 'function') continue;
      const value = await withRetry(() => provider[operation](...args), {
        maxRetries: provider.maxRetries,
        baseDelayMs: provider.retryBaseDelayMs,
        maxDelayMs: provider.retryMaxDelayMs,
        retryAfterMaxMs: provider.retryAfterMaxMs,
        providerName: provider.name || null,
      });
      if (value !== undefined && value !== null && value !== '') {
        if (errors.length) telemetry.recordFallback({ label: operation, provider: provider.name, outcome: 'success_after_fallback', reason: `${errors.length} provider failure(s) before success` });
        return { ok: true, value, provider: provider.name || null, errors };
      }
      errors.push({ provider: provider.name || null, code: 'PROVIDER_EMPTY_RESULT', classification: 'permanent', error: 'empty_result' });
      telemetry.recordFallback({ label: operation, provider: provider.name, outcome: 'failed', code: 'PROVIDER_EMPTY_RESULT', classification: 'permanent', reason: 'empty_result' });
    } catch (error) {
      const detail = errorInfo(Object.assign(error || new Error('Unknown provider error'), { provider: provider.name || null }));
      errors.push(detail);
      telemetry.recordFallback({ label: operation, provider: provider.name, outcome: 'failed', code: detail.code, classification: detail.classification, reason: detail.error });
    }
  }
  return { ok: false, value: null, provider: null, errors };
}

function define(name, implementation, enabled = () => true) { return Object.freeze({ name, enabled, ...implementation }); }

async function execute(providers, operation, ...args) {
  const result = await firstAvailable(providers, operation, ...args);
  if (!result.ok) {
    const error = new Error(`${operation}: all providers failed`);
    error.providerErrors = result.errors;
    throw error;
  }
  return result;
}

module.exports = { firstAvailable, execute, define, ai: require('./ai'), media: require('./media'), telemetry };
