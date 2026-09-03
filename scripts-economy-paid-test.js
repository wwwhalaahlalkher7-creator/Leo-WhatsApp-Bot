'use strict';
const assert = require('assert');
const legacy = require('./lib/economy/credits');
const { createEconomy } = require('./systems/economy');

(async () => {
  const originalCharge = legacy.charge;
  const originalRefund = legacy.refund;
  let charges = 0;
  let refunds = 0;
  legacy.charge = async (_user, amount) => { charges++; return { ok: true, balance: 100 - amount, cost: amount }; };
  legacy.refund = async (_user, amount) => { refunds++; return 100; };

  const economy = createEconomy();
  const success = await economy.runPaid({ userId: 'u', priceKey: 'ai', amount: 10, reason: 'test:paid', refundReason: 'refund:test', task: async () => 'ok' });
  assert.strictEqual(success.ok, true);
  assert.strictEqual(success.charged, true);
  assert.strictEqual(success.result, 'ok');
  assert.strictEqual(charges, 1);
  assert.strictEqual(refunds, 0);

  let failed = false;
  try {
    await economy.runPaid({ userId: 'u', priceKey: 'ai', amount: 10, task: async () => { throw new Error('provider failed'); } });
  } catch (error) {
    failed = true;
    assert.strictEqual(error.__leoEconomyRefunded, true);
  }
  assert.strictEqual(failed, true);
  assert.strictEqual(charges, 2);
  assert.strictEqual(refunds, 1);

  legacy.charge = async () => ({ ok: false, balance: 3, cost: 10 });
  const insufficient = await economy.runPaid({ userId: 'u', priceKey: 'ai', amount: 10, task: async () => { throw new Error('must not run'); } });
  assert.strictEqual(insufficient.ok, false);
  assert.strictEqual(insufficient.charged, false);
  assert.strictEqual(refunds, 1);

  legacy.charge = originalCharge;
  legacy.refund = originalRefund;
  console.log('✅ Paid economy tests passed: single charge, refund-on-failure, insufficient balance, no double refund');
})().catch(error => { console.error(error); process.exitCode = 1; });
