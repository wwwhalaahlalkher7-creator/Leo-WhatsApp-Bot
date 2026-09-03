const ai = require('../systems/provider/ai');
const { t } = require('../lib/i18n');
const economyMessages = require('../systems/economy/messages');

async function imagineCommand(sock, chatId, message, userId, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  const priceKey = 'imagine';
  const cost = economy.cost(priceKey);
  try {
    const raw = message.message?.conversation?.trim() || message.message?.extendedTextMessage?.text?.trim() || '';
    const parts = raw.split(/\s+/);
    parts.shift();
    const prompt = parts.join(' ').trim();
    if (!prompt) return sock.sendMessage(chatId, { text: t('ai.imageUsage') }, { quoted: message });

    const payment = await economy.runPaid({
      userId, priceKey, reason: 'ai:imagine', refundReason: 'refund:ai:imagine',
      task: async () => {
        await sock.sendMessage(chatId, { text: t('ai.imageProcessing') }, { quoted: message });
        const imageBuffer = await ai.generateImage(prompt);
        await sock.sendMessage(chatId, { image: imageBuffer, caption: t('ai.imageCaption', '', { prompt }) }, { quoted: message });
      },
    });
    if (!payment.ok) return sock.sendMessage(chatId, { text: economyMessages.insufficient(cost, payment.balance) }, { quoted: message });
  } catch (error) {
    console.error('[IMAGINE]', error?.message || error);
    await sock.sendMessage(chatId, { text: t('ai.imageFailed') }, { quoted: message });
  }
}

module.exports = imagineCommand;
