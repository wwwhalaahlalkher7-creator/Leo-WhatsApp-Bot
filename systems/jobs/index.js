'use strict';

/**
 * Lightweight in-process job manager for expensive media/download work.
 *
 * Design goals:
 * - bounded concurrency per job class
 * - FIFO queueing
 * - cancellation before/while queued (best-effort while running)
 * - lifecycle telemetry
 * - automatic stale-job cleanup
 * - no external queue dependency
 *
 * It deliberately does not own provider retry/fallback. Providers keep their
 * existing retry/circuit-breaker logic; this layer only schedules work.
 */

const { randomUUID } = require('crypto');

const DEFAULTS = Object.freeze({
  concurrency: 2,
  maxQueue: 20,
  jobTtlMs: 30 * 60 * 1000,
  maxRuntimeMs: 10 * 60 * 1000,
});

const queues = new Map();
const jobs = new Map();

function configFor(type, options = {}) {
  const key = String(type || 'default');
  if (!queues.has(key)) {
    queues.set(key, {
      type: key,
      concurrency: Math.max(1, Number(options.concurrency) || DEFAULTS.concurrency),
      maxQueue: Math.max(1, Number(options.maxQueue) || DEFAULTS.maxQueue),
      running: 0,
      pending: [],
    });
  }
  return queues.get(key);
}

function now() { return Date.now(); }

function snapshot(job) {
  if (!job) return null;
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    createdAt: new Date(job.createdAt).toISOString(),
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
    attempts: job.attempts,
    ownerId: job.ownerId || null,
    chatId: job.chatId || null,
    error: job.error ? String(job.error) : null,
    result: job.status === 'completed' ? job.result : undefined,
  };
}

function cleanup() {
  const cutoff = now() - DEFAULTS.jobTtlMs;
  for (const [id, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) jobs.delete(id);
  }
}

async function runNext(queue) {
  while (queue.running < queue.concurrency && queue.pending.length) {
    const job = queue.pending.shift();
    if (!job || job.status !== 'queued') continue;

    queue.running += 1;
    job.status = 'running';
    job.startedAt = now();
    job.attempts += 1;

    let timer;
    const controller = new AbortController();
    job.controller = controller;

    try {
      timer = setTimeout(() => {
        controller.abort(new Error(`Job ${job.id} exceeded runtime limit`));
      }, job.maxRuntimeMs);
      timer.unref?.();

      job.result = await job.worker({
        id: job.id,
        type: job.type,
        signal: controller.signal,
        meta: job.meta,
      });

      if (job.status !== 'cancelled') job.status = 'completed';
    } catch (error) {
      if (job.status !== 'cancelled') {
        job.status = controller.signal.aborted ? 'timed_out' : 'failed';
        job.error = error?.message || String(error);
      }
    } finally {
      if (timer) clearTimeout(timer);
      job.finishedAt = now();
      job.controller = null;
      queue.running = Math.max(0, queue.running - 1);
      if (typeof job.onFinish === 'function') {
        try { await job.onFinish(snapshot(job)); } catch (error) {
          console.warn('[JOB] onFinish failed:', error?.message || error);
        }
      }
      setImmediate(() => runNext(queue));
    }
  }
}

function enqueue(type, worker, options = {}) {
  cleanup();
  if (typeof worker !== 'function') throw new TypeError('Job worker must be a function');

  const queue = configFor(type, options);
  if (queue.pending.length >= queue.maxQueue) {
    const error = new Error(`Queue ${queue.type} is full`);
    error.code = 'JOB_QUEUE_FULL';
    throw error;
  }

  const id = options.id || randomUUID();
  if (jobs.has(id)) {
    const error = new Error(`Job ${id} already exists`);
    error.code = 'JOB_DUPLICATE';
    throw error;
  }

  const job = {
    id,
    type: queue.type,
    worker,
    status: 'queued',
    createdAt: now(),
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    ownerId: options.ownerId || null,
    chatId: options.chatId || null,
    meta: options.meta || {},
    maxRuntimeMs: Math.max(1000, Number(options.maxRuntimeMs) || DEFAULTS.maxRuntimeMs),
    onFinish: options.onFinish,
    controller: null,
    result: undefined,
    error: null,
  };

  jobs.set(id, job);
  queue.pending.push(job);
  setImmediate(() => runNext(queue));
  return snapshot(job);
}

function get(id) {
  cleanup();
  return snapshot(jobs.get(id));
}

function list(type) {
  cleanup();
  return [...jobs.values()]
    .filter(job => !type || job.type === type)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(snapshot);
}

function cancel(id, reason = 'cancelled_by_user') {
  const job = jobs.get(id);
  if (!job || ['completed', 'failed', 'timed_out', 'cancelled'].includes(job.status)) return false;

  job.status = 'cancelled';
  job.error = reason;

  for (const queue of queues.values()) {
    const index = queue.pending.indexOf(job);
    if (index !== -1) {
      queue.pending.splice(index, 1);
      job.finishedAt = now();
      return true;
    }
  }

  if (job.controller) {
    try { job.controller.abort(new Error(reason)); } catch {}
  }
  return true;
}

function wait(id, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULTS.maxRuntimeMs + 5000);
  const intervalMs = Math.max(25, Number(options.intervalMs) || 100);
  return new Promise((resolve, reject) => {
    const started = now();
    const tick = () => {
      const job = jobs.get(id);
      if (!job) return reject(new Error(`Job ${id} not found`));
      if (['completed', 'failed', 'timed_out', 'cancelled'].includes(job.status)) {
        return resolve(snapshot(job));
      }
      if (now() - started >= timeoutMs) {
        cancel(id, 'wait_timeout');
        return reject(new Error(`Timed out waiting for job ${id}`));
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function stats() {
  cleanup();
  const result = { queued: 0, running: 0, completed: 0, failed: 0, timed_out: 0, cancelled: 0 };
  for (const job of jobs.values()) {
    if (result[job.status] !== undefined) result[job.status] += 1;
  }
  return result;
}

const manager = { enqueue, get, list, cancel, wait, stats, DEFAULTS };
module.exports = manager;
