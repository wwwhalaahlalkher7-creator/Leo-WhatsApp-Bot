'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'axios') return { get: async () => ({ data: {} }) };
  if (request === 'ruhend-scraper') return { ttdl: async () => ({}), igdl: async () => ({}) };
  if (request === 'btch-downloader') return {};
  if (request === '../core/health') return { run: async (_name, fn) => fn() };
  return originalLoad.apply(this, arguments);
};

(async () => {
  try {
    const { withFallback, validateFallbackResult } = require('./lib/providers/downloaders');

    assert.strictEqual(validateFallbackResult(null), false);
    assert.strictEqual(validateFallbackResult({ download: 'not-a-url' }), false);
    assert.strictEqual(validateFallbackResult({ download: 'https://cdn.example.test/a.mp3' }), true);
    assert.strictEqual(validateFallbackResult({ media: [{ url: 'https://cdn.example.test/a.mp4', type: 'video' }] }), true);
    assert.strictEqual(validateFallbackResult({ media: [{ url: 'not-a-url', type: 'video' }] }), false);

    const calls = [];
    const result = await withFallback([
      { name: 'BadProvider', run: async () => { calls.push('bad'); return { download: 'not-a-url' }; } },
      { name: 'GoodProvider', run: async () => { calls.push('good'); return { download: 'https://cdn.example.test/file.mp3' }; } },
    ], 'Test media');
    assert.strictEqual(result.provider, 'GoodProvider');
    assert.deepStrictEqual(calls, ['bad', 'good']);

    await assert.rejects(
      () => withFallback([{ name: 'BadOnly', run: async () => ({ download: 'x' }) }], 'Test media'),
      error => error?.message === 'Test media providers exhausted' && /BadOnly: Provider returned an unusable result/.test(error.causes?.[0] || '')
    );

    console.log('PASS: provider fallback rejects unusable media, preserves provider order, and continues to the next provider');
  } finally {
    Module._load = originalLoad;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
