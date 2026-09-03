'use strict';

async function metadata(sock, chatId) {
  if (!chatId || !String(chatId).endsWith('@g.us')) throw new Error('group_only');
  return sock.groupMetadata(chatId);
}

async function participants(sock, chatId) {
  const meta = await metadata(sock, chatId);
  return meta?.participants || [];
}

function ids(list = []) { return list.map(p => p?.id || p?.lid || p?.phoneNumber).filter(Boolean); }
function admins(list = []) { return list.filter(p => !!p?.admin); }
function nonAdmins(list = []) { return list.filter(p => !p?.admin); }

function targetsFromMessage(message, { mentioned = true, replied = true } = {}) {
  const ci = message?.message?.extendedTextMessage?.contextInfo || {};
  if (mentioned && Array.isArray(ci.mentionedJid) && ci.mentionedJid.length) return [...ci.mentionedJid];
  if (replied && ci.participant) return [ci.participant];
  return [];
}

module.exports = { metadata, participants, ids, admins, nonAdmins, targetsFromMessage };
