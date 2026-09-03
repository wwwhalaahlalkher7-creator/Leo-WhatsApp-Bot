const axios = require('axios');
const { requestJson, requestBuffer } = require('../core/http');
const health = require('../core/health');
const settings = require('../../../settings');
const sharp = require('sharp');
const omni = require('./omniroute');

async function translatePromptToEnglish(prompt) {
  const value = String(prompt || '').trim();
  if (!value || !/[\u0600-\u06ff]/.test(value)) return value;
  try {
    const response = await requestJson('https://api.mymemory.translated.net/get', {
      timeout: 15000,
      params: { q: value, langpair: 'ar|en' },
    });
    const translated = response?.responseData?.translatedText;
    if (translated && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(translated)) return translated.trim();
  } catch (error) {
    console.warn('[IMAGE] Arabic prompt translation failed:', error?.message || error);
  }
  return value;
}

/*
 * AI provider order:
 * - Text: OpenAI/Gemini when configured, then public fallbacks.
 * - Images: Cloudflare Workers AI only (free allocation, with a Leo-side daily cap).
 * - Videos: public Hugging Face Gradio/ZeroGPU-compatible provider.
 *
 * Paid OpenAI image/video generation is intentionally not used by default.
 */
const providers = [
  { name: 'omniroute', capabilities: ['text', 'vision'], enabled: () => omni.enabled() && true, async chat(prompt, options = {}) { return omni.chat(prompt, options); } },
  {
    name: 'openai',
    enabled: () => Boolean(process.env.OPENAI_API_KEY) && true,
    async chat(prompt, options = {}) {
      const model = 'gpt-5.6-luna';
      const data = await requestJson('https://api.openai.com/v1/chat/completions', {
        timeout: 45000,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        data: {
          model,
          messages: [
            { role: 'system', content: options?.systemPrompt || 'أجب بدقة ولا تخترع معلومات.' },
            { role: 'user', content: Array.isArray(options?.content) && options.content.length ? options.content : (options?.context ? `سياق مختصر للمحادثة:\n${options.context}\n\nطلب المستخدم الحالي:\n${prompt}` : prompt) },
          ],
          temperature: 0.2,
        },
      });
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error(data?.error?.message || 'OpenAI returned no text');
      return text;
    },
  },
  {
    name: 'google-gemini',
    enabled: () => Boolean(process.env.GEMINI_API_KEY),
    async chat(prompt, options = {}) {
      const model = 'gemini-3.7-flash';
      const key = encodeURIComponent(process.env.GEMINI_API_KEY);
      const data = await requestJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`,
        {
          timeout: 45000,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: {
            systemInstruction: { parts: [{ text: options?.systemPrompt || 'أجب بدقة ولا تخترع معلومات.' }] },
            contents: [{ parts: Array.isArray(options?.geminiParts) && options.geminiParts.length
              ? options.geminiParts
              : (Array.isArray(options?.content) && options.content.length
                ? toGeminiParts(options.content)
                : [{ text: options?.context ? `سياق المحادثة:\n${options.context}\n\nطلب المستخدم الحالي:\n${prompt}` : prompt }]) }],
            ...(options?.grounding ? { tools: [{ google_search: {} }] } : {}),
            generationConfig: { maxOutputTokens: 4096, temperature: 0.2 },
          },
        }
      );
      const text = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('').trim();
      if (!text) throw new Error(data?.error?.message || 'Google Gemini returned no text');
      if (options?.grounding) {
        const metadata = data?.groundingMetadata || data?.grounding_metadata || {};
        const chunks = metadata?.groundingChunks || metadata?.grounding_chunks || [];
        const sources = chunks.map(chunk => chunk?.web || chunk?.retrievedContext || chunk?.retrieved_context)
          .filter(Boolean)
          .map(web => ({ uri: web.uri || web.url, title: web.title || web.name }))
          .filter(x => x.uri);
        // A grounding request is not proof that grounding actually happened.
        // Only mark the answer grounded when the response contains grounding evidence.
        const grounded = chunks.length > 0 || Boolean(metadata?.groundingSupports?.length || metadata?.grounding_supports?.length);
        return { text, sources, grounded };
      }
      return text;
    },
  },
  {
    name: 'cloudflare-workers-ai-text',
    enabled: () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    async chat(prompt, options = {}) {
      const accountId = encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID);
      const token = process.env.CLOUDFLARE_API_TOKEN;
      const model = '@cf/meta/llama-3.1-8b-instruct-fast';
      const data = await requestJson(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
        {
          timeout: 60000,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          data: { prompt: `${options?.systemPrompt || ''}\n\n${options?.context ? `سياق المحادثة:\n${options.context}\n\n` : ''}طلب المستخدم:\n${prompt}` },
        }
      );
      const text = data?.result?.response || data?.result?.text || data?.response;
      if (!text || typeof text !== 'string') throw new Error(data?.errors?.[0]?.message || 'لم يُرجع الذكاء الاصطناعي ردًا صالحًا');
      return text.trim();
    },
  },
  {
    name: 'pollinations-text',
    enabled: () => true,
    async chat(prompt, options = {}) {
      const providerPrompt = composeFallbackPrompt(prompt, options);
      const response = await requestBuffer(`https://text.pollinations.ai/${encodeURIComponent(providerPrompt)}?model=openai`, { timeout: 45000 });
      const text = Buffer.from(response).toString('utf8').trim();
      if (!text || isChallengePage(text)) throw new Error('Pollinations returned no usable text');
      return text;
    },
  },
  {
    name: 'vapis-gemini',
    enabled: () => true,
    async chat(prompt, options = {}) {
      const providerPrompt = composeFallbackPrompt(prompt, options);
      const data = await requestJson(`https://vapis.my.id/api/gemini?q=${encodeURIComponent(providerPrompt)}`);
      return extractText(data);
    },
  },
  {
    name: 'siputzx-gemini',
    enabled: () => true,
    async chat(prompt, options = {}) {
      const providerPrompt = composeFallbackPrompt(prompt, options);
      const data = await requestJson(`https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(providerPrompt)}`);
      return extractText(data);
    },
  },
  {
    name: 'siputzx-gemini-lite',
    enabled: () => true,
    async chat(prompt, options = {}) {
      const providerPrompt = composeFallbackPrompt(prompt, options);
      const data = await requestJson(`https://api.siputzx.my.id/api/ai/gemini-lite?prompt=${encodeURIComponent(providerPrompt)}`);
      return extractText(data);
    },
  },
  {
    name: 'siputzx-felo',
    enabled: () => true,
    async chat(prompt, options = {}) {
      const providerPrompt = composeFallbackPrompt(prompt, options);
      const data = await requestJson(`https://api.siputzx.my.id/api/ai/felo?query=${encodeURIComponent(providerPrompt)}`);
      return extractText(data);
    },
  },
  {
    name: 'gifted-gemini',
    enabled: () => Boolean(process.env.GIFTED_API_KEY),
    async chat(prompt, options = {}) {
      const providerPrompt = composeFallbackPrompt(prompt, options);
      const data = await requestJson(`https://api.giftedtech.my.id/api/ai/geminiai?apikey=${encodeURIComponent(process.env.GIFTED_API_KEY)}&q=${encodeURIComponent(providerPrompt)}`);
      return extractText(data);
    },
  },
];


