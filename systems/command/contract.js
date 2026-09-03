'use strict';

const PERMISSIONS = new Set(['public', 'group', 'admin', 'botAdmin', 'owner']);
const INTERACTIONS = new Set(['command', 'args', 'reply', 'reply-required', 'number', 'text-session', 'media', 'mention', 'mention-or-reply', 'reply-media', 'game-session']);
const ECONOMY = new Set(['free', 'paid', 'earn', 'reward', 'transfer', 'none']);

function normalizeContract(definition = {}) {
  const ownerOnly = Boolean(definition.ownerOnly);
  const groupOnly = Boolean(definition.groupOnly);
  const adminOnly = Boolean(definition.adminOnly);
  const botAdminOnly = Boolean(definition.botAdminOnly);
  const permission = definition.permission ||
    (ownerOnly ? 'owner' : botAdminOnly ? 'botAdmin' : adminOnly ? 'admin' : groupOnly ? 'group' : 'public');
  if (!PERMISSIONS.has(permission)) throw new Error(`Unknown command permission: ${permission}`);

  const interaction = definition.interaction || inferInteraction(definition);
  if (!INTERACTIONS.has(interaction)) throw new Error(`Unknown command interaction: ${interaction}`);

  const economy = definition.economy || inferEconomy(definition);
  if (!ECONOMY.has(economy.mode)) throw new Error(`Unknown command economy mode: ${economy.mode}`);

  return Object.freeze({
    permission,
    interaction,
    interactionExplicit: Boolean(definition.interaction || definition.interactionType),
    economy: Object.freeze({
      mode: economy.mode,
      price: economy.price ?? 0,
      reason: economy.reason || `command:${definition.name}`,
      refundOnFailure: Boolean(economy.refundOnFailure),
      middleware: economy.middleware !== false,
    }),
    cooldown: definition.cooldown || null,
    provider: definition.provider || null,
    ownerOnly,
    groupOnly,
    adminOnly,
    botAdminOnly,
    requireSenderAdmin: Boolean(definition.requireSenderAdmin || (adminOnly && botAdminOnly)),
  });
}

function inferInteraction(definition) {
  const usage = String(definition.usage || '').toLowerCase();
  const method = String(definition.method || '').toLowerCase();
  if (definition.interactionType) return definition.interactionType;
  if (definition.mediaInput || /رد على (صورة|فيديو|ملف|ملصق|وسائط)/.test(method)) return 'media';
  if (definition.mentionInput || /اذكر العضو|منشن/.test(method + usage)) return 'mention';
  if (/بالرد|رد على/.test(method)) return 'reply';
  if (/<\s*(رقم|1-9|اختيار)/.test(usage)) return 'number';
  if (/<|\[/.test(usage)) return 'args';
  return 'command';
}

function inferEconomy(definition) {
  if (definition.cost != null && Number(definition.cost) > 0) return { mode: 'paid', price: Number(definition.cost) };
  return { mode: 'free', price: 0 };
}

module.exports = { normalizeContract, inferInteraction, inferEconomy, PERMISSIONS, INTERACTIONS, ECONOMY };
