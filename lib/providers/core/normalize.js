'use strict';

function mediaUrl(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return /^https?:$/.test(url.protocol) && Boolean(url.hostname) ? url.toString() : null;
  } catch (_) { return null; }
}

function normalizeMediaItem(item, fallbackType = null) {
  if (typeof item === 'string') {
    const url = mediaUrl(item);
    return url ? { url, ...(fallbackType ? { type: fallbackType } : {}) } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const url = mediaUrl(item.url || item.download || item.download_url || item.downloadUrl || item.video || item.audio);
  if (!url) return null;
  const type = String(item.type || fallbackType || '').toLowerCase();
  return {
    url,
    ...(type ? { type } : {}),
    ...(item.quality ? { quality: String(item.quality) } : {}),
    ...(item.extension ? { extension: String(item.extension).replace(/^\./, '').toLowerCase() } : {}),
  };
}

function normalizeMediaResult(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of ['title', 'artist', 'duration', 'thumbnail', 'provider']) {
    if (value[key] != null && value[key] !== '') out[key] = value[key];
  }
  for (const key of ['download', 'video', 'audio']) {
    const url = mediaUrl(value[key]);
    if (url) out[key] = url;
  }
  const media = Array.isArray(value.media)
    ? value.media.map(item => normalizeMediaItem(item)).filter(Boolean)
    : [];
  const singles = [
    out.video && { url: out.video, type: 'video' },
    out.audio && { url: out.audio, type: 'audio' },
    out.download && { url: out.download },
  ].filter(Boolean);
  const merged = [...media, ...singles];
  const seen = new Set();
  out.media = merged.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  if (!out.download && out.video) out.download = out.video;
  return out.media.length || out.download || out.video || out.audio ? out : null;
}

function normalizeAnimeResult(item) {
  if (!item || typeof item !== 'object' || item.id == null) return null;
  const title = String(item.title || item.english || item.romaji || item.native || '').trim();
  if (!title) return null;
  return {
    provider: String(item.provider || 'unknown'),
    id: item.id,
    malId: item.malId ?? null,
    title,
    romaji: item.romaji || null,
    english: item.english || null,
    native: item.native || null,
    format: item.format || null,
    status: item.status || null,
    episodes: item.episodes ?? null,
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    popularity: Number.isFinite(Number(item.popularity)) ? Number(item.popularity) : null,
    startDate: item.startDate || null,
    image: item.image || null,
  };
}

module.exports = { mediaUrl, normalizeMediaItem, normalizeMediaResult, normalizeAnimeResult };
