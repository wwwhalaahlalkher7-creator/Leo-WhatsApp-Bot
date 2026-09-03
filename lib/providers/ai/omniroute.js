'use strict';

const axios = require('axios');
const FormData = require('form-data');

function enabled() {
  return Boolean(String(process.env.OMNIROUTE_API_KEY || '').trim());
}

function baseUrl() {
  return String(process.env.OMNIROUTE_BASE_URL || 'http://127.0.0.1:20128/v1').replace(/\/$/, '');
}

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${String(process.env.OMNIROUTE_API_KEY || '').trim()}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request(method, path, data, options = {}) {
  const controller = options.signal ? null : new AbortController();
  const timeout = options.timeout || 60000;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
  if (timer?.unref) timer.unref();
  try {
    const response = await axios({
    method,
    url: `${baseUrl()}${path}`,
    data,
    timeout,
    signal: options.signal || controller.signal,
    headers: headers(options.headers),
    responseType: options.responseType || 'json',
    validateStatus: s => s >= 200 && s < 500,
    maxContentLength: options.maxContentLength,
    maxBodyLength: options.maxBodyLength,
  });
    if (response.status >= 400) {
      const msg = response.data?.error?.message || response.data?.message || `HTTP ${response.status}`;
      const error = new Error(`OmniRoute: ${msg}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    return response;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function textFromResponse(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? choice?.text;
  if (Array.isArray(content)) return content.map(x => x?.text || x?.content || '').join('').trim();
  return typeof content === 'string' ? content.trim() : '';
}

async function chat(prompt, options = {}) {
  if (!enabled()) throw new Error('OMNIROUTE_API_KEY غير مضبوط');
  const needsVision = Array.isArray(options.content) && options.content.some(part => part?.type === 'image_url');
  if (needsVision && false) {
    const error = new Error('OmniRoute vision is disabled by configuration');
    error.code = 'OMNIROUTE_VISION_DISABLED';
    throw error;
  }
  const model = String(process.env.OMNIROUTE_TEXT_MODEL || 'auto').trim();
  const system = options.systemPrompt || 'أجب بدقة ولا تخترع معلومات.';
  const textPrompt = options.context
    ? `سياق مختصر للمحادثة:
${options.context}

طلب المستخدم الحالي:
${prompt}`
    : String(prompt || '');
  let userContent = textPrompt;
  if (Array.isArray(options.content) && options.content.length) {
    const prefix = options.context ? `سياق مختصر للمحادثة:
${options.context}

` : '';
    userContent = options.content.map((part, index) => index === 0 && part?.type === 'text' && prefix
      ? { ...part, text: `${prefix}${part.text || ''}` }
      : part);
  }
  const data = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    temperature: 0.2,
  };
  const response = await request('POST', '/chat/completions', data, { timeout: 90000 });
  const text = textFromResponse(response.data);
  if (!text) throw new Error(response.data?.error?.message || 'OmniRoute returned no text');
  return text;
}

let cachedImageModels = [];
let cachedImageModelsAt = 0;

function modelIdFromEntry(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  return String(entry.id || entry.model || entry.modelId || entry.name || '').trim();
}

function isUsableScopedModel(model) {
  return Boolean(model && model.includes('/') && !/^auto(?:\/|$)/i.test(model));
}

function rankImageModels(models) {
  const preferred = String('')
    .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const unique = [...new Set(models.filter(isUsableScopedModel))];
  if (!preferred.length) return unique;
  return unique.sort((a, b) => {
    const ap = preferred.findIndex(p => a.toLowerCase().startsWith(`${p}/`));
    const bp = preferred.findIndex(p => b.toLowerCase().startsWith(`${p}/`));
    return (ap < 0 ? 999 : ap) - (bp < 0 ? 999 : bp);
  });
}

async function discoverImageModels() {
  const ttl = 300000;
  if (cachedImageModels.length && Date.now() - cachedImageModelsAt < ttl) return cachedImageModels;

  const candidates = [];

  // IMPORTANT: /v1/images/generations is a specialty registry endpoint in
  // OmniRoute and may list models whose provider credentials are not active.
  // /v1/models is the availability-aware catalog, so it must be our primary
  // discovery source.
  try {
    const response = await request('GET', '/models', undefined, { timeout: 30000 });
    const entries = Array.isArray(response.data)
      ? response.data
      : (Array.isArray(response.data?.data) ? response.data.data : []);
    for (const entry of entries) {
      const type = String(entry?.type || entry?.capability || entry?.kind || '').toLowerCase();
      const capabilities = entry?.capabilities || {};
      const model = modelIdFromEntry(entry);
      if (type.includes('image') || entry?.image === true || capabilities.image === true ||
          Array.isArray(capabilities) && capabilities.some(x => String(x).toLowerCase() === 'image')) {
        candidates.push(model);
      }
    }
  } catch (error) {
    console.warn(`[OmniRoute] Availability-aware image model discovery failed: ${error?.message || error}`);
  }

  // Compatibility fallback for older OmniRoute builds that do not expose
  // image-capable entries through /v1/models. This endpoint is intentionally
  // used only when the availability-aware catalog returned nothing.
  if (!candidates.some(isUsableScopedModel)) {
    try {
      const response = await request('GET', '/images/generations', undefined, { timeout: 30000 });
      const data = response.data;
      const entries = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      candidates.push(...entries.map(modelIdFromEntry));
    } catch (_) {}
  }

  // An explicit allow-list is useful with older OmniRoute versions whose
  // specialty catalog cannot distinguish configured providers.
  const allowList = String('')
    .split(',').map(x => x.trim()).filter(Boolean);
  if (allowList.length) {
    const allowed = new Set(allowList.map(x => x.toLowerCase()));
    const filtered = candidates.filter(x => allowed.has(String(x).toLowerCase()));
    candidates.splice(0, candidates.length, ...filtered);
  }

  cachedImageModels = rankImageModels(candidates);
  cachedImageModelsAt = Date.now();
  if (!cachedImageModels.length) {
    throw new Error('OmniRoute لم يجد نموذج صور صالحًا. اضبط OMNIROUTE_IMAGE_MODEL بصيغة provider/model أو أضف نموذج صور إلى OmniRoute.');
  }
  console.log(`[OmniRoute] Auto-selected image model candidates: ${cachedImageModels.join(', ')}`);
  return cachedImageModels;
}

async function generateImage(prompt) {
  if (!enabled()) throw new Error('OMNIROUTE_API_KEY غير مضبوط');
  const configured = 'auto';
  const models = (!configured || /^auto(?:\/|$)/i.test(configured))
    ? await discoverImageModels()
    : [configured];
  const invalid = models.find(model => !isUsableScopedModel(model));
  if (invalid) throw new Error(`OmniRoute image model must use provider/model format, received: ${invalid}`);

  const size = '1024x1024';
  const failures = [];
  for (const model of models) {
    try {
      console.log(`[OmniRoute] Trying image model: ${model}`);
      const body = {
        model,
        prompt: String(prompt || '').trim(),
        n: 1,
        size,
        response_format: 'b64_json',
      };
      const response = await request('POST', '/images/generations', body, { timeout: 180000 });
      const item = response.data?.data?.[0];
      if (item?.b64_json) {
        cachedImageModels = [model, ...cachedImageModels.filter(x => x !== model)];
        cachedImageModelsAt = Date.now();
        return Buffer.from(item.b64_json, 'base64');
      }
      if (item?.url) {
        const image = await axios.get(item.url, { responseType: 'arraybuffer', timeout: 120000 });
        cachedImageModels = [model, ...cachedImageModels.filter(x => x !== model)];
        cachedImageModelsAt = Date.now();
        return Buffer.from(image.data);
      }
      throw new Error(response.data?.error?.message || 'OmniRoute returned no image');
    } catch (error) {
      failures.push(`${model}: ${error?.message || error}`);
      console.warn(`[OmniRoute] Image model failed (${model}): ${error?.message || error}`);
    }
  }
  throw new Error(`OmniRoute image generation failed for all models: ${failures.join(' | ')}`);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function generateVideo(prompt) {
  if (!enabled()) throw new Error('OMNIROUTE_API_KEY غير مضبوط');
  const model = 'auto';
  const body = {
    model,
    prompt: String(prompt || '').trim(),
  };
  const duration = 0;
  const aspectRatio = '';
  const resolution = '';
  if (duration > 0) body.duration = duration;
  if (aspectRatio) body.aspect_ratio = aspectRatio;
  if (resolution) body.resolution = resolution;

  const created = await request('POST', '/videos/generations', body, { timeout: 60000 });
  let job = created.data || {};
  const id = job.id || job.task_id || job.request_id;
  if (job.status === 'completed' && (job.data?.[0]?.url || job.video?.url || job.url)) {
    return downloadVideoResult(job, id);
  }
  if (!id) throw new Error(job.error?.message || 'OmniRoute لم يُرجع معرّف مهمة الفيديو');

  const maxWait = 1200000;
  const pollMs = 7000;
  const started = Date.now();
  while (Date.now() - started < maxWait) {
    await sleep(pollMs);
    const status = await request('GET', `/videos/${encodeURIComponent(id)}`, undefined, { timeout: 60000 });
    job = status.data || {};
    const state = String(job.status || '').toLowerCase();
    if (['failed', 'cancelled', 'canceled', 'expired', 'error'].includes(state)) {
      throw new Error(job.error?.message || job.message || `OmniRoute video job ${state}`);
    }
    if (['completed', 'done', 'success'].includes(state)) return downloadVideoResult(job, id);
  }
  throw new Error('انتهت مهلة انتظار فيديو OmniRoute قبل اكتماله.');
}

async function downloadVideoResult(job, id) {
  const candidate = job?.data?.[0]?.url || job?.data?.[0]?.video?.url || job?.video?.url || job?.url || job?.result?.url;
  if (candidate) {
    const url = /^https?:\/\//i.test(candidate) ? candidate : `${baseUrl().replace(/\/v1$/, '')}${candidate}`;
    const response = await axios.get(url, {
      responseType: 'arraybuffer', timeout: 180000,
      headers: headers(), validateStatus: s => s >= 200 && s < 500,
    });
    if (response.status >= 400) throw new Error(`OmniRoute video content HTTP ${response.status}`);
    return Buffer.from(response.data);
  }
  if (id) {
    const response = await request('GET', `/videos/${encodeURIComponent(id)}/content`, undefined, { responseType: 'arraybuffer', timeout: 180000 });
    return Buffer.from(response.data);
  }
  throw new Error('OmniRoute لم يُرجع رابط فيديو صالحًا');
}

async function translateAudio(buffer, filename = 'audio.ogg', mimeType = 'audio/ogg') {
  if (!enabled()) throw new Error('OMNIROUTE_API_KEY غير مضبوط');
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: mimeType });
  form.append('model', 'auto');
  const response = await axios.post(`${baseUrl()}/audio/translations`, form, {
    timeout: 180000,
    headers: { ...headers(), ...form.getHeaders() },
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
    validateStatus: s => s >= 200 && s < 500,
  });
  if (response.status >= 400) throw new Error(`OmniRoute audio translation HTTP ${response.status}: ${response.data?.error?.message || response.data?.message || ''}`);
  const text = response.data?.text || response.data?.transcript || response.data?.result?.text;
  if (!text) throw new Error('OmniRoute لم يُرجع ترجمة للتسجيل الصوتي');
  return String(text).trim();
}

async function synthesizeSpeech(text, options = {}) {
  if (!enabled()) throw new Error('OMNIROUTE_API_KEY غير مضبوط');
  const model = String(options.model || process.env.OMNIROUTE_TTS_MODEL || '').trim();
  if (!model || /^auto(?:\/|$)/i.test(model) || !model.includes('/')) {
    throw new Error('OmniRoute TTS model must be configured as provider/model; local TTS fallback will be used when unset.');
  }
  const configuredVoice = options.voice || ''; 
  const genderVoice = options.gender === 'male'
    ? 'onyx'
    : 'alloy';
  const voice = String(configuredVoice || genderVoice).trim();
  const input = String(text || '').trim();
  if (!input) throw new Error('النص الصوتي فارغ');
  const body = { model, input, voice };
  const format = String(options.format || 'mp3').trim();
  if (format) body.response_format = format;
  const response = await axios.post(`${baseUrl()}/audio/speech`, body, {
    timeout: 180000,
    headers: { ...headers(), 'Content-Type': 'application/json' },
    responseType: 'arraybuffer',
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
    validateStatus: s => s >= 200 && s < 500,
  });
  if (response.status >= 400) {
    let detail = '';
    try { detail = Buffer.from(response.data).toString('utf8').slice(0, 500); } catch (_) {}
    throw new Error(`OmniRoute TTS HTTP ${response.status}: ${detail}`);
  }
  const audio = Buffer.from(response.data || []);
  if (audio.length < 1000) throw new Error('OmniRoute لم يُرجع ملفًا صوتيًا صالحًا');
  return audio;
}

async function transcribeAudio(buffer, filename = 'audio.ogg', mimeType = 'audio/ogg') {
  if (!enabled()) throw new Error('OMNIROUTE_API_KEY غير مضبوط');
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: mimeType });
  form.append('model', 'auto');
  const response = await axios.post(`${baseUrl()}/audio/transcriptions`, form, {
    timeout: 180000,
    headers: { ...headers(), ...form.getHeaders() },
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
    validateStatus: s => s >= 200 && s < 500,
  });
  if (response.status >= 400) throw new Error(`OmniRoute STT HTTP ${response.status}: ${response.data?.error?.message || response.data?.message || ''}`);
  const text = response.data?.text || response.data?.transcript || response.data?.result?.text;
  if (!text) throw new Error('OmniRoute لم يُرجع نصًا من التسجيل الصوتي');
  return String(text).trim();
}

async function extractText(buffer, filename = 'file.bin', mimeType = 'application/octet-stream') {
  if (!enabled()) throw new Error('OMNIROUTE_API_KEY غير مضبوط');
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: mimeType });
  const response = await axios.post(`${baseUrl()}/files`, form, {
    timeout: 120000,
    headers: { ...headers(), ...form.getHeaders() },
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
    validateStatus: s => s >= 200 && s < 500,
  });
  if (response.status >= 400) throw new Error(`OmniRoute file upload HTTP ${response.status}`);
  return response.data;
}

module.exports = { enabled, baseUrl, chat, generateImage, generateVideo, transcribeAudio, translateAudio, synthesizeSpeech, extractText };
