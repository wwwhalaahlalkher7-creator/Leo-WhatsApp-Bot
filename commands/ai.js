const ai = require('../systems/ai');
const aiContext = ai.context;
const economyMessages = require('../systems/economy/messages');
const { t } = require('../lib/i18n');
const mediaAI = require('../systems/ai/media');
const aiProvider = require('../systems/provider/ai');

async function aiCommand(sock, chatId, message, userId, mode = 'ai', economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  const priceKey = economy.prices[mode] != null ? mode : 'ai';
  const cost = economy.cost(priceKey);
  try {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || message.message?.documentMessage?.caption || '';
    const parts = text.trim().split(/\s+/);
    parts.shift();
    const queryText = parts.join(' ').trim();
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    let query = queryText || (quotedText ? 'علّق على الرسالة المقتبسة وقدم ردًا مفيدًا عليها.' : '');
    const mediaTarget = mediaAI.currentOrQuoted(message);
    let mediaContent = null;
    let transcript = '';

    if (mediaTarget?.type === 'image') {
      const buffer = await mediaAI.download(mediaTarget);
      const mimeType = mediaAI.mime(mediaTarget);
      const instruction = query || 'حلّل الصورة بدقة، صف ما تراه، واستخرج النص المهم منها إن وجد. إذا كان هناك شيء غير واضح صرّح بذلك.';
      mediaContent = [
        { type: 'text', text: instruction },
        { type: 'image_url', image_url: { url: mediaAI.imageDataUrl(buffer, mimeType) } },
      ];
      query = instruction;
    } else if (mediaTarget?.type === 'audio') {
      const buffer = await mediaAI.download(mediaTarget);
      transcript = await aiProvider.transcribeAudio(buffer, mediaAI.filename(mediaTarget), mediaAI.mime(mediaTarget));
      query = queryText
        ? `${queryText}

النص المستخرج من التسجيل الصوتي:
${transcript}`
        : `استمع إلى مضمون التسجيل عبر النص المستخرج أدناه، ثم أجب أو لخّصه بشكل مفيد:
${transcript}`;
    } else if (!query && mediaTarget?.type === 'document') {
      query = 'حلّل الملف المرفق وقدّم أهم ما يمكن استخراجه منه.';
    }

    if (!query) {
      return sock.sendMessage(chatId, { text: t('ai.usage') }, { quoted: message });
    }

    const aiOptions = { chatId, userId, mediaKey: message.key?.id || '' };
    const requestKey = ai.requestKey(query, aiOptions);
    if (requestKey && ai.inFlight?.has(requestKey)) {
      const result = await ai.inFlight.get(requestKey).promise;
      if (result?.text) await sock.sendMessage(chatId, { text: result.text }, { quoted: message });
      return;
    }

    const payment = await economy.runPaid({
      userId, priceKey, reason: `ai:${mode}`, refundReason: `refund:ai:${mode}`,
      task: async () => {
        await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });
        const key = aiContext.keyFor(chatId, userId);
        const previousContext = aiContext.format(chatId, userId);
        const replyContext = quotedText ? `الرسالة التي يرد عليها المستخدم:\n${quotedText}` : '';
        const result = await ai.chat(query, {
          language: 'ar',
          context: [previousContext, replyContext].filter(Boolean).join('\n\n'),
          conversationKey: key,
          chatId,
          userId,
          ...(mediaContent ? { content: mediaContent } : {}),
        });
        const reply = result?.text;
        if (!reply) throw new Error('AI provider returned an empty response');
        aiContext.addUser(chatId, userId, query);
        aiContext.addAssistant(chatId, userId, reply);
        await sock.sendMessage(chatId, { text: reply }, { quoted: message });
      },
    });
    if (!payment.ok) return sock.sendMessage(chatId, { text: economyMessages.insufficient(cost, payment.balance) }, { quoted: message });
  } catch (error) {
    console.error('[AI]', error.message, error.failures || '');
    await sock.sendMessage(chatId, { text: t('ai.failed') }, { quoted: message });
  }
}

module.exports = aiCommand;