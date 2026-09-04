'use strict';
const sharp = require('sharp');
const { safeProfileBuffer } = require('../lib/image-output');
const xp = require('../systems/xp');
const currency = require('../systems/economy/currency');

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cardSvg(name, data) {
  const width = 1200, height = 500, barX = 470, barY = 315, barW = 650, barH = 34;
  const progress = Math.max(0, Math.min(1, data.intoLevel / data.required));
  const fill = Math.max(4, Math.round(barW * progress));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs>
  <rect width="100%" height="100%" rx="36" fill="#111827"/>
  <text x="470" y="90" fill="#ffffff" font-size="44" font-family="sans-serif" font-weight="700">${esc(name)}</text>
  <text x="470" y="155" fill="#a5b4fc" font-size="30" font-family="sans-serif">مستوى ${data.level}</text>
  <text x="470" y="250" fill="#ffffff" font-size="28" font-family="sans-serif">${data.intoLevel} / ${data.required} XP</text>
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="17" fill="#374151"/>
  <rect x="${barX}" y="${barY}" width="${fill}" height="${barH}" rx="17" fill="url(#g)"/>
  <text x="470" y="405" fill="#d1d5db" font-size="24" font-family="sans-serif">المتبقي للمستوى القادم: ${Math.max(0, data.required - data.intoLevel)} XP</text>
  <text x="470" y="450" fill="#9ca3af" font-size="22" font-family="sans-serif">⭐ ${data.level}   •   🪙 ${currency.name}</text>
  </svg>`;
}
async function levelCommand(sock, chatId, userId, message) {
  try {
    const data = xp.get(userId);
    let name = 'عضو Leo';
    try { name = await sock.getName(userId, false) || name; } catch {}
    const { buffer: avatar } = await safeProfileBuffer(sock, userId, 500);
    const base = await sharp(Buffer.from(cardSvg(name, data))).png().toBuffer();
    const mask = Buffer.from('<svg width="330" height="330"><circle cx="165" cy="165" r="165" fill="white"/></svg>');
    const avatarRound = await sharp(avatar).resize(330,330,{fit:'cover'}).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
    const out = await sharp(base).composite([{ input: avatarRound, left: 65, top: 85 }]).jpeg({quality:90}).toBuffer();
    return sock.sendMessage(chatId,{image:out,caption:`⭐ *مستوى ${data.level}*\n\n✨ XP: *${data.intoLevel} / ${data.required}*\n📈 المتبقي: *${Math.max(0,data.required-data.intoLevel)} XP*`},{quoted:message});
  } catch (e) { console.error('[LEVEL]', e?.message || e); return sock.sendMessage(chatId,{text:'❌ تعذر إنشاء بطاقة المستوى حاليًا.'},{quoted:message}); }
}
module.exports = levelCommand;
