const yts = require('yt-search');
const { youtubeVideo } = require('../systems/provider/media');
const { t } = require('../lib/i18n');
const { optimizeVideo, cleanup } = require('../lib/media-optimizer');
const economyMessages = require('../systems/economy/messages');
const jobs = require('../systems/jobs');

module.exports = async function videoCommand(sock, chatId, message, userId, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  const priceKey = 'video';
  const cost = economy.cost(priceKey);
  try {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) return sock.sendMessage(chatId, { text: t('download.video.usage') }, { quoted: message });
    const video = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(query) ? { url: query, title: 'YouTube Video' } : (await yts(query)).videos?.[0];
    if (!video) return sock.sendMessage(chatId, { text: t('download.common.notFound') }, { quoted: message });
    const payment = await economy.runPaid({
      userId, priceKey, reason: 'download:video', refundReason: 'refund:download:video',
      task: async () => {
        const queued = jobs.enqueue('video-download', async ({ signal }) => {
          await sock.sendMessage(chatId, { text: t('download.video.downloading', '', { title: video.title || query }) }, { quoted: message });
          const result = await youtubeVideo(video.url);
          if (signal.aborted) throw new Error('تم إلغاء مهمة الفيديو.');
          const optimized = await optimizeVideo(result.download, { maxWidth: 640, crf: 32, preset: 'medium', audioBitrate: '64k' });
          try {
            await sock.sendMessage(chatId, {
              video: { url: optimized },
              mimetype: 'video/mp4',
              fileName: `${(result.title || video.title || 'video').replace(/[\\/:*?"<>|]/g, '')}.mp4`,
              caption: t('download.video.caption', '', { title: result.title || video.title || t('download.video.defaultTitle') })
            }, { quoted: message });
            return { provider: result.provider || null, title: result.title || video.title || null };
          } finally { cleanup(optimized); }
        }, { ownerId: userId, chatId, meta: { source: video.url }, concurrency: 2, maxQueue: 8, maxRuntimeMs: 8 * 60 * 1000 });
        await jobs.wait(queued.id, { timeoutMs: 9 * 60 * 1000 });
      },
    });
    if (!payment.ok) return sock.sendMessage(chatId, { text: economyMessages.insufficient(cost, payment.balance) }, { quoted: message });
  } catch (error) {
    console.error('[VIDEO]', error);
    await sock.sendMessage(chatId, { text: t('download.video.failed') }, { quoted: message });
  }
};
