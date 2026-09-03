'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CooldownManager } = require('./systems/cooldown');
const { JsonStore } = require('./lib/storage');

function testCooldownReservationRollback() {
  let now = 1000;
  const cd = new CooldownManager({ now: () => now });
  const first = cd.consume('command', 'demo:u1', 60000);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(cd.check('command', 'demo:u1').ok, false);
  assert.strictEqual(cd.rollback('command', 'demo:u1', first.token), true);
  assert.strictEqual(cd.check('command', 'demo:u1').ok, true);
}

function testStaleRollbackCannotEraseNewCooldown() {
  let now = 1000;
  const cd = new CooldownManager({ now: () => now });
  const first = cd.consume('command', 'demo:u1', 1000);
  now = 2501;
  const second = cd.consume('command', 'demo:u1', 60000);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(cd.rollback('command', 'demo:u1', first.token), false);
  assert.strictEqual(cd.check('command', 'demo:u1').ok, false);
}

async function testEconomyAtomicChargeAndRefund() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leo-economy-test-'));
  const store = new JsonStore(tmp);
  const file = 'credits';
  const id = 'u1';
  await store.write(file, { users: { [id]: { balance: 100, transactions: [] } } });
  let charged = false;
  await store.update(file, data => {
    const user = data.users[id];
    if (user.balance < 30) return data;
    user.balance -= 30;
    charged = true;
    return data;
  }, { users: {} });
  assert.strictEqual(charged, true);
  assert.strictEqual(store.read(file).users[id].balance, 70);
  await store.update(file, data => {
    data.users[id].balance += 30;
    return data;
  }, { users: {} });
  assert.strictEqual(store.read(file).users[id].balance, 100);
  fs.rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  testCooldownReservationRollback();
  testStaleRollbackCannotEraseNewCooldown();
  await testEconomyAtomicChargeAndRefund();
  console.log('✅ Cooldown/economy tests passed: reservation rollback, stale-token protection, atomic charge/refund');
})().catch(error => { console.error('❌ Cooldown/economy tests failed:', error); process.exit(1); });
