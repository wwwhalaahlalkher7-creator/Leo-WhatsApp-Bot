'use strict';

const { allDlOptions } = require('../systems/provider/media');
const { assertPublicHttpUrl } = require('../lib/url-security');
const { inspectDownload, sendResult, sendDirectMedia } = require('./media-download');
const { t } = require('../lib/i18n');

function textOf(message) {
  return message.message?.conversation || message.message?.extendedTextMessage?.text || '';
}
function validUrl(value) { try { return new URL(value); } catch { return null; } }

function snapResolver(href) {
  return allDlOptions(href).then(info => {
    const videos = Array.isArray(info.videos) ? info.videos : [];
    if (videos.length) return { type: 'video', title: info.title, thumbnail: info.thumbnail, options: videos };
    if (info.audio?.url) return { type: 'audio', title: info.title, audio: info.audio.url };
    throw new Error('SnapTube engine returned no media');
  });
}

async function snaptubeCommand(sock, chatId, message, args = [], ctx = {}) {
  const raw = args?.join(' ').trim() || textOf(message).trim().split(/\s+/).slice(1).join(' ').trim();
  const url = validUrl(raw);
  if (!url) return sock.sendMessage(chatId, { text: '📌 الاستخدام: `.سنابتيوب <الرابط>`' }, { quoted: message });
  const href = url.href;

  try {
    await assertPublicHttpUrl(href);
    await sock.sendMessage(chatId, { text: '🟡 *SnapTube Mode*\n⏳ جاري تحليل الرابط...' }, { quoted: message });

    if (/\.(mp4|webm|mov|m4v|mp3|m4a|aac|ogg|jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(href)) {
      return await sendDirectMedia(sock, chatId, message, href);
    }

    await inspectDownload(sock, chatId, message, ctx?.senderId, href, 'سنابتيوب', snapResolver);
  } catch (error) {
    console.error('[SNAPTUBE]', error?.message || error);
    try {
      // Keep the experiment useful on sites that the single universal engine
      // does not expose. This is a fallback, not the primary SnapTube path.
      const { socialUniversal, xTwitter } = require('../systems/provider/media');
      const host = url.hostname.toLowerCase();
      const result = /(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(host)
        ? await xTwitter(href)
        : await socialUniversal(href);
      return await sendResult(sock, chatId, message, result, href);
    } catch (fallbackError) {
      console.error('[SNAPTUBE fallback]', fallbackError?.message || fallbackError);
      return sock.sendMessage(chatId, { text: '❌ تعذر على وضع SnapTube تحليل هذا الرابط حاليًا.' }, { quoted: message });
    }
  }
}

module.exports = snaptubeCommand;
