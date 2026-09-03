'use strict';

const crypto = require('crypto');
const capabilities = require('./capabilities');
const media = require('./media');

/**
 * AI-assisted image operations shared by commands.
 * The actual image bytes stay in LeoBot; only the multimodal request is sent
 * through the configured AI capability/provider layer.
 */
async function analyzeImage(buffer, mimeType = 'image/jpeg', instruction = '') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('صورة فارغة');
  const prompt = String(instruction || '').trim() ||
    'حلّل الصورة بدقة. صف العناصر والمشهد، اقرأ النص الظاهر إن أمكن، واذكر الأشياء غير المؤكدة بدل اختلاقها. أجب بالعربية بشكل منظم ومختصر.';
  const content = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: media.imageDataUrl(buffer, mimeType) } },
  ];
  return capabilities.vision(prompt, {
    content,
    mediaKey: `image:${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24)}:${mimeType}`,
  });
}

async function createImagePrompt(buffer, mimeType = 'image/jpeg', instruction = '') {
  const prompt = String(instruction || '').trim() ||
    'حلّل الصورة ثم اكتب Prompt احترافيًا بالإنجليزية لإعادة إنشاء صورة مشابهة من حيث الموضوع والتكوين والإضاءة والألوان والأسلوب، بدون افتراض هوية الشخص أو معلومات غير ظاهرة. أعد الـPrompt فقط.';
  const result = await analyzeImage(buffer, mimeType, prompt);
  return result?.text || '';
}

module.exports = Object.freeze({ analyzeImage, createImagePrompt });
