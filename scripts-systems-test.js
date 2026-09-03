'use strict';
const assert = require('node:assert/strict');
const systems = require('./systems');

// Command parser: single and multi-word commands.
let parsed = systems.command.parse('.اكس او 5', ['اكس او', 'مسابقة']);
assert.equal(parsed.name, 'اكس او');
assert.deepEqual(parsed.args, ['5']);

// Reply extraction + Arabic numerals.
const msg = { message: { extendedTextMessage: { text: '٥', contextInfo: { stanzaId: 'game-1', participant: 'user-1' } } } };
assert.equal(systems.interaction.replyNumber(msg, 'game-1', { min: 1, max: 9 }).value, 5);
assert.equal(systems.interaction.replyNumber(msg, 'game-2').reason, 'wrong_message');

// Action resolution.
const actionMsg = { message: { extendedTextMessage: { text: 'مغادرة', contextInfo: { stanzaId: 'game-1', participant: 'user-1' } } } };
assert.equal(systems.interaction.replyAction(actionMsg, 'game-1', { leave: ['مغادرة', 'انسحاب'] }).action, 'leave');

// Permission contract.
assert.equal(systems.permission.check({ permission: 'admin' }, { isSenderAdmin: true }).ok, true);
assert.equal(systems.permission.check({ permission: 'admin' }, { isSenderAdmin: false, isOwner: false }).ok, false);

// Session isolation + message binding.
let now = 1000;
const manager = new systems.session.SessionManager({ now: () => now, defaultTtl: 1000 });
const session = manager.create({ type: 'game', chatId: 'chat', ownerId: 'user', activeMessageId: 'm1' });
assert.equal(manager.authorize(session, { chatId: 'chat', ownerId: 'user', messageId: 'm1' }).ok, true);
assert.equal(manager.authorize(session, { chatId: 'chat', ownerId: 'other', messageId: 'm1' }).reason, 'wrong_user');
manager.setActiveMessage(session, 'm2');
assert.equal(manager.authorize(session, { chatId: 'chat', ownerId: 'user', messageId: 'm1' }).reason, 'wrong_message');
now = 2500;
assert.equal(manager.authorize(session, { chatId: 'chat', ownerId: 'user', messageId: 'm2' }).reason, 'expired');

// Cooldown.
now = 1000;
const cooldown = new systems.cooldown.CooldownManager({ now: () => now });
assert.equal(cooldown.consume('user', 'x', 500).ok, true);
assert.equal(cooldown.consume('user', 'x', 500).ok, false);
now += 500;
assert.equal(cooldown.consume('user', 'x', 500).ok, true);

// Provider fallback.
(async () => {
  const result = await systems.provider.firstAvailable([
    systems.provider.define('p1', { run: async () => { throw new Error('down'); } }),
    systems.provider.define('p2', { run: async () => 'ok' }),
  ], 'run');
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'p2');

  console.log('Core systems test passed. No command migration performed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
