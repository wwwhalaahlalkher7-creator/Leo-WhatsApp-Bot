const axios = require('axios');
const { assertPublicHttpUrl } = require('../lib/url-security');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const fileType = require('file-type');
const { youtubeAudio, youtubeVideo, tiktok, instagram, facebook, allDl, socialUniversal, xTwitter, fetchMedia, mediaDownloadOptions } = require('../systems/provider/media');
const { SessionManager } = require('../systems/session');
const { replyNumber } = require('../systems/interaction');
const { t } = require('../lib/i18n');
const { optimizeAudio, optimizeVideo, optimizeImage, cleanup } = require('../lib/media-optimizer');

const mediaSessions = new SessionManager({ defaultTtl: 10 * 60 * 1000 });

function textOf(message) {
  return message.message?.conversation || message.message?.extendedTextMessage?.text || '';
}
function validUrl(value) { try { return new URL(value); } catch { return null; } }

function withTimeout(promise, ms, label = 'Media send timed out') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function sendDirect(sock, chatId, message, mediaUrl, type, caption = '') {
  await assertPublicHttpUrl(mediaUrl);
  const options = type === 'audio'
    ? { audio: { url: mediaUrl }, mimetype: 'audio/mpeg', fileName: 'audio.mp3', ptt: false }
    : type === 'image'
      ? { image: { url: mediaUrl }, caption }
      : { video: { url: mediaUrl }, mimetype: 'video/mp4', fileName: 'video.mp4', caption };
  return withTimeout(sock.sendMessage(chatId, options, { quoted: message }), 45_000, 'Direct media send timed out');
}

async function sendAudioWithFallback(sock, chatId, message, mediaUrl) {
  try {
    // Always normalize downloaded audio before sending. Provider links may be
    // AAC/Opus/M4A/etc.; WhatsApp gets a predictable MP3 instead.
    const optimized = await optimizeAudio(mediaUrl, { bitrate: '96k', mono: false });
    try {
      return await sock.sendMessage(chatId, { audio: { url: optimized }, mimetype: 'audio/mpeg', fileName: 'audio.mp3', ptt: false }, { quoted: message });
    } finally { cleanup(optimized); }
  } catch (normalizeError) {
    console.warn('[MEDIA-DL] Audio normalization failed, trying direct send:', normalizeError.message);
    return sendDirect(sock, chatId, message, mediaUrl, 'audio');
  }
}

async function sendVideoWithFallback(sock, chatId, message, mediaUrl, caption = '', fileName = 'video.mp4') {
  try {
    // Normalize every provider result to H.264/AAC MP4 and cap resolution/bitrate
    // so WhatsApp receives a broadly compatible file of reasonable size.
    const optimized = await optimizeVideo(mediaUrl, { maxWidth: 720, crf: 30, audioBitrate: '80k' });
    try {
      return await sock.sendMessage(chatId, { video: { url: optimized }, mimetype: 'video/mp4', fileName, caption }, { quoted: message });
    } finally { cleanup(optimized); }
  } catch (normalizeError) {
    console.warn('[MEDIA-DL] Video normalization failed, trying direct send:', normalizeError.message);
    return sendDirect(sock, chatId, message, mediaUrl, 'video', caption);
  }
}

async function sendImageWithFallback(sock, chatId, message, mediaUrl, caption = '') {
  try {
    // Convert WebP/AVIF/HEIC/GIF/static provider output to a normal JPEG and
    // resize large images before WhatsApp receives them.
    const optimized = await optimizeImage(mediaUrl, { maxWidth: 1920, quality: 82 });
    try {
      return await sock.sendMessage(chatId, { image: { url: optimized }, mimetype: 'image/jpeg', fileName: 'image.jpg', caption }, { quoted: message });
    } finally { cleanup(optimized); }
  } catch (normalizeError) {
    console.warn('[MEDIA-DL] Image normalization failed, trying direct send:', normalizeError.message);
    const buffer = await fetchMedia(mediaUrl, { timeout: 60000 });
    return sock.sendMessage(chatId, { image: buffer, caption }, { quoted: message });
  }
}

async function sendResult(sock, chatId, message, result, originalUrl) {
  if (!result) throw new Error('Empty result');
  const caption = t('download.generic.caption', '', { url: originalUrl });

  if (result.media?.length) {
    for (const media of result.media.slice(0, 20)) {
      const mediaUrl = media?.url;
      if (!mediaUrl) continue;
      const kind = String(media.type || media.mime || '').toLowerCase();
      const isAudio = kind.includes('audio') || /\.(mp3|m4a|aac|ogg|wav|opus)(\?|$)/i.test(mediaUrl);
      const isImage = kind.includes('image') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(mediaUrl);
      if (isAudio) await sendAudioWithFallback(sock, chatId, message, mediaUrl);
      else if (isImage) await sendImageWithFallback(sock, chatId, message, mediaUrl, caption);
      else await sendVideoWithFallback(sock, chatId, message, mediaUrl, caption);
    }
    return;
  }

  if (result.audio) return sendAudioWithFallback(sock, chatId, message, result.audio);

  if (result.video || result.download) {
    const source = result.video || result.download;
    const fileName = `${String(result.title || 'video').replace(/[\\/:*?"<>|]/g, '').slice(0, 70) || 'video'}.mp4`;
    return sendVideoWithFallback(sock, chatId, message, source, caption, fileName);
  }

  throw new Error('Unsupported media result');
}

