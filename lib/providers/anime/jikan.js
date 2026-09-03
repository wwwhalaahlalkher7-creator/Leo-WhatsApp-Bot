const { requestJson } = require('../core/http');
const { run, canRun } = require('../core/health');

const BASE = 'https://api.jikan.moe/v4';

function mapSearch(item) {
  return {
    provider: 'jikan',
    id: item.mal_id,
    title: item.title || item.title_english || item.title_japanese || 'Unknown',
    romaji: item.title || null,
    english: item.title_english || null,
    native: item.title_japanese || null,
    format: item.type || null,
    status: item.status || null,
    episodes: item.episodes ?? null,
    score: item.score ?? null,
    startDate: item.aired?.from ? item.aired.from.slice(0, 10) : null,
    image: item.images?.jpg?.large_image_url || item.images?.webp?.large_image_url || item.images?.jpg?.image_url || null,
  };
}
function mapDetail(a) {
  if (!a || a.type === 'Music') return null;
  const staff = Array.isArray(a.staff) ? a.staff : [];
  const directors = staff.filter(s => (s.positions || []).some(p => /director/i.test(p))).map(s => s.person?.name).filter(Boolean).slice(0, 4);
  const writers = staff.filter(s => (s.positions || []).some(p => /script|writer|series composition/i.test(p))).map(s => s.person?.name).filter(Boolean).slice(0, 4);
  const studios = (a.studios || []).map(s => s.name).filter(Boolean).slice(0, 5);
  const relations = (a.relations || []).flatMap(group => (group.entry || []).map(entry => ({
    type: group.relation,
    id: entry.mal_id,
    title: entry.name || null,
    format: entry.type || null,
  }))).filter(x => x.title).slice(0, 8);
  return {
    provider: 'jikan',
    id: a.mal_id,
    malId: a.mal_id,
    title: a.title || a.title_english || a.title_japanese || 'Unknown',
    titles: {
      romaji: a.title || null,
      english: a.title_english || null,
      native: a.title_japanese || null,
      userPreferred: a.title || null,
      synonyms: [...(a.title_synonyms || []), ...(a.titles || []).map(x => x.title).filter(Boolean)].slice(0, 8),
    },
    description: String(a.synopsis || '').replace(/\s+/g, ' ').trim(),
    format: a.type || null,
    status: a.status || null,
    episodes: a.episodes ?? null,
    duration: a.duration || null,
    startDate: a.aired?.from ? a.aired.from.slice(0, 10) : null,
    endDate: a.aired?.to ? a.aired.to.slice(0, 10) : null,
    season: a.season || null,
    seasonYear: a.year || null,
    country: a.demographics?.[0]?.name || null,
    source: a.source || null,
    isAdult: false,
    genres: [...(a.genres || []), ...(a.themes || [])].map(x => x.name).filter(Boolean).slice(0, 8),
    score: a.score ?? null,
    popularity: a.popularity ?? null,
    image: a.images?.webp?.large_image_url || a.images?.jpg?.large_image_url || null,
    banner: null,
    siteUrl: a.url || null,
    studios,
    directors,
    writers,
    creators: [],
    relations,
  };
}

async function search(query) {
  if (!canRun('jikan')) throw Object.assign(new Error('Jikan circuit open'), { code: 'PROVIDER_CIRCUIT_OPEN' });
  return run('jikan', async () => {
    const data = await requestJson(`${BASE}/anime`, { timeout: 18000, headers: { Accept: 'application/json', 'User-Agent': 'LeoBot/1.35.6' }, params: { q: query, limit: 6, sfw: true, order_by: 'score', sort: 'desc' } });
    return (data?.data || []).filter(x => x?.mal_id).map(mapSearch);
  });
}
async function getById(id) {
  if (!canRun('jikan')) throw Object.assign(new Error('Jikan circuit open'), { code: 'PROVIDER_CIRCUIT_OPEN' });
  return run('jikan', async () => {
    const data = await requestJson(`${BASE}/anime/${Number(id)}/full`, { timeout: 20000 });
    return mapDetail(data?.data);
  });
}
module.exports = { search, getById };
