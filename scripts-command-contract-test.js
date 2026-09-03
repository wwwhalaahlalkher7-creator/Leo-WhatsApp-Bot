'use strict';
const assert = require('node:assert/strict');
const { normalizeContract } = require('./systems/command/contract');
const permission = require('./systems/permission');

const composite = normalizeContract({
  name: 'kick', groupOnly: true, adminOnly: true, botAdminOnly: true,
});
assert.equal(composite.permission, 'botAdmin');
assert.equal(composite.requireSenderAdmin, true);
assert.equal(composite.groupOnly, true);
assert.equal(composite.adminOnly, true);
assert.equal(composite.botAdminOnly, true);

assert.equal(permission.check(composite, { isGroup: false, isOwner: true, isSenderAdmin: true, isBotAdmin: true }).reason, 'group_only');
assert.equal(permission.check(composite, { isGroup: true, isOwner: false, isSenderAdmin: false, isBotAdmin: true }).reason, 'admin_only');
assert.equal(permission.check(composite, { isGroup: true, isOwner: false, isSenderAdmin: true, isBotAdmin: false }).reason, 'bot_admin_only');
assert.equal(permission.check(composite, { isGroup: true, isOwner: false, isSenderAdmin: true, isBotAdmin: true }).ok, true);
assert.equal(permission.check(composite, { isGroup: true, isOwner: true, isSenderAdmin: false, isBotAdmin: false }).ok, true);

const groupAdmin = normalizeContract({ name: 'warn', groupOnly: true, adminOnly: true });
assert.equal(permission.check(groupAdmin, { isGroup: false, isOwner: true, isSenderAdmin: true }).reason, 'group_only');
assert.equal(permission.check(groupAdmin, { isGroup: true, isOwner: false, isSenderAdmin: true }).ok, true);

console.log('Command contract tests passed: composite group/admin/bot-admin policies are fail-closed.');