function toGeminiParts(content) {
  return content.flatMap(part => {
    if (!part) return [];
    if (part.type === 'text') return [{ text: String(part.text || '') }];
    if (part.type === 'image_url') {
      const url = part.image_url?.url || part.url || '';
      const match = String(url).match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return [];
      return [{ inlineData: { mimeType: match[1], data: match[2] } }];
    }
    return [];
  });
}


function composeFallbackPrompt(prompt, options = {}) {
  const system = String(options.systemPrompt || '').trim();
  const context = String(options.context || '').trim();
  const avoid = String(options.avoidResponse || '').trim();
  return [
    system ? `تعليمات النظام:\n${system}` : '',
    context ? `سياق المحادثة:\n${context}` : '',
    avoid ? `لا تكرر هذه الإجابة السابقة:\n${avoid}` : '',
    `طلب المستخدم:\n${String(prompt || '').trim()}`,
  ].filter(Boolean).join('\n\n');
}

function isChallengePage(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim().toLowerCase();
  return s.startsWith('<!doctype html') || s.startsWith('<html') || s.includes('<head>') ||
    s.includes('fingerprint/iife.min.js') || s.includes('window.location.replace') ||
    s.includes('click here to enter') || s.includes('tr_uuid=');
}

function extractText(data) {
  if (typeof data === 'string') {
    const text = data.trim();
    if (!text || isChallengePage(text)) return null;
    return text;
  }
  const candidates = [
    data?.result, data?.answer, data?.message, data?.response, data?.text,
    data?.data?.result, data?.data?.answer, data?.data?.message,
    data?.data?.response, data?.data?.text, data?.data,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() && !isChallengePage(value)) return value.trim();
  }
  return null;
}

