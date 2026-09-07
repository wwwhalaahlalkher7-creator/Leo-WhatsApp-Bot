const axios = require('axios');
const { assertPublicHttpUrl } = require('../lib/url-security');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const fileType = require('file-type');
const { youtubeAudio, youtubeVideo, tiktok, instagram, facebook, allDl, fetchMedia } = require('../systems/provider/media');
const { t } = require('../lib/i18n');
const { optimizeAudio, optimizeVideo, cleanup } = require('../lib/media-optimizer');

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
    return await sendDirect(sock, chatId, message, mediaUrl, 'audio');
  } catch (directError) {
    console.warn('[MEDIA-DL] Direct audio send failed, falling back to optimization:', directError.message);
    const optimized = await optimizeAudio(mediaUrl, { bitrate: '96k', mono: false });
    try { return await sock.sendMessage(chatId, { audio: { url: optimized }, mimetype: 'audio/mpeg', fileName: 'audio.mp3', ptt: false }, { quoted: message }); }
    finally { cleanup(optimized); }
  }
}

async function sendVideoWithFallback(sock, chatId, message, mediaUrl, caption = '', fileName = 'video.mp4') {
  try {
    await assertPublicHttpUrl(mediaUrl);
    return await withTimeout(sock.sendMessage(chatId, { video: { url: mediaUrl }, mimetype: 'video/mp4', fileName, caption }, { quoted: message }), 45_000, 'Direct video send timed out');
  } catch (directError) {
    console.warn('[MEDIA-DL] Direct video send failed, falling back to optimization:', directError.message);
    const optimized = await optimizeVideo(mediaUrl, { maxWidth: 640, crf: 32, audioBitrate: '64k' });
    try { return await sock.sendMessage(chatId, { video: { url: optimized }, mimetype: 'video/mp4', fileName, caption }, { quoted: message }); }
    finally { cleanup(optimized); }
  }
}

async function sendImageWithFallback(sock, chatId, message, mediaUrl, caption = '') {
  try {
    return await sendDirect(sock, chatId, message, mediaUrl, 'image', caption);
  } catch (directError) {
    console.warn('[MEDIA-DL] Direct image send failed, falling back to buffer download:', directError.message);
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
      return sock.sendMessage(chatId, { image: fs.createReadStream(tmpPath), caption: t('download.generic.caption', '', { url: href }) }, { quoted: message });
    }
    if (mime.startsWith('audio/')) {
      const optimized = await optimizeAudio(tmpPath, { bitrate: '96k', mono: false });
      try { return await sock.sendMessage(chatId, { audio: { url: optimized }, mimetype: 'audio/mpeg', fileName: 'audio.mp3', ptt: false }, { quoted: message }); }
      finally { cleanup(optimized); }
    }
    const isVideo = mime.startsWith('video/') || ['mp4','webm','mov','m4v','mkv','avi'].includes(detected?.ext);
    if (isVideo) {
      const optimized = await optimizeVideo(tmpPath, { maxWidth: 640, crf: 32, audioBitrate: '64k' });
      try { return await sock.sendMessage(chatId, { video: { url: optimized }, mimetype: 'video/mp4', fileName: 'video.mp4', caption: t('download.generic.caption', '', { url: href }) }, { quoted: message }); }
      finally { cleanup(optimized); }
    }
    throw new Error('نوع الملف غير مدعوم أو لم يمكن التحقق منه.');
  } finally { await fs.remove(tmpDir).catch(() => {}); }
}
async function mediaDownloadCommand(sock, chatId, message, args) {
  const raw = args?.join(' ').trim() || textOf(message).trim().split(/\s+/).slice(1).join(' ').trim();
  const url = validUrl(raw);
  if (!url) return sock.sendMessage(chatId, { text: t('download.generic.usage') }, { quoted: message });
  const href = url.href;
  const host = url.hostname.toLowerCase();
  try {
    await sock.sendMessage(chatId, { text: t('download.generic.processing') }, { quoted: message });
    let result;
    if (/youtube\.com$|youtu\.be$/.test(host)) {
      result = await youtubeVideo(href);
    } else if (/tiktok\.com$/.test(host)) {
      result = await tiktok(href);
    } else if (/instagram\.com$|instagr\.am$/.test(host)) {
      result = await instagram(href);
    } else if (/facebook\.com$|fb\.watch$/.test(host)) {
      result = await facebook(href);
    } else if (/(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)reddit\.com$|(^|\.)redd\.it$|(^|\.)pinterest\.com$|(^|\.)pin\.it$|(^|\.)threads\.net$|(^|\.)snapchat\.com$|(^|\.)capcut\.com$|(^|\.)douyin\.com$/i.test(host)) {
      result = await allDl(href);
    } else if (/\.(mp4|webm|mov|m4v|mp3|m4a|aac|ogg|jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(href)) {
      const ext = (href.match(/\.(mp4|webm|mov|m4v|mp3|m4a|aac|ogg|jpg|jpeg|png|webp)(?:\?.*)?$/i)?.[1] || 'bin').toLowerCase();
      const type = ['jpg','jpeg','png','webp'].includes(ext) ? 'image' : ['mp3','m4a','aac','ogg'].includes(ext) ? 'audio' : 'video';
      if (type === 'image') {
        const buffer = await fetchMedia(href, { timeout: 60000 });
        return sock.sendMessage(chatId, { image: buffer, caption: t('download.generic.caption', '', { url: href }) }, { quoted: message });
      }
      if (type === 'audio') {
        const optimized = await optimizeAudio(href, { bitrate: '96k', mono: false });
        try {
          return await sock.sendMessage(chatId, { audio: { url: optimized }, mimetype: 'audio/mpeg', fileName: 'audio.mp3', ptt: false }, { quoted: message });
        } finally { cleanup(optimized); }
      }
      const optimized = await optimizeVideo(href, { maxWidth: 640, crf: 32, audioBitrate: '64k' });
      try {
        return await sock.sendMessage(chatId, { video: { url: optimized }, mimetype: 'video/mp4', fileName: 'video.mp4', caption: t('download.generic.caption', '', { url: href }) }, { quoted: message });
      } finally { cleanup(optimized); }
    } else {
      // Direct media URLs are validated by content type/file signature instead of trusting the extension.
      return await sendDirectMedia(sock, chatId, message, href);
    }
    await sendResult(sock, chatId, message, result, href);
  } catch (error) {
    console.error('[MEDIA-DL]', error);
    await sock.sendMessage(chatId, { text: t('download.generic.failed') }, { quoted: message });
  }
}
module.exports = mediaDownloadCommand;
