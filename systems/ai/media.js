'use strict';

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const input = require('../input');

function unwrap(message) {
  if (!message) return null;
  if (message.ephemeralMessage?.message) return unwrap(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return unwrap(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return unwrap(message.viewOnceMessageV2.message);
  return message;
}

function currentOrQuoted(message) {
  const root = unwrap(message?.message || message) || {};
  const direct = input.media({ message: root });
  if (direct) return { ...direct, source: 'current' };
  const ctx = root.extendedTextMessage?.contextInfo || root.imageMessage?.contextInfo || root.videoMessage?.contextInfo || root.documentMessage?.contextInfo || {};
  const quoted = unwrap(ctx.quotedMessage);
  const quotedMedia = input.media({ message: quoted });
  if (quotedMedia) return { ...quotedMedia, source: 'quoted' };
  return null;
}

function baileysType(type) {
  return type === 'image' ? 'image' : type === 'video' ? 'video' : type === 'audio' ? 'audio' : type === 'sticker' ? 'sticker' : 'document';
}

async function download(target) {
  if (!target?.value) return null;
  const stream = await downloadContentFromMessage(target.value, baileysType(target.type));
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > 25 * 1024 * 1024) throw new Error('ملف الوسائط أكبر من الحد المسموح للتحليل.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function mime(target) {
  return String(target?.value?.mimetype || (target?.type === 'image' ? 'image/jpeg' : target?.type === 'audio' ? 'audio/ogg' : 'application/octet-stream'));
}

function filename(target) {
  return String(target?.value?.fileName || target?.value?.title || `leo-${target?.type || 'media'}`);
}

function imageDataUrl(buffer, mimeType) {
  return `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
}

module.exports = { currentOrQuoted, download, mime, filename, imageDataUrl };
