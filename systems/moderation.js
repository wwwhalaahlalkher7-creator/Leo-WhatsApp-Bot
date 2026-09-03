'use strict';

const group = require('./group');
const settings = require('../settings');

function senderId(message) {
  return message?.key?.participant || message?.key?.remoteJid || null;
}

function altSenderId(message) {
  return message?.key?.participantAlt || message?.key?.remoteJidAlt || null;
}

function targets(message, mentionedJids) {
  if (Array.isArray(mentionedJids) && mentionedJids.length) return [...new Set(mentionedJids.filter(Boolean))];
  return group.targetsFromMessage(message);
}

function numericPart(value) {
  return String(value || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
}

function sameParticipant(a, b) {
  if (!a || !b) return false;
  if (String(a) === String(b)) return true;
  const na = numericPart(a), nb = numericPart(b);
  return !!na && !!nb && na === nb;
}

function participantMatches(participant, jid) {
  return [participant?.id, participant?.lid, participant?.phoneNumber, participant?.phone_number]
    .filter(Boolean).some(id => sameParticipant(id, jid));
}

function findParticipants(participants, jids) {
  const list = Array.isArray(participants) ? participants : [];
  return (Array.isArray(jids) ? jids : []).map(jid => list.find(p => participantMatches(p, jid))).filter(Boolean);
}

async function resolveTargets(sock, chatId, message, mentionedJids) {
  const jids = targets(message, mentionedJids);
  if (!jids.length) return { jids: [], participants: [] };
  let participants = [];
  try { participants = await group.participants(sock, chatId); } catch {}
  return { jids, participants: findParticipants(participants, jids) };
}

function botIdentities(sock) {
  const raw = [sock?.user?.id, sock?.user?.lid].filter(Boolean);
  const values = new Set(raw);
  for (const id of raw) {
    values.add(`${numericPart(id)}@s.whatsapp.net`);
    values.add(`${numericPart(id)}@lid`);
  }
  return values;
}



function cleanNumber(value) {
  return numericPart(value);
}

/**
 * Returns true only for the configured bot owner (never Sudo).
 * Resolves WhatsApp LID/phone identities when group metadata is available.
 */
async function isOwnerTarget(sock, chatId, jid, participants = []) {
  const ownerNumber = cleanNumber(settings.ownerNumber);
  if (!ownerNumber || !jid) return false;
  if (cleanNumber(jid) === ownerNumber) return true;

  const list = Array.isArray(participants) && participants.length
    ? participants
    : (sock && chatId && String(chatId).endsWith('@g.us')
      ? (await group.participants(sock, chatId).catch(() => []))
      : []);

  const ownerParticipant = list.find(p => [p?.id, p?.lid, p?.phoneNumber, p?.phone_number]
    .filter(Boolean).some(id => cleanNumber(id) === ownerNumber));
  if (!ownerParticipant) return false;

  return [ownerParticipant.id, ownerParticipant.lid, ownerParticipant.phoneNumber, ownerParticipant.phone_number]
    .filter(Boolean).some(id => sameParticipant(id, jid));
}

async function protectionReason(sock, chatId, jid, participants = []) {
  if (isBotTarget(sock, jid, participants)) return 'bot';
  if (await isOwnerTarget(sock, chatId, jid, participants)) return 'owner';
  return null;
}

async function guardTargets(sock, chatId, jids, participants = []) {
  const protectedList = await protectedTargets(sock, chatId, jids, participants);
  if (!protectedList.length) return { ok: true, protected: [] };
  return { ok: false, protected: protectedList };
}

async function protectedTargets(sock, chatId, jids, participants = []) {
  const result = [];
  for (const jid of (Array.isArray(jids) ? jids : [])) {
    const reason = await protectionReason(sock, chatId, jid, participants);
    if (reason) result.push({ jid, reason });
  }
  return result;
}

function protectionMessage(reason) {
  if (reason === 'owner') return '👑 مالك البوت محمي من الطرد والتحذير والحظر.';
  if (reason === 'bot') return '🤖 حساب ليو محمي من الطرد والتحذير والحظر.';
  return '🛡️ هذا العضو محمي ولا يمكن تنفيذ إجراء الإدارة عليه.';
}

async function guardAction(sock, chatId, jid, participants = []) {
  const reason = await protectionReason(sock, chatId, jid, participants);
  return { ok: !reason, reason, message: protectionMessage(reason) };
}

function isBotTarget(sock, jid, participants = []) {
  const bot = botIdentities(sock);
  if (bot.has(jid)) return true;
  const botIds = botIdentities(sock);
  return participants.some(p => participantMatches(p, jid) && [...botIds].some(id => participantMatches(p, id)));
}

module.exports = {
  senderId,
  altSenderId,
  targets,
  sameParticipant,
  findParticipants,
  resolveTargets,
  isBotTarget,
  isOwnerTarget,
  protectionReason,
  protectedTargets,
  guardTargets,
  guardAction,
  protectionMessage,
};
