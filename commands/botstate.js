const { t } = require('../lib/i18n');
const isOwnerOrSudo = require('../lib/isOwner');
const { isBotEnabled, setBotEnabled } = require('../lib/access-control');

async function botStateCommand(sock, chatId, message, action) {
  const senderId = message.key.participant || message.key.remoteJid;
  const alt = message.key.participantAlt || message.key.remoteJidAlt || null;
  const owner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId, alt);
  if (!owner) return sock.sendMessage(chatId, { text: t('common.ownerOnlyShort') }, { quoted: message });

  const sub = String(action || '').trim().toLowerCase();
  if (!['on', 'off'].includes(sub)) {
    return sock.sendMessage(chatId, {
      text: '🤖 *التحكم في تشغيل البوت*\n\n• `.البوت تشغيل` — تشغيل البوت\n• `.البوت إيقاف` — إيقاف البوت'
    }, { quoted: message });
  }

  const enabled = sub === 'on';
  if (enabled && isBotEnabled()) {
    return sock.sendMessage(chatId, { text: '⚠️ LeoBot يعمل بالفعل.' }, { quoted: message });
  }
  if (!enabled && !isBotEnabled()) {
    return sock.sendMessage(chatId, { text: '⚠️ LeoBot متوقف بالفعل.' }, { quoted: message });
  }
  setBotEnabled(enabled);
  return sock.sendMessage(chatId, {
    text: enabled
      ? '▶️ تم تشغيل LeoBot. البوت جاهز للعمل.'
      : '⏸️ تم إيقاف LeoBot. لن يستجيب لأي رسائل حتى تستخدم `.البوت تشغيل`.'
  }, { quoted: message });
}
module.exports = botStateCommand;
