const settings = require('../settings');
const path = require('path');
const sharp = require('sharp');
const store = require('../lib/lightweight_store');
const { whatsappImage, safeProfileBuffer } = require('../lib/image-output');

const TEMPLATE = path.join(__dirname, '..', 'assets', 'wanted-template.png');

// Canonical bounties revealed in One Piece. We never invent a numeric bounty;
// if the target is not a known character, one of these real values is assigned.
const ONE_PIECE_BOUNTIES = [
  { name: 'Gol D. Roger', bounty: 5564800000 },
  { name: 'Edward Newgate (Whitebeard)', bounty: 5046000000 },
  { name: 'Kaido', bounty: 4611100000 },
  { name: 'Charlotte Linlin (Big Mom)', bounty: 4388000000 },
  { name: 'Shanks', bounty: 4048900000 },
  { name: 'Marshall D. Teach (Blackbeard)', bounty: 3996000000 },
  { name: 'Dracule Mihawk', bounty: 3590000000 },
  { name: 'Buggy', bounty: 3189000000 },
  { name: 'Monkey D. Luffy', bounty: 3000000000 },
  { name: 'Trafalgar D. Water Law', bounty: 3000000000 },
  { name: 'Eustass Kid', bounty: 3000000000 },
  { name: 'Crocodile', bounty: 1965000000 },
  { name: 'Boa Hancock', bounty: 1659000000 },
  { name: 'King', bounty: 1390000000 },
  { name: 'Marco', bounty: 1374000000 },
  { name: 'Queen', bounty: 1320000000 },
  { name: 'Roronoa Zoro', bounty: 1111000000 },
  { name: 'Jinbe', bounty: 1100000000 },
  { name: 'Vinsmoke Sanji', bounty: 1032000000 },
  { name: 'Jack', bounty: 1000000000 },
  { name: 'Charlotte Smoothie', bounty: 932000000 },
  { name: 'Nico Robin', bounty: 930000000 },
  { name: 'Usopp', bounty: 500000000 },
  { name: 'Franky', bounty: 394000000 },
  { name: 'Brook', bounty: 383000000 },
  { name: 'Nami', bounty: 366000000 },
  { name: 'Tony Tony Chopper', bounty: 1000 },
];

const CHARACTER_ALIASES = new Map([
  ['luffy', 'Monkey D. Luffy'], ['لوفي', 'Monkey D. Luffy'],
  ['zoro', 'Roronoa Zoro'], ['زورو', 'Roronoa Zoro'],
  ['sanji', 'Vinsmoke Sanji'], ['سانجي', 'Vinsmoke Sanji'],
  ['nami', 'Nami'], ['نامي', 'Nami'],
  ['robin', 'Nico Robin'], ['روبين', 'Nico Robin'],
  ['usopp', 'Usopp'], ['يوسوب', 'Usopp'],
  ['franky', 'Franky'], ['فرانكي', 'Franky'],
  ['brook', 'Brook'], ['بروك', 'Brook'],
  ['chopper', 'Tony Tony Chopper'], ['تشوبر', 'Tony Tony Chopper'],
  ['jinbe', 'Jinbe'], ['jimbei', 'Jinbe'], ['جينبي', 'Jinbe'],
  ['shanks', 'Shanks'], ['شانكس', 'Shanks'],
  ['kaido', 'Kaido'], ['كايدو', 'Kaido'],
  ['big mom', 'Charlotte Linlin (Big Mom)'], ['بيغ مام', 'Charlotte Linlin (Big Mom)'],
  ['blackbeard', 'Marshall D. Teach (Blackbeard)'], ['اللحية السوداء', 'Marshall D. Teach (Blackbeard)'],
  ['whitebeard', 'Edward Newgate (Whitebeard)'], ['اللحية البيضاء', 'Edward Newgate (Whitebeard)'],
  ['roger', 'Gol D. Roger'], ['روجر', 'Gol D. Roger'],
  ['mihawk', 'Dracule Mihawk'], ['ميهوك', 'Dracule Mihawk'],
  ['buggy', 'Buggy'], ['باغي', 'Buggy'],
  ['crocodile', 'Crocodile'], ['كروكودايل', 'Crocodile'],
  ['boa', 'Boa Hancock'], ['بوا', 'Boa Hancock'],
  ['law', 'Trafalgar D. Water Law'], ['لو', 'Trafalgar D. Water Law'],
  ['kid', 'Eustass Kid'], ['كيد', 'Eustass Kid'],
]);

function escapeXml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fitFontSize(name) {
  const length = [...String(name)].length;
  if (length <= 14) return 60;
  if (length <= 21) return 52;
  if (length <= 28) return 45;
  if (length <= 36) return 38;
  return 32;
}

function formatBounty(value) {
  return Number(value).toLocaleString('en-US');
}

function stableIndex(value, size) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % size;
}

