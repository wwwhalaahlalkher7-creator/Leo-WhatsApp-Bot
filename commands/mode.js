const store = require('../lib/storage');
const isOwnerOrSudo = require('../lib/isOwner');
module.exports = async function modeCommand(sock, chatId, message, args = []) {
  const senderId = message.key.participant || message.key.remoteJid;
  const alt = message.key.participantAlt || message.key.remoteJidAlt || null;
  const owner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId, alt);
  if (!owner) return sock.sendMessage(chatId, { text: '❌ هذا الأمر للمالك فقط.' }, { quoted: message });
  const sub = String(args[0] || '').trim().toLowerCase();
  if (!['عام','خاص','public','private','on','off'].includes(sub)) {
    const current = store.read('bot-mode', { isPublic: true });
    return sock.sendMessage(chatId, { text: `⚙️ وضع LeoBot الحالي: ${current.isPublic !== false ? 'عام 🌐' : 'خاص 🔐'}\n\n• .وضع عام\n• .وضع خاص` }, { quoted: message });
  }
  const isPublic = ['عام','public','on'].includes(sub);
  store.writeSync('bot-mode', { isPublic, updatedAt: new Date().toISOString() });
  return sock.sendMessage(chatId, { text: isPublic ? '🌐 تم ضبط LeoBot على الوضع العام.' : '🔐 تم ضبط LeoBot على الوضع الخاص.' }, { quoted: message });
};
