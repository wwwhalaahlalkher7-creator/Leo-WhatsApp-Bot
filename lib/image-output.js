const settings = require('../settings');
const sharp = require('sharp');

const PREFERRED_MAX_BYTES = 900 * 1024; // keep a safety margin below 1 MB

/**
 * Encode an image for WhatsApp. Prefer <= 900 KB, but never reject an image
 * solely because it is larger than that threshold.
 */
async function whatsappImage(buffer, options = {}) {
  const maxBytes = Number(options.preferredMaxBytes || PREFERRED_MAX_BYTES);
  const width = Number(options.width || 0);
  const height = Number(options.height || 0);
  const initialQuality = Number(options.initialQuality || 88);
  const minQuality = Number(options.minQuality || 42);
  let currentWidth = width;
  let currentHeight = height;
  let best = null;

  for (let attempt = 0; attempt < 9; attempt += 1) {
    let pipeline = sharp(buffer);
    if (currentWidth > 0 && currentHeight > 0) {
      pipeline = pipeline.resize(currentWidth, currentHeight, { fit: 'inside', withoutEnlargement: false });
    }
    const quality = Math.max(minQuality, initialQuality - attempt * 6);
    const candidate = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    if (!best || candidate.length < best.length) best = candidate;
    if (candidate.length <= maxBytes) return candidate;

    // If quality reduction is not enough, gently reduce dimensions as well.
    if (attempt >= 3) {
      currentWidth = Math.max(640, Math.round((currentWidth || (await sharp(buffer).metadata()).width || 1080) * 0.88));
      currentHeight = Math.max(640, Math.round((currentHeight || (await sharp(buffer).metadata()).height || 1440) * 0.88));
    }
  }
  return best || buffer;
}

async function genericAvatar(size = 900) {
  const safe = Math.max(256, Number(size) || 900);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safe}" height="${safe}" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#d9d9d9"/>
    <circle cx="50" cy="38" r="18" fill="#8c8c8c"/>
    <path d="M18 91c2-22 15-32 32-32s30 10 32 32z" fill="#8c8c8c"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function safeProfileBuffer(sock, jid, fallbackSize = 900) {
  try {
    const url = await sock.profilePictureUrl(jid, 'image');
    if (url) {
      const axios = require('axios');
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 25000,
        maxContentLength: 15 * 1024 * 1024,
        maxBodyLength: 15 * 1024 * 1024,
        headers: { 'User-Agent': `LeoBot/${settings.version}` },
        validateStatus: status => status >= 200 && status < 300,
      });
      const buffer = Buffer.from(response.data);
      const meta = await sharp(buffer).metadata();
      if (meta?.width && meta?.height) return { buffer, fallback: false };
    }
  } catch (_) {}
  return { buffer: await genericAvatar(fallbackSize), fallback: true };
}

module.exports = { whatsappImage, genericAvatar, safeProfileBuffer };
