const { requestJson } = require('../core/http');
const { run, canRun } = require('../core/health');

const BASE = 'https://kitsu.io/api/edge/anime';

function mapSearch(item) {
  const a = item?.attributes || {};
  const titles = a.titles || {};
  return {
    provider: 'kitsu',
    id: item?.id,
    malId: null,
    title: titles.en || titles.en_jp || titles.ja_jp || a.canonicalTitle || 'Unknown',
    romaji: titles.en_jp || titles.ja_jp || a.canonicalTitle || null,
    english: titles.en || null,
    native: titles.ja_jp || null,
    format: a.showType || null,
    status: a.status || null,
    episodes: a.episodeCount ?? null,
    score: a.averageRating != null ? Number(a.averageRating) / 10 : null,
    popularity: a.popularityRank ? 1 / Math.max(1, Number(a.popularityRank)) : null,
    startDate: a.startDate || null,
    image: a.posterImage?.large || a.posterImage?.medium || a.posterImage?.small || null,
  };
}

function mapDetail(item) {
  const a = item?.attributes || {};
  const titles = a.titles || {};
  const title = titles.en || titles.en_jp || titles.ja_jp || a.canonicalTitle || 'Unknown';
  return {
    provider: 'kitsu', id: item?.id, malId: null, title,
    titles: { romaji: titles.en_jp || titles.ja_jp || null, english: titles.en || null, native: titles.ja_jp || null, userPreferred: a.canonicalTitle || title, synonyms: [] },
    description: String(a.synopsis || '').replace(/\s+/g, ' ').trim(),
    format: a.showType || null, status: a.status || null, episodes: a.episodeCount ?? null, duration: a.episodeLength ?? null,
    startDate: a.startDate || null, endDate: a.endDate || null, season: null, seasonYear: a.startDate ? Number(String(a.startDate).slice(0, 4)) || null : null,
    country: null, source: null, isAdult: false, genres: [], score: a.averageRating != null ? Number(a.averageRating) / 10 : null,
    popularity: a.popularityRank ? 1 / Math.max(1, Number(a.popularityRank)) : null,
    image: a.posterImage?.large || a.posterImage?.medium || a.posterImage?.small || null, banner: a.coverImage?.large || a.coverImage?.original || null,
    siteUrl: null, studios: [], directors: [], writers: [], creators: [], relations: [],
  };
}

async function search(query) {
  if (!canRun('kitsu')) throw Object.assign(new Error('Kitsu circuit open'), { code: 'PROVIDER_CIRCUIT_OPEN' });
  return run('kitsu', async () => {
    const data = await requestJson(BASE, {
      timeout: 15000,
      headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'LeoBot/1.35.6' },
      params: { 'filter[text]': query, 'page[limit]': 6 },
    });
    return (data?.data || []).filter(x => x?.id).map(mapSearch);
  });
}

async function getById(id) {
  if (!canRun('kitsu')) throw Object.assign(new Error('Kitsu circuit open'), { code: 'PROVIDER_CIRCUIT_OPEN' });
  return run('kitsu', async () => {
    const data = await requestJson(`${BASE}/${encodeURIComponent(id)}`, {
      timeout: 15000,
      headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'LeoBot/1.35.6' },
    });
    return mapDetail(data?.data);
  });
}

module.exports = { search, getById };
