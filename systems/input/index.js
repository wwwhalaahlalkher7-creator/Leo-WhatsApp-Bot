'use strict';

function messageContainer(message) { return message?.message || {}; }

function contextInfo(message) {
  const m = messageContainer(message);
  return m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo || m.documentMessage?.contextInfo || m.audioMessage?.contextInfo || m.stickerMessage?.contextInfo || m.buttonsResponseMessage?.contextInfo || m.listResponseMessage?.contextInfo || {};
}

function quotedMessage(message) { return contextInfo(message)?.quotedMessage || null; }

function args(messageOrText) {
  const raw = typeof messageOrText === 'string' ? messageOrText : text(messageOrText);
  return raw ? raw.split(/\s+/).slice(1) : [];
}

function argumentText(messageOrText) {
  return args(messageOrText).join(' ');
}

function text(message) {
  return String(message?.message?.conversation || message?.message?.extendedTextMessage?.text || message?.message?.imageMessage?.caption || message?.message?.videoMessage?.caption || '').trim();
}

function replyId(message) { return contextInfo(message)?.stanzaId || null; }
function replySender(message) { return contextInfo(message)?.participant || null; }
function isReply(message) { return !!replyId(message); }
function quotedText(message) { const q = quotedMessage(message) || {}; return String(q.conversation || q.extendedTextMessage?.text || q.imageMessage?.caption || q.videoMessage?.caption || q.documentMessage?.caption || q.audioMessage?.caption || '').trim(); }
function mentions(message) { return contextInfo(message)?.mentionedJid || []; }
function isMentioned(message, jid) { return mentions(message).some(x => String(x) === String(jid)); }

function normalizeArabicDigits(value) {
  return String(value ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function number(value, { min = -Infinity, max = Infinity, integer = true } = {}) {
  const normalized = normalizeArabicDigits(String(value ?? '').trim());
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return { ok: false, value: null };
  const n = Number(normalized);
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) return { ok: false, value: null };
  return { ok: true, value: n };
}

function media(message) {
  const m = messageContainer(message);
  if (m.imageMessage) return { type: 'image', value: m.imageMessage, source: 'direct' };
  if (m.videoMessage) return { type: 'video', value: m.videoMessage, source: 'direct' };
  if (m.audioMessage) return { type: 'audio', value: m.audioMessage, source: 'direct' };
  if (m.documentMessage) return { type: 'document', value: m.documentMessage, source: 'direct' };
  if (m.stickerMessage) return { type: 'sticker', value: m.stickerMessage, source: 'direct' };
  return null;
}

function quotedMedia(message) {
  const q = quotedMessage(message);
  if (!q) return null;
  if (q.imageMessage) return { type: 'image', value: q.imageMessage, source: 'quoted' };
  if (q.videoMessage) return { type: 'video', value: q.videoMessage, source: 'quoted' };
  if (q.audioMessage) return { type: 'audio', value: q.audioMessage, source: 'quoted' };
  if (q.documentMessage) return { type: 'document', value: q.documentMessage, source: 'quoted' };
  if (q.stickerMessage) return { type: 'sticker', value: q.stickerMessage, source: 'quoted' };
  return null;
}

function mediaTarget(message) { return media(message) || quotedMedia(message); }

module.exports = { contextInfo, text, args, argumentText, quotedMessage, quotedText, replyId, replySender, isReply, mentions, isMentioned, normalizeArabicDigits, number, media, quotedMedia, mediaTarget };
