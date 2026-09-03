const anilist = require('./anilist');
const jikan = require('./jikan');
const kitsu = require('./kitsu');
const { normalizeAnimeResult } = require('../core/normalize');

const CACHE_TTL = 15 * 60 * 1000;
const searchCache = new Map();
const detailCache = new Map();

function key(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function getCached(map, k) {
  const item = map.get(k);
  if (!item) return null;
  if (Date.now() - item.at > CACHE_TTL) { map.delete(k); return null; }
  return item.value;
}
function setCached(map, k, value) { map.set(k, { at: Date.now(), value }); return value; }

function scoreResult(result, query) {
  const q = key(query);
  const names = [result.title, result.english, result.romaji, result.native].filter(Boolean).map(key);
  let score = 0;
  if (names.includes(q)) score += 1000;
  if (names.some(n => n === q)) score += 500;
  if (names.some(n => n.startsWith(q) || q.startsWith(n))) score += 250;
  const tokens = q.split(' ').filter(Boolean);
  for (const token of tokens) if (names.some(n => n.includes(token))) score += 30;
  score += Math.min(10, Number(result.score) || 0) * 10;
  score += Math.min(50, Math.log10(Math.max(1, Number(result.popularity) || 1)) * 10);
  return score;
}

function mergeResults(primary, fallback, query) {
  const all = [...(primary || []), ...(fallback || [])].map(normalizeAnimeResult).filter(Boolean);
  const seen = new Set();
  return all.filter(item => {
    const k = `${item.provider}:${item.id}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((a, b) => scoreResult(b, query) - scoreResult(a, query)).slice(0, 6);
}

async function search(query) {
  const k = key(query);
  const cached = getCached(searchCache, k);
  if (cached) return cached;
  let primary = [], fallback = [];
  try { primary = await anilist.search(query); } catch (error) { console.warn('[Anime/AniList]', error.message); }
  // Jikan is used when AniList fails or returns no useful results; it also helps Arabic/alternate-title searches.
  if (!primary.length) {
    try { fallback = await jikan.search(query); } catch (error) { console.warn('[Anime/Jikan]', error.message); }
  }
  // If both primary providers are unavailable (e.g. AniList 403 + Jikan 504),
  // use Kitsu as a third keyless provider instead of immediately returning NOT_FOUND.
  let tertiary = [];
  if (!primary.length && !fallback.length) {
    try { tertiary = await kitsu.search(query); } catch (error) { console.warn('[Anime/Kitsu]', error.message); }
  }
  const results = mergeResults(primary, [...fallback, ...tertiary], query);
  if (!results.length) throw new Error('ANIME_NOT_FOUND');
  return setCached(searchCache, k, results);
}

async function getDetails(result) {
  const k = `${result.provider}:${result.id}`;
  const cached = getCached(detailCache, k);
  if (cached) return cached;
  let details = null;
  try {
    details = result.provider === 'anilist' ? await anilist.getById(result.id) : result.provider === 'jikan' ? await jikan.getById(result.id) : result.provider === 'kitsu' ? await kitsu.getById(result.id) : null;
  } catch (error) {
    console.warn('[Anime/details]', result.provider, error.message);
  }
  if (!details) {
    const other = result.provider === 'anilist' ? jikan : anilist;
    try {
      details = result.provider === 'anilist' && result.malId ? await jikan.getById(result.malId) : null;
      if (!details && result.provider === 'jikan') details = await anilist.getById(result.id);
    } catch (error) { console.warn('[Anime/details fallback]', error.message); }
  }
  if (!details) throw new Error('ANIME_DETAILS_FAILED');
  return setCached(detailCache, k, details);
}

module.exports = { search, getDetails };