async function chat(prompt, options = {}) {
  const persona = options.systemPrompt || `أنت «ليو»، مساعد ذكاء اصطناعي دقيق وودود داخل ${settings.botName || 'Leo Bot'}.

قواعد صارمة:
- لا تخترع حقائق أو أرقامًا أو مصادر أو روابط.
- إذا لم تكن متأكدًا، صرّح بعدم اليقين بدل التخمين.
- صحح الافتراضات الخاطئة بلطف.
- أجب مرة واحدة فقط، بلا تكرار أو حشو.
- لا تبدأ بـ«جواب:» أو «الإجابة:» أو علامة استفهام منفردة.
- لا تدّعِ تصفح الإنترنت أو استخدام أداة لم تستخدمها فعليًا.
- استخدم العربية افتراضيًا إلا إذا طلب المستخدم لغة أخرى.`;
  const userPrompt = String(prompt || '').trim();
  const failures = [];
  const excluded = new Set(Array.isArray(options.excludeProviders) ? options.excludeProviders : []);
  const candidates = providers.filter(p => p.enabled() && !excluded.has(p.name));
  const needsVision = Array.isArray(options?.content) && options.content.some(part => part?.type === 'image_url');
  const visionCandidates = needsVision ? candidates.filter(p => Array.isArray(p.capabilities) && p.capabilities.includes('vision')) : candidates;
  if (needsVision && !visionCandidates.length) {
    const error = new Error('لم تتوفر خدمة رؤية متوافقة مع الصورة المرفقة.');
    error.code = 'AI_VISION_UNAVAILABLE';
    throw error;
  }
  const ordered = options?.grounding
    ? visionCandidates.filter(p => p.name === 'google-gemini')
    : visionCandidates;
  if (options?.grounding && !ordered.length) {
    const error = new Error('وضع التحقق الخارجي يتطلب مزود Gemini متاحًا.');
    error.code = 'AI_GROUNDING_UNAVAILABLE';
    throw error;
  }
  for (const provider of ordered) {
    try {
      const text = await health.run(provider.name, async () => {
        const value = await provider.chat(userPrompt, { ...options, systemPrompt: persona });
        const textValue = typeof value === 'string' ? value : value?.text;
        if (!textValue || isChallengePage(textValue)) throw new Error('Provider returned an invalid/HTML challenge response');
        return value;
      });
      if (typeof text === 'object' && text) return { text: text.text, provider: provider.name, grounded: Boolean(text.grounded), sources: text.sources || [] };
      return { text, provider: provider.name, grounded: false, sources: [] };
    } catch (error) {
      failures.push(`${provider.name}: ${error.message}`);
    }
  }
  const error = new Error('All AI providers failed');
  error.failures = failures;
  throw error;
}

function assertImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) throw new Error('Image provider returned an empty response');
  return sharp(buffer).metadata().then(meta => {
    if (!meta?.width || !meta?.height) throw new Error('Image provider returned invalid image data');
    return buffer;
  });
}

async function transcribeAudio(buffer, filename = 'audio.ogg', mimeType = 'audio/ogg') {
  if (omni.enabled() && true) {
    try {
      return await health.run('omniroute-audio', () => omni.transcribeAudio(buffer, filename, mimeType));
    } catch (error) {
      console.warn('[AUDIO] OmniRoute transcription failed:', error?.message || error);
    }
  }
  throw new Error('لم تتوفر خدمة تحويل الصوت إلى نص حاليًا.');
}

function normalizeTranslationResult(value) {
  if (typeof value === 'string') return value.trim();
  return extractText(value);
}

