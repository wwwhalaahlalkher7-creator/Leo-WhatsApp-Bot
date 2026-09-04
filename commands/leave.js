const isOwnerOrSudo = require('../lib/isOwner');
const { extractGroupId, revokeGroup } = require('../lib/access-control');

function quotedText(message) {
  const q = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  return q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || q?.videoMessage?.caption || '';
}

module.exports = async function leaveCommand(sock, chatId, message, requestedGroupId = '') {
  const sender = message.key.participant || message.key.remoteJid;
  const alt = message.key.participantAlt || message.key.remoteJidAlt || null;

  // Use the same owner/LID resolution as the working owner commands.
  // Baileys v7 can identify the sender by LID, so comparing only the phone
  // number here can incorrectly reject the real owner.
  const owner = message.key.fromMe || await isOwnerOrSudo(sender, sock, chatId, alt);
  if (!owner) {
    return sock.sendMessage(chatId, { text: '❌ هذا الأمر للمالك فقط.' }, { quoted: message });
  }

  const groupId = chatId.endsWith('@g.us')
    ? chatId
    : extractGroupId(requestedGroupId) || extractGroupId(quotedText(message));

  if (!groupId) {
    return sock.sendMessage(chatId, {
      text: '📌 استخدم `.مغادرة` داخل المجموعة، أو رد على إشعار المجموعة في الخاص بـ`.مغادرة`.'
    }, { quoted: message });
  }

  try {
    revokeGroup(groupId);
    await sock.sendMessage(groupId, {
      text: '🚪 سيغادر ليو هذه المجموعة بناءً على طلب المالك. شكرًا لكم. 🤖'
    });
  } catch {}

  try {
    await sock.groupLeave(groupId);
  } catch (error) {
    return sock.sendMessage(chatId, {
      text: '❌ تعذر مغادرة المجموعة حاليًا. حاول مرة أخرى بعد قليل.'
    }, { quoted: message });
  }

  return sock.sendMessage(chatId, {
    text: `🚪 غادر ليو المجموعة بنجاح.
🆔 ${groupId}`
  }, { quoted: message });
};
