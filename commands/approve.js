const isOwnerOrSudo = require('../lib/isOwner');
const { approveGroup, extractGroupId } = require('../lib/access-control');

function quotedText(message) {
  const q = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  return q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || q?.videoMessage?.caption || '';
}

async function approveCommand(sock, chatId, message, requestedGroupId = '') {
  const senderId = message.key.participant || message.key.remoteJid;
  const alt = message.key.participantAlt || message.key.remoteJidAlt || null;
  const owner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId, alt);
  if (!owner) return sock.sendMessage(chatId, { text: '❌ هذا الأمر للمالك فقط.' }, { quoted: message });

  let groupId = chatId.endsWith('@g.us') ? chatId : null;
  if (!groupId) groupId = extractGroupId(requestedGroupId) || extractGroupId(quotedText(message));
  if (!groupId) return sock.sendMessage(chatId, { text: '📌 استخدم `.موافقة` داخل المجموعة، أو رد في الخاص على رسالة إشعار إضافة LeoBot إلى المجموعة ثم أرسل `.موافقة`.' }, { quoted: message });

  approveGroup(groupId);
  try {
    const metadata = await sock.groupMetadata(groupId);
    await sock.sendMessage(groupId, { text: '✅ تمت موافقة مالك LeoBot على تشغيل البوت في هذه المجموعة. 🤖' });
    await sock.sendMessage(chatId, { text: `✅ تمت الموافقة على مجموعة: *${metadata?.subject || groupId}*\n🆔 ${groupId}` }, { quoted: message });
  } catch {
    await sock.sendMessage(chatId, { text: `✅ تمت الموافقة على المجموعة ${groupId}.` }, { quoted: message });
  }
}
module.exports = approveCommand;
