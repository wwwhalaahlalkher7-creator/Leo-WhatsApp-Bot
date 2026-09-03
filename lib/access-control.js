const settings = require('../settings');
const store = require('./storage');

const ACCESS_FILE = 'access-control.json';
const BOT_FILE = 'bot-state.json';
const clean = (jid = '') => String(jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

function readAccess() {
  return store.read(ACCESS_FILE, { groups: {} });
}
function writeAccess(data) { return store.writeSync(ACCESS_FILE, data); }

function ownerJid() {
  const number = clean(settings.ownerNumber);
  return number ? `${number}@s.whatsapp.net` : null;
}

function isBotEnabled() {
  return store.read(BOT_FILE, { enabled: true }).enabled !== false;
}
function setBotEnabled(enabled) {
  store.writeSync(BOT_FILE, { enabled: !!enabled, updatedAt: new Date().toISOString() });
}

function getGroupRecord(groupId) {
  return readAccess().groups?.[groupId] || null;
}
function isGroupApproved(groupId) {
  const record = getGroupRecord(groupId);
  // No implicit/legacy access: every group requires an explicit owner approval.
  return record?.approved === true;
}

function markCurrentGroupsPending(groupIds = []) {
  const data = readAccess();
  data.groups ||= {};
  for (const groupId of groupIds) {
    if (!groupId) continue;
    const current = data.groups[groupId] || {};
    data.groups[groupId] = {
      ...current,
      approved: false,
      pending: true,
      resetAt: current.resetAt || new Date().toISOString(),
    };
  }
  writeAccess(data);
  return data;
}
function markGroupPending(groupId, meta = {}) {
  const data = readAccess();
  data.groups ||= {};
  const current = data.groups[groupId] || {};
  data.groups[groupId] = {
    ...current,
    approved: false,
    pending: true,
    subject: meta.subject || current.subject || '',
    addedBy: meta.addedBy || current.addedBy || '',
    admins: Array.isArray(meta.admins) ? meta.admins : (current.admins || []),
    notifiedAt: current.notifiedAt || new Date().toISOString(),
  };
  writeAccess(data);
  return data.groups[groupId];
}
function approveGroup(groupId, meta = {}) {
  const data = readAccess();
  data.groups ||= {};
  data.groups[groupId] = {
    ...(data.groups[groupId] || {}),
    approved: true,
    pending: false,
    approvedAt: new Date().toISOString(),
    ...meta,
  };
  writeAccess(data);
  return data.groups[groupId];
}
function revokeGroup(groupId) {
  const data = readAccess();
  data.groups ||= {};
  if (data.groups[groupId]) data.groups[groupId].approved = false;
  writeAccess(data);
}
function approvedGroupIds() {
  const data = readAccess();
  return Object.entries(data.groups || {}).filter(([, v]) => v?.approved === true).map(([id]) => id);
}

async function isPrivateSenderAllowed(sock, senderId, alternateSenderId = null) {
  const candidates = [senderId, alternateSenderId].filter(Boolean);
  const owner = clean(settings.ownerNumber);
  if (candidates.some(id => clean(id) === owner)) return true;
  for (const groupId of approvedGroupIds()) {
    try {
      const metadata = await sock.groupMetadata(groupId);
      const found = (metadata?.participants || []).some(p => {
        const ids = [p?.id, p?.lid, p?.phoneNumber, p?.phone_number].filter(Boolean);
        return ids.some(id => candidates.some(c => c === id || clean(c) === clean(id)));
      });
      if (found) return true;
    } catch {}
  }
  return false;
}

function extractGroupId(text = '') {
  const match = String(text).match(/(\d{8,}[-\d]*@g\.us)/i);
  return match ? match[1] : null;
}

async function notifyOwnerGroupAdded(sock, groupId, author) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    const admins = (metadata?.participants || [])
      .filter(p => p?.admin)
      .map(p => p?.id || p?.lid || p?.phoneNumber)
      .filter(Boolean);
    const adminLines = admins.length
      ? admins.map((jid, i) => `${i + 1}. @${String(jid).split('@')[0]}`).join('\n')
      : 'لا يوجد مشرفون معروفون.';
    const addedBy = author ? `@${String(author).split('@')[0]}` : 'غير معروف';
    const text = [
      '🔔 *تمت إضافة LeoBot إلى مجموعة جديدة*',
      '',
      `🏷️ *اسم المجموعة:* ${metadata?.subject || 'بدون اسم'}`,
      `🆔 *معرّف المجموعة:* ${groupId}`,
      `👤 *أضاف البوت:* ${addedBy}`,
      `👥 *عدد الأعضاء:* ${(metadata?.participants || []).length}`,
      '',
      '🛡️ *مشرفو المجموعة:*',
      adminLines,
      '',
      '⛔ البوت لن يعمل داخل هذه المجموعة حتى توافق أنت.',
      '✅ للموافقة: أرسل `.موافقة` في المجموعة، أو رد على هذه الرسالة في الخاص بـ`.موافقة`.',
      '🚪 للمغادرة: رد على هذه الرسالة في الخاص بـ`.مغادرة` إذا أردت أن يغادر ليو المجموعة.',
    ].join('\n');
    const target = ownerJid();
    if (!target) throw new Error('OWNER_NUMBER is not configured');
    await sock.sendMessage(target, { text, mentions: [...admins, ...(author ? [author] : [])] });
  } catch (error) {
    console.error('[access] group notification failed:', error?.message || error);
    try { const target = ownerJid(); if (target) await sock.sendMessage(target, { text: `🔔 تمت إضافة LeoBot إلى مجموعة جديدة.\n🆔 ${groupId}\n⛔ بانتظار موافقتك عبر ".موافقة".` }); } catch {}
  }
}