async function translateText(text, target, options = {}) {
  const source = String(options.source || 'auto').trim() || 'auto';
  const destination = String(target || '').trim();
  const input = String(text || '').trim();
  if (!input) throw new Error('النص المطلوب ترجمته فارغ');
  if (!destination) throw new Error('لغة الترجمة غير محددة');

  if (omni.enabled() && true) {
    try {
      const prompt = `Translate the following text faithfully from ${source === 'auto' ? 'the detected source language' : source} to ${destination}. Preserve meaning, names, numbers, URLs, formatting, emojis, and line breaks. Return ONLY the translation, with no explanation.\n\nTEXT:\n${input}`;
      const result = await health.run('omniroute-translation', () => omni.chat(prompt, {
        systemPrompt: 'You are a professional translator. Never add commentary. Preserve the original structure and do not invent or omit content.',
      }));
      const translated = normalizeTranslationResult(result);
      if (translated) return translated;
    } catch (error) {
      console.warn('[TRANSLATION] OmniRoute failed, using deterministic fallback:', error?.message || error);
    }
  }

  const google = await requestJson('https://translate.googleapis.com/translate_a/single', {
    timeout: 20000,
    params: { client: 'gtx', sl: source === 'auto' ? 'auto' : source, tl: destination, dt: 't', q: input },
  }).catch(() => null);
  const googleText = google?.[0]?.map(x => x?.[0] || '').join('').trim();
  if (googleText) return googleText;

  const memory = await requestJson('https://api.mymemory.translated.net/get', {
    timeout: 20000,
    params: { q: input, langpair: `${source === 'auto' ? 'autodetect' : source}|${destination}` },
  }).catch(() => null);
  const memoryText = memory?.responseData?.translatedText?.trim();
  if (memoryText && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(memoryText)) return memoryText;
  throw new Error('فشلت خدمات الترجمة المتاحة.');
}

