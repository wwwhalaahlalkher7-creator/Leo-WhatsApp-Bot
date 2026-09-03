'use strict';

const assert = require('assert');
const { withRetry, retryAfterMs, shouldRetry, delayFor } = require('./lib/providers/core/retry');

(async () => {
  const transient = Object.assign(new Error('rate limited'), {
    status: 429,
    response: { headers: { 'retry-after': '0' } },
  });
  assert.strictEqual(shouldRetry(transient), true);
  assert.strictEqual(retryAfterMs(transient), 0);
  assert.strictEqual(delayFor(transient, 1, { retryAfterMaxMs: 1000 }), 0);

  const permanent = Object.assign(new Error('not found'), { status: 404 });
  assert.strictEqual(shouldRetry(permanent), false);

  const circuit = Object.assign(new Error('circuit open'), { code: 'PROVIDER_CIRCUIT_OPEN' });
  assert.strictEqual(shouldRetry(circuit), false);

  let calls = 0;
  const success = await withRetry(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('temporary'), { status: 503 });
    return 'ok';
  }, { maxRetries: 1, baseDelayMs: 0 });
  assert.strictEqual(success, 'ok');
  assert.strictEqual(calls, 2);

  calls = 0;
  await assert.rejects(() => withRetry(async () => {
    calls += 1;
    throw permanent;
  }, { maxRetries: 3, baseDelayMs: 0 }));
  assert.strictEqual(calls, 1);

  calls = 0;
  await assert.rejects(() => withRetry(async () => {
    calls += 1;
    throw Object.assign(new Error('down'), { status: 503 });
  }, { maxRetries: 1, baseDelayMs: 0 }));
  assert.strictEqual(calls, 2);

  console.log('Provider retry policy tests: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
