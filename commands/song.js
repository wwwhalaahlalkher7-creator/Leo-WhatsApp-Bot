const yts = require('yt-search');
const { youtubeAudio } = require('../systems/provider/media');
const { t } = require('../lib/i18n');
const { optimizeAudio, cleanup } = require('../lib/media-optimizer');
const economyMessages = require('../systems/economy/messages');

module.exports = async function songCommand(sock, chatId, message, userId, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  const priceKey = 'song';
  const cost = economy.cost(priceKey);
  try {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) return sock.sendMessage(chatId, { text: t('download.song.usage') }, { quoted: message });
    const video = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(query) ? { url: query, title: 'YouTube Audio' } : (await yts(query)).videos?.[0];
    if (!video) return sock.sendMessage(chatId, { text: t('download.common.notFound') }, { quoted: message });
    const payment = await economy.runPaid({
      userId, priceKey, reason: 'download:song', refundReason: 'refund:download:song',
      task: async () => {
        await sock.sendMessage(chatId, { text: t('download.song.downloading', '', { title: video.title || query }) }, { quoted: message });
        const result = await youtubeAudio(video.url);
        const optimized = await optimizeAudio(result.download, { bitrate: '96k', mono: false });
        try { await sock.sendMessage(chatId, { audio: { url: optimized }, mimetype: 'audio/mpeg', fileName: `${(result.title || video.title || 'audio').replace(/[\\/:*?"<>|]/g, '')}.mp3`, ptt: false }, { quoted: message }); }
        finally { cleanup(optimized); }
      },
    });
    if (!payment.ok) return sock.sendMessage(chatId, { text: economyMessages.insufficient(cost, payment.balance) }, { quoted: message });
  } catch (error) {
    console.error('[SONG]', error);
    await sock.sendMessage(chatId, { text: t('download.song.failed') }, { quoted: message });
  }
};
