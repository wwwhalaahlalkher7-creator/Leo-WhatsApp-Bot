'use strict';

const fs = require('fs-extra');
const { assertPublicHttpUrl } = require('../lib/url-security');
const { probe, download, downloadAudio, downloadBestImage, cleanupJob } = require('../lib/ytdlp');
const { mediaSessions } = require('./media-download');
const { optimizeVideo, optimizeAudio, optimizeImage, cleanup } = require('../lib/media-optimizer');
const { t } = require('../lib/i18n');

function textOf(message) {
  return message.message?.conversation || message.message?.extendedTextMessage?.text || '';
}
function validUrl(value) { try { return new URL(value); } catch { return null; } }
function formatBytes(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'الحجم غير معروف';
  const units = ['B', 'KB', 'MB', 'GB']; let size = n; let i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size >= 100 ? size.toFixed(0) : size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[i]}`;
}

function qualityMenu(info) {
  return [
    '🟢 *SnapTube / yt-dlp*',
    '',
    `🎞️ ${info.title || 'Video'}`,
    info.duration ? `⏱️ ${Math.round(info.duration)} ثانية` : null,
    '',
    ...info.options.map((item, i) => `${i + 1}️⃣ ${item.height}p — ${item.size ? `~${formatBytes(item.size)}` : 'الحجم سيُحدد بعد التنزيل'}`),
    '',
    '📌 هذه الجودات مستخرجة من الصيغ المتاحة فعليًا للرابط.',
    '↩️ *رد برقم الجودة على هذه الرسالة.*',
    '⏳ صلاحية الاختيار: 10 دقائق.'
  ].filter(Boolean).join('\n');
}

async function sendVideo(sock, chatId, message, job, selected) {
  const crfByHeight = selected.height >= 1080 ? 23 : selected.height >= 720 ? 24 : selected.height >= 480 ? 25 : 26;
  const optimized = await optimizeVideo(job.path, {
    maxWidth: selected.height,
    crf: crfByHeight,
    audioBitrate: selected.height >= 720 ? '96k' : '80k',
    preset: 'medium'
  });
  try {
    await sock.sendMessage(chatId, {
      video: { url: optimized },
      mimetype: 'video/mp4',
      fileName: `${job.title || 'video'}.mp4`,
      caption: t('download.generic.caption', '', { url: job.url })
    }, { quoted: message });
  } finally { cleanup(optimized); }
}

async function handleYtdlpQualityReply(sock, chatId, message, senderId, text) {
  const raw = String(text || '').trim();
  if (!senderId || !/^[0-9٠-٩۰-۹]{1,2}$/.test(raw)) return false;
  const value = Number(raw.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if (!Number.isInteger(value) || value < 1) return false;
  const session = mediaSessions.get('media-quality:سنابتيوب', chatId, senderId);
  if (!session) return false;
  const keyId = session.activeMessageId;
  if (message.message?.extendedTextMessage?.contextInfo?.stanzaId !== keyId) return false;
  const selected = session.data.options[value - 1];
  if (!selected) return false;
  mediaSessions.close(session, 'selected');
  let job;
  try {
    await sock.sendMessage(chatId, { text: `⏳ جاري تنزيل *${selected.height}p* بواسطة yt-dlp...` }, { quoted: message });
    job = await download(session.data.href, selected.selector, { title: session.data.title, extractorApi: session.data.extractorApi });
    job.url = session.data.href;
    await sendVideo(sock, chatId, message, job, selected);
  } catch (error) {
    console.error('[SNAPTUBE yt-dlp quality]', error?.message || error);
    await sock.sendMessage(chatId, { text: '❌ تعذر تنزيل الجودة المختارة بواسطة yt-dlp. جرّب جودة أخرى أو أعد إرسال الرابط.' }, { quoted: message });
  } finally {
    await cleanupJob(job);
  }
  return true;
}

async function snaptubeCommand(sock, chatId, message, args = [], ctx = {}) {
  const raw = args?.join(' ').trim() || textOf(message).trim().split(/\s+/).slice(1).join(' ').trim();
  const url = validUrl(raw);
  if (!url) return sock.sendMessage(chatId, { text: '📌 الاستخدام: `.سنابتيوب <الرابط>`' }, { quoted: message });
  const href = url.href;

  try {
    await assertPublicHttpUrl(href);
    await sock.sendMessage(chatId, { text: '🟢 *SnapTube / yt-dlp*\n⏳ جاري تحليل الرابط...' }, { quoted: message });
    const info = await probe(href);
    const senderId = ctx?.senderId;

    if (info.type === 'video') {
      if (!info.options.length) throw new Error('No real video qualities found');
      const sent = await sock.sendMessage(chatId, { text: qualityMenu(info) }, { quoted: message });
      if (senderId && sent?.key?.id) {
        mediaSessions.create({
          type: 'media-quality:سنابتيوب',
          chatId,
          ownerId: senderId,
          activeMessageId: sent.key.id,
          data: { href, title: info.title || 'video', options: info.options, extractorApi: info.extractorApi }
        });
      }
      return;
    }

    if (info.type === 'audio') {
      const job = await downloadAudio(href, info.title, { extractorApi: info.extractorApi });
      try {
        const optimized = await optimizeAudio(job.path, { bitrate: '128k', mono: false });
        try {
          await sock.sendMessage(chatId, { audio: { url: optimized }, mimetype: 'audio/mpeg', fileName: `${info.title || 'audio'}.mp3`, ptt: false }, { quoted: message });
        } finally { cleanup(optimized); }
      } finally { await cleanupJob(job); }
      return;
    }

    if (info.type === 'image') {
      const job = await downloadBestImage(href, info.title, { extractorApi: info.extractorApi });
      try {
        const optimized = await optimizeImage(job.path, { maxWidth: 1920, quality: 84 });
        try {
          await sock.sendMessage(chatId, { image: { url: optimized }, mimetype: 'image/jpeg', fileName: 'image.jpg', caption: t('download.generic.caption', '', { url: href }) }, { quoted: message });
        } finally { cleanup(optimized); }
      } finally { await cleanupJob(job); }
      return;
    }

    throw new Error('yt-dlp لم يتعرف على وسائط قابلة للتنزيل.');
  } catch (error) {
    console.error('[SNAPTUBE yt-dlp]', error?.message || error);
    await sock.sendMessage(chatId, { text: `❌ تعذر على yt-dlp تنزيل الرابط حاليًا.\n
السبب: ${String(error?.message || 'خطأ غير معروف').slice(-700)}` }, { quoted: message });
  }
}

module.exports = snaptubeCommand;
module.exports.handleYtdlpQualityReply = handleYtdlpQualityReply;
