const { t } = require('../lib/i18n');

function cleanNumber(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

async function addCommand(sock, chatId, message, args) {
  const number = cleanNumber(args?.[0]);
  if (!number || number.length < 7) {
    return sock.sendMessage(chatId, { text: t('commands.add.usage') }, { quoted: message });
  }
  const jid = `${number}@s.whatsapp.net`;
  try {
    const result = await sock.groupParticipantsUpdate(chatId, [jid], 'add');
    const status = result?.[0]?.status;
    if (status && !['200', 200].includes(status)) {
      const text = status === '403' ? t('commands.add.privacy') : t('commands.add.failed');
      return sock.sendMessage(chatId, { text }, { quoted: message });
    }
    return sock.sendMessage(chatId, { text: t('commands.add.success', '', { number }) }, { quoted: message });
  } catch (error) {
    console.error('[ADD]', error);
    return sock.sendMessage(chatId, { text: t('commands.add.failed') }, { quoted: message });
  }
}

module.exports = addCommand;
