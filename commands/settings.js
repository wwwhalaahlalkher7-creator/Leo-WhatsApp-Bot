const { t } = require('../lib/i18n');
const dataStore = require('../lib/storage');
const isOwnerOrSudo = require('../lib/isOwner');

function readJsonSafe(name, fallback) { return dataStore.read(String(name).split('/').pop(), fallback); }
function yn(value) { return value ? 'تشغيل ✅' : 'إيقاف ⛔'; }
function actionName(action) { return ({ delete: 'حذف', kick: 'طرد', warn: 'تحذير' }[action] || action || 'غير محدد'); }

async function settingsCommand(sock, chatId, message) {
  try {
    const senderId = message.key.participant || message.key.remoteJid;
    const alt = message.key.participantAlt || message.key.remoteJidAlt || null;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId, alt);
    if (!message.key.fromMe && !isOwner) return sock.sendMessage(chatId, { text: t('common.ownerOnlyShort') }, { quoted: message });

    const isGroup = chatId.endsWith('@g.us');
    const mode = readJsonSafe('bot-mode.json', { isPublic: true });
    const autoStatus = readJsonSafe('autoStatus.json', { enabled: false });
    const autoread = readJsonSafe('autoread.json', { enabled: false });
    const pmblocker = readJsonSafe('pmblocker.json', { enabled: false });
    const userGroupData = readJsonSafe('userGroupData.json', { antilink: {}, antibadword: {}, welcome: {}, goodbye: {}, chatbot: {}, antitag: {} });
    const groupId = isGroup ? chatId : null;
    const g = groupId ? {
      antilink: userGroupData.antilink?.[groupId], antibadword: userGroupData.antibadword?.[groupId],
      welcome: userGroupData.welcome?.[groupId], goodbye: userGroupData.goodbye?.[groupId], chatbot: userGroupData.chatbot?.[groupId], antitag: userGroupData.antitag?.[groupId]
    } : null;

    const lines = [
      '⚙️ *إعدادات LeoBot*', '',
      `• وضع الاستخدام: ${mode.isPublic ? 'عام 🌐' : 'خاص 🔐'}`,
      `• الحالة التلقائية: ${yn(autoStatus.enabled)}`,
      `• القراءة التلقائية: ${yn(autoread.enabled)}`,
      `• حظر الخاص: ${yn(pmblocker.enabled)}`,
    ];
    if (groupId) {
      lines.push('', `📌 *المجموعة:* ${groupId}`,
        `• منع الروابط: ${g.antilink ? `تشغيل (${actionName(g.antilink.action)})` : 'إيقاف ⛔'}`,
        `• الكلمات المسيئة: ${g.antibadword ? `تشغيل (${actionName(g.antibadword.action)})` : 'إيقاف ⛔'}`,
        `• الترحيب: ${yn(Boolean(g.welcome?.enabled))}`,
        `• الوداع: ${yn(Boolean(g.goodbye?.enabled))}`,
        `• الشات بوت: ${yn(Boolean(g.chatbot?.enabled))}`,
        `• منع المنشن: ${g.antitag ? `تشغيل (${actionName(g.antitag.action)})` : 'إيقاف ⛔'}`);
    }
    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
  } catch (error) {
    console.error('Error in settings command:', error);
    await sock.sendMessage(chatId, { text: '❌ تعذر قراءة الإعدادات حاليًا.' }, { quoted: message });
  }
}
module.exports = settingsCommand;