async function synthesizeSpeech(text, options = {}) {
  const input = String(text || '').trim();
  if (!input) throw new Error('النص الصوتي فارغ');
  const configuredTtsModel = String(options.model || process.env.OMNIROUTE_TTS_MODEL || '').trim();
  const hasScopedTtsModel = configuredTtsModel && configuredTtsModel.includes('/') && !/^auto(?:\/|$)/i.test(configuredTtsModel);
  if (omni.enabled() && hasScopedTtsModel && true) {
    try {
      const audio = await health.run('omniroute-tts', () => omni.synthesizeSpeech(input, options));
      if (Buffer.isBuffer(audio) && audio.length >= 1000) return audio;
    } catch (error) {
      console.warn('[TTS] OmniRoute failed, using existing TTS fallback:', error?.message || error);
    }
  }

  const fs = require('fs');
  const path = require('path');
  const gTTS = require('gtts');
  const lang = String(options.lang || 'ar').trim();
  const filePath = path.join(process.cwd(), 'assets', `tts-ai-${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  try {
    {
      const tts = new gTTS(input, lang === 'zh-CN' ? 'zh-CN' : lang === 'zh-TW' ? 'zh-TW' : lang);
      await new Promise((resolve, reject) => tts.save(filePath, err => err ? reject(err) : resolve()));
      const audio = await fs.promises.readFile(filePath);
      if (audio.length >= 1000) return audio;
    }
  } finally {
    try { await fs.promises.unlink(filePath); } catch (_) {}
  }
  throw new Error('لم تتوفر خدمة تحويل النص إلى صوت حاليًا.');
}

async function translateAudio(buffer, filename = 'audio.ogg', mimeType = 'audio/ogg') {
  if (omni.enabled() && true) {
    try {
      return await health.run('omniroute-audio-translation', () => omni.translateAudio(buffer, filename, mimeType));
    } catch (error) {
      console.warn('[AUDIO] OmniRoute audio translation failed:', error?.message || error);
    }
  }
  // Universal fallback: transcribe first, then translate the transcript.
  const transcript = await transcribeAudio(buffer, filename, mimeType);
  return translateText(transcript, 'en', { source: 'auto' });
}

async function generateImage(prompt) {
  if (omni.enabled() && true) {
    try { const image = await health.run('omniroute-image', () => omni.generateImage(prompt)); await assertImageBuffer(image); return image; }
    catch (error) { console.warn('[IMAGE] OmniRoute failed, trying existing provider:', error?.message || error); }
  }
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error('Cloudflare Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.');
  }

  const dailyLimit = 100;
  const usageFile = require('path').join(process.cwd(), 'data', 'cloudflare-ai-usage.json');
  const fs = require('fs');
  fs.mkdirSync(require('path').dirname(usageFile), { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  let usage = { day, images: 0 };
  try { usage = JSON.parse(fs.readFileSync(usageFile, 'utf8')); } catch (_) {}
  if (usage.day !== day) usage = { day, images: 0 };
  if (usage.images >= dailyLimit) {
    const error = new Error('Leo daily free image limit reached. Try again tomorrow.');
    error.code = 'AI_DAILY_LIMIT';
    throw error;
  }

  const model = '@cf/black-forest-labs/flux-1-schnell';
  const steps = 4;
  const englishPrompt = await translatePromptToEnglish(prompt);
  const cleanPrompt = `Generate exactly what the user requests. Do not add people, girls, boys, faces, characters, animals, objects, text, themes, or subjects that are not requested unless explicitly requested. Preserve the requested subject, count, setting, style, composition and relationships. User request: ${englishPrompt}`;

  const response = await health.run('cloudflare-workers-ai-image', () => requestJson(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
    {
      timeout: 180000,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      data: { prompt: cleanPrompt, steps },
    }
  ));

  const encoded = response?.result?.image || response?.image;
  if (!encoded) throw new Error(response?.errors?.[0]?.message || 'Cloudflare returned no image');
  const image = Buffer.from(encoded, 'base64');
  await assertImageBuffer(image);
  usage.images += 1;
  fs.writeFileSync(usageFile, JSON.stringify(usage, null, 2));
  return image;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function generateHuggingFaceVideo(prompt) {
  const configuredSpaces = 'OpenKing/wan2-video-generation,Kpkp21/wan2-video-generation'
    .split(',').map(s => s.trim()).filter(Boolean);
  const apiName = '/generate_video';
  const token = process.env.HF_TOKEN || undefined;
  const width = 1280;
  const height = 704;
  const frames = 73;
  const steps = 30;
  const guidance = 5;
  const seed = -1;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const translatedPrompt = await translatePromptToEnglish(prompt);
  const failures = [];

  for (const space of configuredSpaces) {
    try {
      const normalizedSpace = space.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const base = normalizedSpace.includes('.hf.space')
        ? `https://${normalizedSpace}`
        : `https://${normalizedSpace.replace(/\//g, '-').toLowerCase()}.hf.space`;
      const endpoint = apiName.replace(/^\//, '');

      const queued = await requestJson(`${base}/gradio_api/call/${encodeURIComponent(endpoint)}`, {
        timeout: 30000,
        method: 'POST',
        headers,
        data: { data: [translatedPrompt, null, width, height, frames, steps, guidance, seed] },
      });
      const eventId = queued?.event_id;
      if (!eventId) throw new Error('لم تبدأ عملية التوليد.');

      const maxWait = 300000;
      const started = Date.now();
      const url = `${base}/gradio_api/call/${encodeURIComponent(endpoint)}/${encodeURIComponent(eventId)}`;
      const axios = require('axios');
      let lastError = '';

      while (Date.now() - started < maxWait) {
        const response = await axios.get(url, {
          timeout: 30000,
          responseType: 'text',
          headers,
          validateStatus: s => s >= 200 && s < 500,
        });
        if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
        const lines = String(response.data || '').split(/\n/);
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let data; try { data = JSON.parse(payload); } catch { continue; }
          if (Array.isArray(data)) {
            for (const candidate of data) {
              const videoUrl = typeof candidate === 'string'
                ? candidate
                : candidate?.url || candidate?.path || candidate?.video?.url || candidate?.video?.path;
              if (videoUrl && /^https?:\/\//i.test(videoUrl)) {
                const video = await requestBuffer(videoUrl, { timeout: 90000, headers });
                if (video.includes(Buffer.from('ftyp'))) return video;
                throw new Error('الملف الناتج ليس فيديو صالحًا.');
              }
              if (typeof candidate === 'string' && candidate.trim()) lastError = candidate;
            }
            if (typeof data?.[1] === 'string' && data[1]) lastError = data[1];
          } else if (typeof data === 'object' && data) {
            const message = data?.error || data?.message || data?.detail;
            if (message) lastError = String(message);
          }
        }
        await sleep(4000);
      }
      throw new Error(lastError || 'انتهت مهلة الانتظار.');
    } catch (error) {
      failures.push(`${space}: ${error?.message || 'تعذر الاتصال'}`);
    }
  }

  const error = new Error('لم تتوفر خدمة توليد فيديو حاليًا.');
  error.failures = failures;
  throw error;
}

async function generateVideo(prompt) {
  if (omni.enabled() && true) {
    try { const video = await health.run('omniroute-video', () => omni.generateVideo(prompt)); if (!Buffer.isBuffer(video) || video.length < 1000 || !video.includes(Buffer.from('ftyp'))) throw new Error('OmniRoute returned an invalid video'); return video; }
    catch (error) { console.warn('[VIDEO] OmniRoute failed, trying existing provider:', error?.message || error); }
  }
  return health.run('huggingface-zerogpu-video', () => generateHuggingFaceVideo(prompt));
}

function listProviders() {
  return providers.map(p => ({ name: p.name, enabled: p.enabled(), capabilities: p.capabilities || ['text'] }));
}

module.exports = { chat, generateImage, generateVideo, extractText, transcribeAudio, translateAudio, translateText, synthesizeSpeech, health, listProviders };