function chooseBounty(displayName, userId) {
  const key = String(displayName || '').trim().toLowerCase();
  const normalized = CHARACTER_ALIASES.get(key);
  const exact = ONE_PIECE_BOUNTIES.find(item => item.name.toLowerCase() === key || item.name === normalized);
  if (exact) return exact;
  return ONE_PIECE_BOUNTIES[stableIndex(userId || displayName, ONE_PIECE_BOUNTIES.length)];
}

function textOverlay(name, bounty, width, height) {
  const safeName = escapeXml(name);
  const safeBounty = escapeXml(formatBounty(bounty));
  const fontSize = fitFontSize(name);
  const cx = Math.round(width / 2);
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
          <feOffset dy="2"/>
          <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <style>
        .poster { fill:#493b33; font-family: 'Noto Sans Arabic', 'Noto Kufi Arabic', 'DejaVu Sans', sans-serif; font-weight:700; }
        .small { fill:#493b33; font-family: 'Noto Sans Arabic', 'Noto Kufi Arabic', 'DejaVu Sans', sans-serif; font-weight:700; }
      </style>
      <text x="${cx}" y="1118" text-anchor="middle" class="poster" font-size="${fontSize}" letter-spacing="1.5" filter="url(#shadow)">${safeName}</text>
      <text x="${cx}" y="1218" text-anchor="middle" class="small" font-size="42" letter-spacing="3" filter="url(#shadow)">฿ ${safeBounty}-</text>
    </svg>
  `);
}

async function getTargetInfo(sock, message) {
  const context = message.message?.extendedTextMessage?.contextInfo;
  const user = context?.mentionedJid?.[0] || context?.participant || null;
  if (!user) return null;

  // The wanted target is always the person who was mentioned or whose
  // message was quoted. Prefer that person's WhatsApp display name rather
  // than the command sender's name.
  const contact = store.contacts?.[user] || {};
  let name = String(contact?.name || contact?.notify || '').trim();
  if (!name && typeof sock.getName === 'function') {
    try { name = String(await sock.getName(user, false) || '').trim(); } catch {}
  }
  if (!name) name = `@${String(user).split('@')[0]}`;
  return { user, name };
}

async function wantedCommand(sock, chatId, message) {
  const target = await getTargetInfo(sock, message);
  const user = target?.user;
  if (!user) {
    return sock.sendMessage(chatId, { text: '📌 منشن الشخص المطلوب أو رد على رسالته لاستخدام الأمر.' }, { quoted: message });
  }

  try {
    const { buffer: profile, fallback } = await safeProfileBuffer(sock, user, 900);
    // Keep the target name consistent in both the caption and poster.
    const name = target.name;
    const bounty = chooseBounty(name, user);
    const templateMeta = await sharp(TEMPLATE).metadata();
    const width = Number(templateMeta.width || 1041);
    const height = Number(templateMeta.height || 1536);

    // Coordinates are fitted to the supplied poster: the portrait replaces only
    // the black photo panel and never covers the printed frame/text.
    const photo = {
      left: Math.round(width * 0.1047),
      top: Math.round(height * 0.215),
      width: Math.round(width * 0.7915),
      height: Math.round(height * 0.4055),
    };

    const portrait = await sharp(profile)
      .resize(photo.width, photo.height, { fit: 'cover', position: 'centre' })
      .grayscale()
      .modulate({ brightness: 1.05, saturation: 0.12 })
      .jpeg({ quality: 92 })
      .toBuffer();

    const composed = await sharp(TEMPLATE)
      .composite([
        { input: portrait, left: photo.left, top: photo.top },
        { input: textOverlay(name, bounty.bounty, width, height), left: 0, top: 0 },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();
    // Prefer a WhatsApp-friendly image below 1 MB, but never refuse to send it
    // if the artwork cannot be compressed that far.
    const output = await whatsappImage(composed, { width, height, initialQuality: 90, minQuality: 45 });

    await sock.sendMessage(chatId, {
      image: output,
      caption: `🎯 *مطلوب:* ${name}\n💰 *المكافأة:* ฿ ${formatBounty(bounty.bounty)}-\n☠️ مطلوب حي او ميت.${fallback ? '\n👤 صورة افتراضية: لا توجد صورة بروفايل.' : ''}`,
      mentions: [user],
    }, { quoted: message });
  } catch (error) {
    console.error('[WANTED]', error?.message || error);
    await sock.sendMessage(chatId, { text: '❌ تعذر إنشاء بوستر المطلوب حاليًا. حاول مرة أخرى.' }, { quoted: message });
  }
}

async function axiosBuffer(url) {
  const axios = require('axios');
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 8 * 1024 * 1024,
    headers: { 'User-Agent': `LeoBot/${settings.version}` },
  });
  return Buffer.from(response.data);
}

module.exports = wantedCommand;
