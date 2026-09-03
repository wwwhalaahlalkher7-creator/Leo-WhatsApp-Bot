const ai = require('../systems/provider/ai');
const { t } = require('../lib/i18n');
const { optimizeVideo, cleanup } = require('../lib/media-optimizer');
const economyMessages = require('../systems/economy/messages');

async function generateVideo(prompt) {
  try { return await ai.generateVideo(prompt); } catch (error) { const finalError = new Error('لم تتوفر خدمة توليد فيديو حاليًا.'); finalError.failures = [error?.message || String(error)]; throw finalError; }
}

async function soraCommand(sock, chatId, message, userId, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  const priceKey = 'sora';
  const cost = economy.cost(priceKey);
  try {
    const raw = message.message?.conversation?.trim() || message.message?.extendedTextMessage?.text?.trim() || message.message?.imageMessage?.caption?.trim() || message.message?.videoMessage?.caption?.trim() || '';
    const used = raw.split(/\s+/)[0] || '.سورا';
    const args = raw.slice(used.length).trim();
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    const prompt = args || quotedText;
    if (!prompt) return sock.sendMessage(chatId, { text: t('ai.videoUsage') }, { quoted: message });

    const payment = await economy.runPaid({
      userId, priceKey, reason: 'ai:sora', refundReason: 'refund:ai:sora',
      task: async () => {
        await sock.sendMessage(chatId, { text: `⏳ ${t('ai.videoProcessing')}` }, { quoted: message });
        const result = await generateVideo(prompt);
        if (!Buffer.isBuffer(result) && !(typeof result === 'string' && /^https?:\/\//i.test(result))) throw new Error('Video provider returned an unsupported result');
        const optimized = await optimizeVideo(result, { maxWidth: 640, crf: 32, preset: 'medium', audioBitrate: '64k' });
        try {
          await sock.sendMessage(chatId, { video: { url: optimized }, mimetype: 'video/mp4', fileName: 'leo-sora.mp4', caption: t('ai.videoCaption', '', { prompt }) }, { quoted: message });
          await sock.sendMessage(chatId, { text: `✅ تم إنشاء فيديو Sora بنجاح.\n💳 تم احتساب تكلفة الطلب: *${cost}*.` }, { quoted: message });
        } finally { cleanup(optimized); }
      },
    });
    if (!payment.ok) return sock.sendMessage(chatId, { text: economyMessages.insufficient(cost, payment.balance) }, { quoted: message });
  } catch (error) {
    const refunded = Boolean(error?.__leoEconomyRefunded);
    console.error('[SORA]', error?.message || error);
    await sock.sendMessage(chatId, { text: refunded ? '❌ فشل توليد فيديو Sora. تمت إعادة تكلفة الطلب إلى رصيدك.' : '❌ فشل توليد فيديو Sora حاليًا. لم يتم احتساب تكلفة.' }, { quoted: message });
  }
}

module.exports = soraCommand;
