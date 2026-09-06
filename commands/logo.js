const mumaker = require('mumaker');
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

async function logoCommand(sock, chatId, message, args) {
  const rawStyle = String(args?.[0] || '').trim().toLowerCase();
  const styleAliases = Object.fromEntries(Object.entries(AR).flatMap(([key, ar]) => [[key, key], [ar.toLowerCase(), key]]));
  Object.assign(styleAliases, { 'زخرفة': 'chrome', 'زخارف': 'chrome', 'معدني': 'chrome', 'ذهبي': 'gold', 'نيون': 'neon', 'كروم': 'chrome' });
  const style = styleAliases[rawStyle] || rawStyle;
  const text = args?.slice(1).join(' ').trim();
  const arabicText = /[\u0600-\u06FF]/.test(text);
  const normalizedText = arabicText ? text.normalize('NFC') : text;
  if (!STYLES[style] || !text) {
    const list = Object.keys(STYLES).map(k => `• ${AR[k]}`).join('\n');
    return sock.sendMessage(chatId, { text: `🎨 *إنشاء شعار*\n\nالاستخدام: *.لوجو <النمط> <النص>*\n\nالأنماط المتاحة:\n${list}\n\nمثال: *.لوجو ناروتو ليو*\nمثال للزخارف: *.لوجو زخرفة محمد*` }, { quoted: message });
  }
  try {
    await sock.sendMessage(chatId, { text: t('commands.logo.processing') }, { quoted: message });
    const result = await mumaker.ephoto(STYLES[style], normalizedText);
    if (!result?.image) throw new Error('No image returned');
    await sock.sendMessage(chatId, { image: { url: result.image }, caption: t('commands.logo.caption', '', { style: AR[style] || style }) }, { quoted: message });
  } catch (error) {
    console.error('[LOGO]', error);
    await sock.sendMessage(chatId, { text: t('commands.logo.failed') }, { quoted: message });
  }
}
module.exports = logoCommand;