async function sendDirectMedia(sock, chatId, message, href) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'leobot-download-'));
  const tmpPath = path.join(tmpDir, 'source');
  try {
    const response = await axios.get(href, { responseType: 'stream', timeout: 90000, maxRedirects: 5, maxContentLength: 2 * 1024 * 1024 * 1024, maxBodyLength: 2 * 1024 * 1024 * 1024, headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' }, validateStatus: s => s >= 200 && s < 300 });
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmpPath);
      let total = 0;
      response.data.on('data', chunk => { total += chunk.length; if (total > 2 * 1024 * 1024 * 1024) response.data.destroy(new Error('الملف يتجاوز الحد المسموح.')); });
      response.data.on('error', reject); out.on('error', reject); out.on('finish', resolve); response.data.pipe(out);
    });
    const detected = await fileType.fromFile(tmpPath).catch(() => null);
    const mime = String(response.headers['content-type'] || detected?.mime || '').toLowerCase();
    if (mime.startsWith('image/')) {
      const optimized = await optimizeImage(tmpPath, { maxWidth: 1920, quality: 82 });
      try { return await sock.sendMessage(chatId, { image: { url: optimized }, mimetype: 'image/jpeg', fileName: 'image.jpg', caption: t('download.generic.caption', '', { url: href }) }, { quoted: message }); }
      finally { cleanup(optimized); }
    }
    if (mime.startsWith('audio/')) {
      const optimized = await optimizeAudio(tmpPath, { bitrate: '96k', mono: false });
      try { return await sock.sendMessage(chatId, { audio: { url: optimized }, mimetype: 'audio/mpeg', fileName: 'audio.mp3', ptt: false }, { quoted: message }); }
      finally { cleanup(optimized); }
    }
    const isVideo = mime.startsWith('video/') || ['mp4','webm','mov','m4v','mkv','avi'].includes(detected?.ext);
    if (isVideo) {
      const optimized = await optimizeVideo(tmpPath, { maxWidth: 720, crf: 30, audioBitrate: '80k' });
      try { return await sock.sendMessage(chatId, { video: { url: optimized }, mimetype: 'video/mp4', fileName: 'video.mp4', caption: t('download.generic.caption', '', { url: href }) }, { quoted: message }); }
      finally { cleanup(optimized); }
    }
    throw new Error('نوع الملف غير مدعوم أو لم يمكن التحقق منه.');
  } finally { await fs.remove(tmpDir).catch(() => {}); }
}

