'use strict';


function normalizePolicy(policy = {}) {
  const permission = policy.permission || (policy.ownerOnly ? 'owner' : policy.botAdminOnly ? 'botAdmin' : policy.adminOnly ? 'admin' : policy.groupOnly ? 'group' : 'public');
  return Object.freeze({ ...policy, permission });
}

function check(policy = {}, context = {}) {
  const normalized = normalizePolicy(policy);
  const p = normalized.permission;
  // Composite policies are enforced explicitly so metadata such as
  // groupOnly + adminOnly + botAdminOnly cannot collapse into a weaker check.
  if (normalized.groupOnly && !context.isGroup) return { ok: false, reason: 'group_only' };
  if (p === 'public') return { ok: true, reason: null };
  if (p === 'group') return { ok: !!context.isGroup, reason: 'group_only' };
  if (p === 'owner') return { ok: !!context.isOwner, reason: 'owner_only' };
  if (p === 'botAdmin') {
    const botOk = !!context.isBotAdmin || !!context.isOwner;
    const senderOk = (normalized.requireSenderAdmin || context.requireSenderAdmin) ? (!!context.isSenderAdmin || !!context.isOwner) : true;
    return botOk && senderOk ? { ok: true, reason: null } : { ok: false, reason: botOk ? 'admin_only' : 'bot_admin_only' };
  }
  if (p === 'admin') return { ok: !!context.isSenderAdmin || !!context.isOwner, reason: 'admin_only' };
  return { ok: false, reason: 'unknown_permission' };
}

async function authorize(policy, { sock, chatId, senderId, message, isGroup } = {}) {
  const isAdmin = require('../../lib/isAdmin');
  const isOwnerOrSudo = require('../../lib/isOwner');
  const normalized = normalizePolicy(policy);
  const owner = !!message?.key?.fromMe || await isOwnerOrSudo(senderId, sock, chatId, message?.key?.participantAlt || message?.key?.remoteJidAlt || null);
  let admin = { isSenderAdmin: false, isBotAdmin: false };
  if (isGroup !== false && normalized.permission !== 'public' && normalized.permission !== 'owner' && normalized.permission !== 'group') {
    admin = await isAdmin(sock, chatId, senderId, message?.key?.participantAlt || message?.key?.remoteJidAlt || null);
  }
  const result = check(normalized, {
    isGroup: isGroup ?? chatId?.endsWith?.('@g.us'),
    isOwner: owner,
    ...admin,
    requireSenderAdmin: Boolean(normalized.requireSenderAdmin),
  });
  return { ...result, isOwner: owner, ...admin };
}

module.exports = { normalizePolicy, check, authorize };
