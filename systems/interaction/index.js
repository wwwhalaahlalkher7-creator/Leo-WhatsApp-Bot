'use strict';
const input = require('../input');

function quotedId(message) { return input.replyId(message); }

function isReplyTo(message, targetMessageId) {
  const id = quotedId(message);
  return Boolean(id && targetMessageId && id === targetMessageId);
}

function reply(message, targetMessageId = null) {
  if (!input.isReply(message)) return { ok: false, reason: 'not_reply' };
  const id = input.replyId(message);
  if (targetMessageId && id !== targetMessageId) return { ok: false, reason: 'wrong_message', replyId: id };
  return { ok: true, replyId: id, senderId: input.replySender(message), text: input.text(message) };
}

function replyText(message, targetMessageId = null, options = {}) {
  const base = reply(message, targetMessageId);
  if (!base.ok) return base;
  if (options.nonEmpty !== false && !base.text) return { ok: false, reason: 'empty_text' };
  return { ...base, value: base.text };
}

function replyNumber(message, targetMessageId = null, options = {}) {
  const base = replyText(message, targetMessageId);
  if (!base.ok) return base;
  const parsed = input.number(base.text, options);
  return parsed.ok ? { ...base, value: parsed.value } : { ok: false, reason: 'invalid_number', text: base.text };
}

function replyAction(message, targetMessageId, actions = {}, options = {}) {
  const base = replyText(message, targetMessageId);
  if (!base.ok) return base;
  const key = String(base.value).trim().toLowerCase();
  const normalized = {};
  for (const [name, aliases] of Object.entries(actions || {})) {
    normalized[String(name).toLowerCase()] = name;
    for (const alias of (Array.isArray(aliases) ? aliases : [aliases])) normalized[String(alias).trim().toLowerCase()] = name;
  }
  const action = normalized[key];
  if (!action) return options.allowUnknown ? { ...base, action: null, value: base.value } : { ok: false, reason: 'unknown_action', value: base.value };
  return { ...base, action, value: base.value };
}

/** Validate an explicitly declared command interaction before its handler runs. */
function validate(message, interaction, options = {}) {
  switch (interaction) {
    case 'command':
    case 'args':
    case 'number':
    case 'text-session':
    case 'game-session':
      return { ok: true, reason: null };
    case 'reply':
    case 'reply-required':
      return input.isReply(message) ? { ok: true, reason: null, replyId: input.replyId(message) } : { ok: false, reason: 'reply_required' };
    case 'reply-media': {
      if (!input.isReply(message)) return { ok: false, reason: 'reply_required' };
      return input.mediaTarget(message) ? { ok: true, reason: null, media: input.mediaTarget(message) } : { ok: false, reason: 'media_required' };
    }
    case 'media':
      return input.mediaTarget(message) ? { ok: true, reason: null, media: input.mediaTarget(message) } : { ok: false, reason: 'media_required' };
    case 'mention':
      return input.mentions(message).length ? { ok: true, reason: null, mentions: input.mentions(message) } : { ok: false, reason: 'mention_required' };
    case 'mention-or-reply':
      return (input.mentions(message).length || input.isReply(message)) ? { ok: true, reason: null } : { ok: false, reason: 'mention_or_reply_required' };
    default:
      return options.failClosed === false ? { ok: true, reason: null } : { ok: false, reason: 'unknown_interaction' };
  }
}

module.exports = { reply, replyText, replyNumber, replyAction, quotedId, isReplyTo, validate };
