const mumaker = require('mumaker');
const sharp = require('sharp');
const { t } = require('../lib/i18n');

const STYLES = {
  hacker: 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html',
  dragonball: 'https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html',
  naruto: 'https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html',
  sand: 'https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html',
  sunset: 'https://en.ephoto360.com/create-sunset-light-text-effects-online-807.html',
  chocolate: 'https://en.ephoto360.com/chocolate-text-effect-353.html',
  mechanical: 'https://en.ephoto360.com/create-your-name-in-a-mechanical-style-306.html',
  rain: 'https://en.ephoto360.com/foggy-rainy-text-effect-75.html',
  neon: 'https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html',
  chrome: 'https://en.ephoto360.com/chrome-text-effect-91.html',
  gold: 'https://en.ephoto360.com/modern-gold-5-215.html'
};
const AR = { hacker:'هاكر', dragonball:'دراغون_بول', naruto:'ناروتو', sand:'رمل', sunset:'غروب', chocolate:'شوكولاتة', mechanical:'ميكانيكي', rain:'مطر', neon:'نيون', chrome:'كروم', gold:'ذهبي' };


const LOCAL_FONT_FAMILY = 'Noto Sans Arabic, Noto Kufi Arabic, DejaVu Sans, sans-serif';
const LOCAL_STYLES = {
  hacker: { bg: '#07131f', start: '#00e5ff', end: '#00ff95', stroke: '#001b2b', accent: '#00e5ff' },
  dragonball: { bg: '#1b0b05', start: '#ffcf33', end: '#f4511e', stroke: '#260900', accent: '#ffcf33' },
  naruto: { bg: '#141414', start: '#ff8a00', end: '#e53935', stroke: '#050505', accent: '#ff6f00' },
  sand: { bg: '#e7c28f', start: '#fff1c7', end: '#a86f2d', stroke: '#5c3b1b', accent: '#fff1c7' },
  sunset: { bg: '#2b123f', start: '#ffd54f', end: '#ff4081', stroke: '#3a0b4d', accent: '#ff80ab' },
  chocolate: { bg: '#24120c', start: '#ffd08a', end: '#8d4b2f', stroke: '#120603', accent: '#ffd08a' },
  mechanical: { bg: '#171b20', start: '#f5f7fa', end: '#8b98a5', stroke: '#050607', accent: '#cfd8dc' },
  rain: { bg: '#07131d', start: '#d9f2ff', end: '#5d9fc4', stroke: '#031018', accent: '#9ad8ff' },
  neon: { bg: '#090014', start: '#ff4fd8', end: '#7c4dff', stroke: '#13001e', accent: '#ff4fd8' },
  chrome: { bg: '#11151b', start: '#ffffff', end: '#7d8794', stroke: '#090b0f', accent: '#dfe6ee' },
  gold: { bg: '#1b1305', start: '#fff0a6', end: '#c78b18', stroke: '#2a1800', accent: '#ffd54f' }
};

function escapeXml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function createArabicLogo(text, style) {
  const cfg = LOCAL_STYLES[style] || LOCAL_STYLES.chrome;
  const safeText = escapeXml(text);
  const fontSize = text.length > 18 ? 112 : text.length > 12 ? 132 : 154;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cfg.bg}"/><stop offset="1" stop-color="#050505"/></linearGradient>
      <linearGradient id="text" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cfg.start}"/><stop offset="1" stop-color="${cfg.end}"/></linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="12" flood-color="#000" flood-opacity="0.75"/></filter>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="1200" height="700" rx="44" fill="url(#bg)"/>
    <circle cx="110" cy="110" r="160" fill="${cfg.accent}" opacity="0.09"/>
    <circle cx="1090" cy="590" r="210" fill="${cfg.accent}" opacity="0.08"/>
    <path d="M100 540 C 280 360, 420 650, 610 470 S 920 360, 1110 150" fill="none" stroke="${cfg.accent}" stroke-width="10" opacity="0.28"/>
    <text x="600" y="395" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" font-family="${LOCAL_FONT_FAMILY}" font-size="${fontSize}px" font-weight="900" fill="url(#text)" stroke="${cfg.stroke}" stroke-width="22" stroke-linejoin="round" paint-order="stroke" filter="url(#shadow)">${safeText}</text>
    <text x="600" y="395" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" font-family="${LOCAL_FONT_FAMILY}" font-size="${fontSize}px" font-weight="900" fill="url(#text)" stroke="#ffffff" stroke-opacity="0.25" stroke-width="4" paint-order="stroke" filter="url(#glow)">${safeText}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function logoCommand(sock, chatId, message, args) {
  const rawStyle = String(args?.[0] || '').trim().toLowerCase();
  const styleAliases = Object.fromEntries(Object.entries(AR).flatMap(([key, ar]) => [[key, key], [ar.toLowerCase(), key]]));
  Object.assign(styleAliases, { 'زخرفة': 'chrome', 'زخارف': 'chrome', 'معدني': 'chrome', 'ذهبي': 'gold', 'نيون': 'neon', 'كروم': 'chrome' });
  const style = styleAliases[rawStyle] || rawStyle;
  const text = args?.slice(1).join(' ').trim();
  const arabicText = /[\u0600-\u06FF]/.test(text);
  const normalizedText = arabicText ? text.normalize('NFC').replace(/[\u200e\u200f]/g, '') : text;
  if (!STYLES[style] || !text) {
    const list = Object.keys(STYLES).map(k => `• ${AR[k]}`).join('\n');
    return sock.sendMessage(chatId, { text: `🎨 *إنشاء شعار*\n\nالاستخدام: *.لوجو <النمط> <النص>*\n\nالأنماط المتاحة:\n${list}\n\nمثال: *.لوجو ناروتو ليو*\nمثال للزخارف: *.لوجو زخرفة محمد*` }, { quoted: message });
  }
  try {
    await sock.sendMessage(chatId, { text: t('commands.logo.processing') }, { quoted: message });
    // Ephoto360 templates can return empty/garbled glyphs for Arabic. For Arabic or mixed Arabic text,
    // render locally with SVG/Pango via Sharp so joining, RTL direction and glyphs are preserved.
    if (arabicText) {
      const image = await createArabicLogo(normalizedText, style);
      return sock.sendMessage(chatId, { image, caption: t('commands.logo.caption', '', { style: `${AR[style] || style} — دعم عربي` }) }, { quoted: message });
    }
    const result = await mumaker.ephoto(STYLES[style], normalizedText);
    if (!result?.image) throw new Error('No image returned');
    await sock.sendMessage(chatId, { image: { url: result.image }, caption: t('commands.logo.caption', '', { style: AR[style] || style }) }, { quoted: message });
  } catch (error) {
    console.error('[LOGO]', error);
    await sock.sendMessage(chatId, { text: t('commands.logo.failed') }, { quoted: message });
  }
}
module.exports = logoCommand;
