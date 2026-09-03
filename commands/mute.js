const { t } = require('../lib/i18n');
const isAdmin = require('../lib/isAdmin');
const timers = new Map();

function clearMuteTimer(chatId) {
  const timer = timers.get(chatId);
  if (timer) clearTimeout(timer);
  timers.delete(chatId);
}

async function muteCommand(sock, chatId, senderId, message, durationInMinutes, action = 'on') {
  const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, message.key.participantAlt || message.key.remoteJidAlt || null);
  if (!isBotAdmin) return sock.sendMessage(chatId, { text: t('common.botMustBeAdmin') }, { quoted: message });
  if (!isSenderAdmin) return sock.sendMessage(chatId, { text: t('commands.mute.admins') }, { quoted: message });

  try {
    if (action === 'off') {
      clearMuteTimer(chatId);
      await sock.groupSettingUpdate(chatId, 'not_announcement');
      await sock.sendMessage(chatId, { text: t('commands.mute.unmuted') }, { quoted: message });
      return;
    }
    clearMuteTimer(chatId);
    await sock.groupSettingUpdate(chatId, 'announcement');
    if (durationInMinutes !== undefined && durationInMinutes > 0) {
      await sock.sendMessage(chatId, { text: t('commands.mute.minutes', '', { minutes: durationInMinutes }) }, { quoted: message });
      const timer = setTimeout(async () => {
        timers.delete(chatId);
        try { await sock.groupSettingUpdate(chatId, 'not_announcement'); }
        catch (e) { console.error('Error unmuting group:', e); }
        // Intentionally silent: do not send a delayed "unmuted" message.
      }, durationInMinutes * 60 * 1000);
      timers.set(chatId, timer);
    } else {
      await sock.sendMessage(chatId, { text: t('commands.mute.muted') }, { quoted: message });
    }
  } catch (error) {
    console.error('Error muting group:', error);
    await sock.sendMessage(chatId, { text: t('commands.mute.error') }, { quoted: message });
  }
}
module.exports = muteCommand;
module.exports.clearMuteTimer = clearMuteTimer;
