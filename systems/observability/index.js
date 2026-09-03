'use strict';

const store = require('../../lib/storage');

const FILE = 'command-observability.json';
const VERSION = 1;
const MAX_REASON = 240;

function nowIso() { return new Date().toISOString(); }

function cleanReason(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, MAX_REASON) : null;
}

function providerReason(error) {
  const details = Array.isArray(error?.providerErrors) ? error.providerErrors : [];
  if (!details.length) return null;
  return details.slice(0, 3).map(item => {
    const provider = item?.provider || 'provider';
    const classification = item?.classification ? `/${item.classification}` : '';
    const code = item?.code ? ` [${item.code}]` : '';
    const reason = item?.error || 'failed';
    return `${provider}${classification}${code}: ${reason}`;
  }).join(' | ');
}

function reasonFromError(error) {
  return cleanReason(providerReason(error) || error?.message || error?.code || 'unknown_error');
}

function emptyState() {
  return { version: VERSION, commands: {}, updatedAt: null };
}

function readState() {
  const value = store.read(FILE, emptyState());
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState();
  return {
    version: VERSION,
    commands: value.commands && typeof value.commands === 'object' ? value.commands : {},
    updatedAt: value.updatedAt || null,
  };
}

async function record(commandName, status, details = {}) {
  const name = String(commandName || '').trim().toLowerCase();
  if (!name) return;
  const normalizedStatus = status === 'success' ? 'success' : 'failure';
  const entry = {
    status: normalizedStatus,
    usedAt: details.usedAt || nowIso(),
    durationMs: Number.isFinite(Number(details.durationMs)) ? Math.max(0, Math.round(Number(details.durationMs))) : null,
    reason: normalizedStatus === 'failure' ? cleanReason(details.reason || 'unknown_error') : null,
  };
  try {
    await store.update(FILE, state => {
      const next = state && typeof state === 'object' ? state : emptyState();
      next.version = VERSION;
      next.commands = next.commands && typeof next.commands === 'object' ? next.commands : {};
      next.commands[name] = entry;
      next.updatedAt = nowIso();
      return next;
    }, emptyState());
  } catch (error) {
    console.warn('[Observability] Failed to persist command telemetry:', error.message);
  }
}

function get(commandName) {
  const name = String(commandName || '').trim().toLowerCase();
  if (!name) return null;
  return readState().commands[name] || null;
}

function all() { return readState().commands; }

function summarize() {
  const entries = Object.values(all());
  return {
    totalTracked: entries.length,
    success: entries.filter(x => x.status === 'success').length,
    failure: entries.filter(x => x.status === 'failure').length,
    unused: 0,
  };
}

function formatFailureReason(entry) {
  return entry?.reason || 'سبب غير محدد';
}

module.exports = {
  FILE,
  record,
  get,
  all,
  summarize,
  reasonFromError,
  formatFailureReason,
};
