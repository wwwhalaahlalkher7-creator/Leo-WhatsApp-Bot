'use strict';

const response = require('../systems/response');
const media = require('../systems/ai/media');
const mediaAI = require('../systems/ai/media-assist');

async function imageAICommand(sock, chatId, message, args = []) {
  try {
    const target = media.currentOrQuoted(message);
    if (!target || target.type !== 'image') {
      return response.text(sock, chatId,
        '🖼️ استخدم الأمر مع صورة أو ردّ به على صورة.\n\n' +
        'مثال:\n.حلل صورة\n.وصف صورة ما الذي يظهر في الصورة؟\n.برومبت صورة',
        message);
    }

    const buffer = await media.download(target);
    const mimeType = media.mime(target);
    const request = String(args.join(' ') || '').trim();
    const rawText =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption || '';
    const commandText = rawText.replace(/^\.\S+(?:\s+\S+)?\s*/u, '').trim();
    const instruction = request || commandText;

    const wantsPrompt = /^(?:برومبت|prompt|برومبت صورة|صورة برومبت)$/i.test(
      String(rawText).replace(/^\./, '').trim()
    ) || /(?:^|\s)(?:برومبت|prompt)(?:\s|$)/i.test(instruction);

    await response.text(sock, chatId, wantsPrompt ? '🎨 جاري بناء Prompt من الصورة...' : '🧠 جاري تحليل الصورة...', message);

    const result = wantsPrompt
      ? await mediaAI.createImagePrompt(buffer, mimeType, instruction)
      : await mediaAI.analyzeImage(buffer, mimeType, instruction);

    if (!result) throw new Error('AI returned empty result');

    const text = wantsPrompt
      ? `🎨 *Prompt مقترح:*\n\n${result}`
      : `🧠 *تحليل الصورة:*\n\n${result}`;

    await response.text(sock, chatId, text, message);
  } catch (error) {
    console.error('[IMAGE-AI]', error?.message || error);
    await response.text(sock, chatId,
      '❌ تعذر تحليل الصورة حاليًا. تأكد من توفر مزود رؤية/نموذج متعدد الوسائط في OmniRoute.',
      message);
  }
}

module.exports = imageAICommand;
