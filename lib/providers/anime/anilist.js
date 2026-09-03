const { requestJson } = require('../core/http');
const { run, canRun } = require('../core/health');

const ENDPOINT = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
query ($search: String!, $perPage: Int = 6) {
  Page(perPage: $perPage) {
    pageInfo { hasNextPage }
    media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
      id
      idMal
      title { romaji english native userPreferred }
      format
      status
      episodes
      averageScore
      startDate { year month day }
      coverImage { large extraLarge }
      isAdult
    }
  }
}`;

const DETAIL_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title { romaji english native userPreferred }
    synonyms
    description(asHtml: false)
    format
    status
    episodes
    duration
    startDate { year month day }
    endDate { year month day }
    season
    seasonYear
    countryOfOrigin
    source(version: 2)
    isAdult
    genres
    averageScore
    meanScore
    popularity
    coverImage { large extraLarge }
    bannerImage
    siteUrl
    studios {
      nodes { name isAnimationStudio siteUrl }
    }
    staff(sort: RELEVANCE, perPage: 10) {
      edges { role node { name { full native } } }
    }
    relations {
      edges {
        relationType
        node { id type format title { romaji english native } }
      }
    }
  }
}`;

function cleanDescription(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\([^)]*\)/g, m => m)
    .replace(/\*\*|__/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function dateValue(date) {
  if (!date?.year) return null;
  const y = String(date.year);
  const m = date.month ? String(date.month).padStart(2, '0') : '01';
  const d = date.day ? String(date.day).padStart(2, '0') : '01';
  return `${y}-${m}-${d}`;
}
function mapStaff(staff) {
  const out = { directors: [], writers: [], creators: [] };
  for (const edge of staff?.edges || []) {
    const role = String(edge.role || '').toLowerCase();
    const name = edge.node?.name?.full;
    if (!name) continue;
    if (role.includes('director')) out.directors.push(name);
    if (role.includes('script') || role.includes('series composition') || role.includes('writer')) out.writers.push(name);
    if (role.includes('original creator') || role.includes('original creator')) out.creators.push(name);
  }
  for (const key of Object.keys(out)) out[key] = [...new Set(out[key])].slice(0, 4);
  return out;
}
function mapSearch(item) {
  return {
    provider: 'anilist',
    id: item.id,
    malId: item.idMal || null,
    title: item.title?.english || item.title?.romaji || item.title?.native || 'Unknown',
    romaji: item.title?.romaji || null,
    english: item.title?.english || null,
    native: item.title?.native || null,
    format: item.format || null,
    status: item.status || null,
    episodes: item.episodes ?? null,
    score: item.averageScore != null ? Number((item.averageScore / 10).toFixed(1)) : null,
    startDate: dateValue(item.startDate),
    image: item.coverImage?.extraLarge || item.coverImage?.large || null,
  };
}
function mapDetail(m) {
  if (!m || m.isAdult) return null;
  const staff = mapStaff(m.staff);
  const relations = (m.relations?.edges || [])
    .filter(e => e.node?.type === 'ANIME' && e.node?.id)
    .map(e => ({
      type: e.relationType,
      id: e.node.id,
      title: e.node.title?.english || e.node.title?.romaji || e.node.title?.native || null,
      format: e.node.format || null,
    }))
    .filter(x => x.title)
    .slice(0, 8);
  return {
    provider: 'anilist',
    id: m.id,
    malId: m.idMal || null,
    title: m.title?.english || m.title?.romaji || m.title?.native || 'Unknown',
    titles: {
      romaji: m.title?.romaji || null,
      english: m.title?.english || null,
      native: m.title?.native || null,
      userPreferred: m.title?.userPreferred || null,
      synonyms: Array.isArray(m.synonyms) ? m.synonyms.filter(Boolean).slice(0, 8) : [],
    },
    description: cleanDescription(m.description),
    format: m.format || null,
    status: m.status || null,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
    startDate: dateValue(m.startDate),
    endDate: dateValue(m.endDate),
    season: m.season || null,
    seasonYear: m.seasonYear || null,
    country: m.countryOfOrigin || null,
    source: m.source || null,
    isAdult: Boolean(m.isAdult),
    genres: Array.isArray(m.genres) ? m.genres.filter(Boolean).slice(0, 8) : [],
    score: m.averageScore != null ? Number((m.averageScore / 10).toFixed(1)) : (m.meanScore != null ? Number((m.meanScore / 10).toFixed(1)) : null),
    popularity: m.popularity ?? null,
    image: m.coverImage?.extraLarge || m.coverImage?.large || null,
    banner: m.bannerImage || null,
    siteUrl: m.siteUrl || null,
    studios: (m.studios?.nodes || []).map(s => s.name).filter(Boolean).slice(0, 5),
    directors: staff.directors,
    writers: staff.writers,
    creators: staff.creators,
    relations,
  };
}

async function search(query) {
  if (!canRun('anilist')) throw Object.assign(new Error('AniList circuit open'), { code: 'PROVIDER_CIRCUIT_OPEN' });
  return run('anilist', async () => {
    const data = await requestJson(ENDPOINT, {
      method: 'POST',
      timeout: 18000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'LeoBot/1.35.6' },
      data: { query: SEARCH_QUERY, variables: { search: query, perPage: 6 } },
    });
    if (data?.errors?.length) throw new Error(data.errors[0].message || 'AniList GraphQL error');
    return (data?.data?.Page?.media || []).filter(x => !x.isAdult).map(mapSearch);
  });
}

async function getById(id) {
  if (!canRun('anilist')) throw Object.assign(new Error('AniList circuit open'), { code: 'PROVIDER_CIRCUIT_OPEN' });
  return run('anilist', async () => {
    const data = await requestJson(ENDPOINT, {
      method: 'POST',
      timeout: 18000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'LeoBot/1.35.6' },
      data: { query: DETAIL_QUERY, variables: { id: Number(id) } },
    });
    if (data?.errors?.length) throw new Error(data.errors[0].message || 'AniList GraphQL error');
    return mapDetail(data?.data?.Media);
  });
}

module.exports = { search, getById };
