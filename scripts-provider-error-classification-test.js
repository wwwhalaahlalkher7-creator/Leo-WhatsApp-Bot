'use strict';
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === './http') return { requestJson: async () => ({}) };
  if (request === '../../lib/providers/core/health') return { classifyError: originalHealthClassify };
  return originalLoad.apply(this, arguments);
};

const originalHealthClassify = (() => {
  const path = require.resolve('./lib/providers/core/health');
  delete require.cache[path];
  return require(path).classifyError;
})();

(async () => {
  try {
    const health = require('./lib/providers/core/health');
    assert.strictEqual(health.classifyError({ status: 429 }), 'transient');
    assert.strictEqual(health.classifyError({ status: 503 }), 'transient');
    assert.strictEqual(health.classifyError({ code: 'ETIMEDOUT' }), 'transient');
    assert.strictEqual(health.classifyError({ status: 403 }), 'permanent');
    assert.strictEqual(health.classifyError({ status: 404 }), 'permanent');
    assert.strictEqual(health.classifyError({ message: 'Invalid input' }), 'permanent');

    health.reset('permanent-test');
    for (let i = 0; i < 4; i++) {
      await assert.rejects(() => health.run('permanent-test', async () => {
        const e = new Error('HTTP 403'); e.status = 403; throw e;
      }));
    }
    assert.strictEqual(health.get('permanent-test').status, 'degraded');

    health.reset('transient-test');
    for (let i = 0; i < 2; i++) {
      await assert.rejects(() => health.run('transient-test', async () => {
        const e = new Error('HTTP 503'); e.status = 503; throw e;
      }));
    }
    assert.strictEqual(health.get('transient-test').status, 'open');

    const { firstAvailable } = require('./systems/provider');
    const result = await firstAvailable([
      { name: 'Forbidden', op: async () => { const e = new Error('HTTP 403'); e.status = 403; throw e; } },
      { name: 'Backup', op: async () => 'ok' },
    ], 'op');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.provider, 'Backup');
    assert.strictEqual(result.errors[0].classification, 'permanent');
    assert.strictEqual(result.errors[0].status, 403);

    console.log('PASS: provider errors are classified, permanent failures do not open circuits, and fallback preserves structured error metadata');
  } finally {
    Module._load = originalLoad;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