function formatBytes(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'الحجم غير معروف';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = n;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size >= 100 ? size.toFixed(0) : size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[i]}`;
}

function cleanQualityOptions(options = []) {
  const sorted = options
    .filter(x => x?.url)
    .map((x, index) => ({ ...x, index, height: Number.isFinite(Number(x.height)) ? Number(x.height) : null }))
    .sort((a, b) => {
      if (a.height != null && b.height != null) return a.height - b.height;
      if (a.height != null) return -1;
      if (b.height != null) return 1;
      return a.index - b.index;
    });
  const out = [];
  const seen = new Set();
  for (const item of sorted) {
    const key = item.height || String(item.quality || '').toLowerCase() || item.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 6) break;
  }
  return out;
}

function qualityMenu(title, options) {
  const lines = [
    '🎬 *اختر الجودة:*',
    '',
    title ? `🎞️ ${title}` : null,
    title ? '' : null,
    ...options.map((item, i) => {
      const label = item.height ? `${item.height}p` : (item.quality || 'متاح');
      return `${i + 1}️⃣ ${label} — ${formatBytes(item.size)}`;
    }),
    '',
    '↩️ *أرسل رقم الجودة بالرد على هذه الرسالة.*',
    '⏳ صلاحية الاختيار: 10 دقائق.'
  ].filter(x => x !== null);
  return lines.join('\n');
}

async function inspectDownload(sock, chatId, message, senderId, href, mode = 'تحميل', resolver = mediaDownloadOptions) {
  const info = await resolver(href);
  if (!info) throw new Error('No downloadable media found');
  if (info.type === 'image') {
    for (const item of (info.media || []).slice(0, 20)) await sendImageWithFallback(sock, chatId, message, item.url, t('download.generic.caption', '', { url: href }));
    return true;
  }
  if (info.type === 'audio') {
    await sendAudioWithFallback(sock, chatId, message, info.audio);
    return true;
  }
  const options = cleanQualityOptions(info.options || []);
  if (!options.length) throw new Error('No video quality options');
  const sent = await sock.sendMessage(chatId, { text: qualityMenu(info.title, options) }, { quoted: message });
  if (senderId && sent?.key?.id) {
    mediaSessions.create({
      type: `media-quality:${mode}`,
      chatId,
      ownerId: senderId,
      activeMessageId: sent.key.id,
      data: { href, title: info.title || 'Video', options }
    });
  }
  return true;
}

async function handleMediaQualityReply(sock, chatId, message, senderId, text) {
  if (!senderId) return false;
  const raw = String(text || '').trim();
  if (!/^[0-9٠-٩۰-۹]{1,2}$/.test(raw)) return false;
  const value = Number(raw.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if (!Number.isFinite(value) || value < 1) return false;
  for (const type of ['media-quality:تحميل', 'media-quality:سنابتيوب']) {
    const session = mediaSessions.get(type, chatId, senderId);
    if (!session) continue;
    const check = replyNumber(message, session.activeMessageId, { min: 1, max: session.data.options.length });
    if (!check.ok) return false;
    const selected = session.data.options[check.value - 1];
    mediaSessions.close(session, 'selected');
    try {
      await sock.sendMessage(chatId, { text: `⏳ جاري تحميل *${selected.height ? `${selected.height}p` : (selected.quality || 'الجودة المختارة')}*...` }, { quoted: message });
      await sendVideoWithFallback(sock, chatId, message, selected.url, t('download.generic.caption', '', { url: session.data.href }), `${String(session.data.title || 'video').replace(/[\\/:*?"<>|]/g, '').slice(0, 70) || 'video'}.mp4`);
    } catch (error) {
      console.error('[MEDIA-QUALITY]', error?.message || error);
      await sock.sendMessage(chatId, { text: '❌ تعذر تحميل الجودة المختارة. أعد استخدام الأمر للحصول على روابط جديدة.' }, { quoted: message });
    }
    return true;
  }
  return false;
}

async function mediaDownloadCommand(sock, chatId, message, args, ctx = {}) {
  const raw = args?.join(' ').trim() || textOf(message).trim().split(/\s+/).slice(1).join(' ').trim();
  const url = validUrl(raw);
  if (!url) return sock.sendMessage(chatId, { text: t('download.generic.usage') }, { quoted: message });
  const href = url.href;
  const host = url.hostname.toLowerCase();
  const senderId = ctx?.senderId;
  try {
    await sock.sendMessage(chatId, { text: t('download.generic.processing') }, { quoted: message });

    // Direct media is handled immediately. There is no reason to ask for a
    // quality when the URL itself points at a single image/audio file.
    if (/\.(mp4|webm|mov|m4v|mp3|m4a|aac|ogg|jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(href)) {
      return await sendDirectMedia(sock, chatId, message, href);
    }

    // New behavior: identify the media first. Images/audio are downloaded
    // immediately with smart normalization; videos get an interactive quality menu.
    try {
      const handled = await inspectDownload(sock, chatId, message, senderId, href, 'تحميل');
      if (handled) return;
    } catch (inspectError) {
      console.warn('[MEDIA-DL] quality inspection failed, falling back to legacy provider routing:', inspectError?.message || inspectError);
    }

    let result;
    if (/youtube\.com$|youtu\.be$/.test(host)) {
      result = await youtubeVideo(href);
    } else if (/tiktok\.com$/.test(host)) {
      result = await tiktok(href);
    } else if (/instagram\.com$|instagr\.am$/.test(host)) {
      result = await instagram(href);
    } else if (/facebook\.com$|fb\.watch$/.test(host)) {
      result = await facebook(href);
    } else if (/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(host)) {
      result = await xTwitter(href);
    } else if (/(^|\.)reddit\.com$|(^|\.)redd\.it$|(^|\.)pinterest\.com$|(^|\.)pin\.it$|(^|\.)threads\.net$|(^|\.)threads\.com$|(^|\.)snapchat\.com$|(^|\.)capcut\.com$|(^|\.)douyin\.com$|(^|\.)snackvideo\.com$|(^|\.)kwai\.com$|(^|\.)soundcloud\.com$/i.test(host)) {
      result = await socialUniversal(href);
    } else {
      return await sendDirectMedia(sock, chatId, message, href);
    }
    await sendResult(sock, chatId, message, result, href);
  } catch (error) {
    console.error('[MEDIA-DL]', error);
    await sock.sendMessage(chatId, { text: t('download.generic.failed') }, { quoted: message });
  }
}

module.exports = mediaDownloadCommand;
module.exports.handleMediaQualityReply = handleMediaQualityReply;
module.exports.mediaSessions = mediaSessions;
module.exports.sendResult = sendResult;
module.exports.sendDirectMedia = sendDirectMedia;
module.exports.inspectDownload = inspectDownload;

