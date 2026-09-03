'use strict';
const assert = require('node:assert/strict');
const interaction = require('./systems/interaction');
const input = require('./systems/input');

const directImage = { message: { imageMessage: { mimetype: 'image/jpeg' } } };
const quotedImage = { message: { extendedTextMessage: { contextInfo: { stanzaId: 'abc', participant: '1@s.whatsapp.net', quotedMessage: { imageMessage: { mimetype: 'image/jpeg' } } } } } };
const mention = { message: { extendedTextMessage: { contextInfo: { mentionedJid: ['2@s.whatsapp.net'] } } } };
const plain = { message: { conversation: '.x' } };

assert.equal(input.mediaTarget(directImage).source, 'direct');
assert.equal(input.mediaTarget(quotedImage).source, 'quoted');
assert.equal(interaction.validate(directImage, 'media').ok, true);
assert.equal(interaction.validate(quotedImage, 'media').ok, true);
assert.equal(interaction.validate(plain, 'media').reason, 'media_required');
assert.equal(interaction.validate(quotedImage, 'reply-required').ok, true);
assert.equal(interaction.validate(plain, 'reply-required').reason, 'reply_required');
assert.equal(interaction.validate(mention, 'mention').ok, true);
assert.equal(interaction.validate(plain, 'mention').reason, 'mention_required');
assert.equal(interaction.validate(quotedImage, 'mention-or-reply').ok, true);
assert.equal(interaction.validate(plain, 'mention-or-reply').reason, 'mention_or_reply_required');
console.log('✅ Interaction tests passed: media targets, replies, mentions, and fail-closed validation');
