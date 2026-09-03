#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JsonStore } = require('./lib/storage');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leo-json-store-'));
  try {
    const store = new JsonStore(dir);

    await Promise.all(Array.from({ length: 50 }, () =>
      store.update('counter', data => ({ count: (data.count || 0) + 1 }), { count: 0 })
    ));
    if (store.read('counter').count !== 50) throw new Error('serialized update test failed');

    fs.writeFileSync(path.join(dir, 'race.json'), JSON.stringify({ value: 1 }));
    store.read('race');
    const pending = store.update('race', () => ({ value: 2 }));
    store.writeSync('race', { value: 99 });
    await pending;
    if (store.read('race').value !== 99) throw new Error('sync/async stale-write protection failed');

    fs.writeFileSync(path.join(dir, 'corrupt.json'), '{not-json');
    let detected = false;
    try { store.read('corrupt', {}); } catch (error) { detected = /Corrupt JSON storage/.test(error.message); }
    if (!detected) throw new Error('corruption detection failed');

    let blocked = false;
    try { store.read('../outside'); } catch { blocked = true; }
    if (!blocked) throw new Error('path traversal protection failed');

    console.log('✅ Storage tests passed: queue serialization, stale-write protection, corruption detection, path traversal protection');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(`❌ Storage tests failed: ${error.message}`); process.exit(1); });
