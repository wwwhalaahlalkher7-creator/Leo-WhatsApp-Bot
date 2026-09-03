const { t } = require('../lib/i18n');
const dataStore = require('../lib/storage');
const response = require('../systems/response');
const moderation = require('../systems/moderation');
async function warningsCommand(sock, chatId, mentionedJidList) {
  if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ الأمر متاح داخل المجموعات فقط.' });
  const user = moderation.targets(null, mentionedJidList)[0];
  if (!user) return response.text(sock, chatId, t('common.mentionUser'));
  const data = dataStore.read('warnings', {});
  const count = Number(data?.[chatId]?.[user] || 0);
  await response.text(sock, chatId, `⚠️ عدد تحذيرات @${user.split('@')[0]}: *${count}/3*`, null, { mentions: [user] });
}
module.exports = warningsCommand;
