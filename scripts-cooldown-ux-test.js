'use strict';
const assert = require('assert');
const { CooldownManager } = require('./systems/cooldown');
const { formatDuration, waitMessage } = require('./systems/cooldown/messages');

assert.strictEqual(formatDuration(1000), '1 ثانية');
assert.strictEqual(formatDuration(2000), '2 ثانيتين');
assert.strictEqual(formatDuration(42000), '42 ثانية');
assert.strictEqual(formatDuration(60000), '1 دقيقة');
assert.strictEqual(formatDuration(3600000), '1 ساعة');
assert.ok(waitMessage(42000).includes('42 ثانية'));

let now = 1000;
const manager = new CooldownManager({ now: () => now });
const first = manager.consume('command', 'demo:user', 60000);
assert.strictEqual(first.ok, true);
const blocked = manager.consume('command', 'demo:user', 60000);
assert.strictEqual(blocked.ok, false);
assert.strictEqual(blocked.remaining, 60000);
assert.strictEqual(manager.rollback('command', 'demo:user', first.token), true);
assert.strictEqual(manager.check('command', 'demo:user').ok, true);

now += 60000;
const second = manager.consume('command', 'demo:user', 60000);
assert.strictEqual(manager.rollback('command', 'demo:user', first.token), false);
assert.strictEqual(manager.check('command', 'demo:user').ok, false);
assert.strictEqual(manager.rollback('command', 'demo:user', second.token), true);
console.log('Cooldown UX tests passed');