function getGroupStats(groupIds = null) {
  const data = readAccess();
  const ids = Array.isArray(groupIds) ? groupIds : Object.keys(data.groups || {});
  const pending = ids.filter(id => data.groups?.[id]?.approved === false).map(id => ({ id, ...(data.groups[id] || {}) }));
  const approved = ids.filter(id => data.groups?.[id]?.approved === true);
  return { total: ids.length, approved: approved.length, pending, approvedIds: approved };
}

async function sendPendingGroupWelcome(sock, groupId, author) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    const ownerNumber = clean(settings.ownerNumber);
    const ownerName = settings.botOwner || settings.developerName || 'مالك LeoBot';
    const addedBy = author ? `@${String(author).split('@')[0]}` : 'غير معروف';
    await sock.sendMessage(groupId, {
      text: `╭━━━〔 🤖 ليو هنا 〕━━━╮
┃ أهلًا بكم! تمت إضافة *ليو* إلى هذه المجموعة.
┃
┃ ⛔ *تنبيه:* البوت لن يستقبل أوامر من المجموعة حتى تتم موافقة المالك.
┃
┃ 👑 *المالك:* ${ownerName}
┃ 📱 *رقم المالك:* +${ownerNumber}
┃ 👤 *أضاف البوت:* ${addedBy}
┃
┃ 📌 بعد المراجعة، يمكن للمالك الموافقة باستخدام \.موافقة.
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
      mentions: author ? [author] : []
    });
  } catch (error) { console.error('[access] pending group welcome failed:', error?.message || error); }
}

async function notifyOwnerPendingGroups(sock, pendingGroups) {
  for (const group of pendingGroups || []) {
    try {
      const metadata = await sock.groupMetadata(group.id);
      const admins = (metadata?.participants || []).filter(p => p?.admin).map(p => p?.id || p?.lid || p?.phoneNumber).filter(Boolean);
      const adminLines = admins.length ? admins.map((jid,i)=>`${i+1}. @${String(jid).split('@')[0]}`).join('\n') : 'لا يوجد مشرفون معروفون.';
      const target = ownerJid();
      if (!target) throw new Error('OWNER_NUMBER is not configured');
      await sock.sendMessage(target, { text: `🔔 *مجموعة بانتظار الموافقة*\n\n🏷️ اسم المجموعة: *${metadata?.subject || group.subject || 'بدون اسم'}*\n🆔 المعرّف: ${group.id}\n👥 الأعضاء: ${(metadata?.participants || []).length}\n\n🛡️ المشرفون:\n${adminLines}\n\n⛔ الحالة: غير معتمدة\n✅ للموافقة: رد على هذه الرسالة بـ *.موافقة*\n🚪 للمغادرة: رد بـ *.مغادرة*`, mentions: admins });
    } catch (error) { console.error('[access] pending group summary failed:', error?.message || error); }
  }
}

module.exports = {
  clean, ownerJid, isBotEnabled, setBotEnabled,
  getGroupRecord, isGroupApproved, markGroupPending, markCurrentGroupsPending, approveGroup, revokeGroup,
  approvedGroupIds, isPrivateSenderAllowed, extractGroupId, notifyOwnerGroupAdded, getGroupStats, notifyOwnerPendingGroups, sendPendingGroupWelcome,
};
