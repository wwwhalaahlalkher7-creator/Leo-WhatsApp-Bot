const axios = require('axios');
const cheerio = require('cheerio');
const { ttdl, igdl } = require('ruhend-scraper');
const health = require('../core/health');
const { normalizeMediaResult } = require('../core/normalize');
const telemetry = require('../core/telemetry');
let btch = null;
try { btch = require('btch-downloader'); } catch { btch = null; }
let distubeYtdl = null;
try { distubeYtdl = require('@distube/ytdl-core'); } catch { distubeYtdl = null; }

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
};

async function request(url, options = {}) {
  const timeout = options.timeout || 60000;
  const controller = options.signal ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
  if (timer?.unref) timer.unref();
  try {
    return await axios.get(url, {
    timeout,
    signal: options.signal || controller.signal,
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
    responseType: options.responseType || 'json',
    maxContentLength: options.maxContentLength || Infinity,
    maxBodyLength: options.maxBodyLength || Infinity,
    validateStatus: s => s >= 200 && s < 400,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isUsableMediaUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return /^https?:$/.test(u.protocol) && Boolean(u.hostname);
  } catch (_) {
    return false;
  }
}

function validateFallbackResult(value) {
  return Boolean(normalizeMediaResult(value));
}


async function probeMediaUrl(url) {
  if (!isUsableMediaUrl(url)) return false;
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 12000,
      maxRedirects: 5,
      headers: { ...DEFAULT_HEADERS, Range: 'bytes=0-65535' },
      validateStatus: s => s >= 200 && s < 400,
    });
    const type = String(response.headers['content-type'] || '').toLowerCase();
    const looksHtml = type.includes('text/html') || type.includes('application/json') || type.includes('text/plain');
    response.data?.destroy?.();
    return !looksHtml;
  } catch (_) {
    return false;
  }
}

async function validateDownloadableResult(value) {
  const normalized = normalizeMediaResult(value);
  if (!normalized) return false;
  const urls = [];
  for (const item of normalized.media || []) if (item?.url) urls.push(item.url);
  for (const key of ['video', 'audio', 'download']) if (normalized[key]) urls.push(normalized[key]);
  const unique = [...new Set(urls)].slice(0, 4);
  if (!unique.length) return false;
  // A provider is considered successful only when its returned CDN link is
  // actually reachable. This prevents a stale/HTML/error URL from stopping
  // the fallback chain before the next provider gets a chance.
  const checks = await Promise.all(unique.map(probeMediaUrl));
  return checks.some(Boolean);
}

async function withFallback(providers, label, options = {}) {
  const errors = [];
  const errorDetails = [];
  const validate = typeof options.validate === 'function' ? options.validate : validateDownloadableResult;
  for (const provider of providers || []) {
    if (!provider || typeof provider.run !== 'function') continue;
    try {
      const result = await health.run(provider.name, async () => {
        const raw = await provider.run();
        const value = normalizeMediaResult(raw);
        if (!value || !validate(value)) {
          const error = new Error('Provider returned an unusable result');
          error.code = 'PROVIDER_EMPTY_OR_INVALID';
          throw error;
        }
        return value;
      });
      if (errorDetails.length) telemetry.recordFallback({ label, provider: provider.name, outcome: 'success_after_fallback', reason: `${errorDetails.length} provider failure(s) before success` });
      return { ...result, provider: provider.name };
    } catch (error) {
      const detail = { provider: provider.name, code: error?.code || null, status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null, classification: typeof health.classifyError === 'function' ? health.classifyError(error) : 'unknown', error: error?.message || String(error) };
    errorDetails.push(detail);
    telemetry.recordFallback({ label, provider: provider.name, outcome: 'failed', code: detail.code, classification: detail.classification, reason: detail.error });
    errors.push(`${provider.name}: ${detail.error}`);
    }
  }
  const error = new Error(`${label} providers exhausted`);
  error.causes = errors;
  error.providerErrors = errorDetails;
  throw error;
}


function classifyDownloadLink(link) {
  const url = String(link?.url || '');
  const hint = `${link?.format || ''} ${link?.type || ''} ${link?.mime || ''} ${link?.quality || ''} ${url}`.toLowerCase();
  if (/image|photo|picture|jpg|jpeg|png|webp|gif/.test(hint)) return 'image';
  if (/audio|mp3|m4a|aac|ogg|wav|opus/.test(hint)) return 'audio';
  return 'video';
}

async function reelGrab(url) {
  const response = await axios.post('https://grabsocial.org/api/download', { url }, { timeout: 35000, headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
  const data = response.data || {};
  if (!data?.success) throw new Error(data?.error?.message || 'ReelGrab returned no media');
  const links = Array.isArray(data.downloadLinks) ? data.downloadLinks.filter(x => isUsableMediaUrl(x?.url)) : [];
  if (!links.length) throw new Error('ReelGrab returned no download links');

  // Keep every usable media item. This is important for Instagram/Facebook
  // posts containing photos/slideshows instead of a single video.
  const media = links.map(link => ({ url: link.url, type: classifyDownloadLink(link) }));
  if (media.length > 1 || media[0]?.type === 'image') {
    return { media, title: data.title || 'Media', thumbnail: data.thumbnail };
  }
  const only = media[0];
  if (only.type === 'audio') return { audio: only.url, title: data.title || 'Audio' };
  return { video: only.url, title: data.title || 'Video', thumbnail: data.thumbnail };
}


function choosePreferredVideo(links) {
  const videos = links.filter(x => x?.type === 'video' && isUsableMediaUrl(x.url));
  if (!videos.length) return null;
  const scored = videos.map(x => {
    const text = `${x.quality || ''} ${x.format || ''}`;
    const m = text.match(/(\d{3,4})p/i);
    const height = m ? Number(m[1]) : null;
    return { ...x, height };
  });
  const under = scored.filter(x => Number.isFinite(x.height) && x.height <= 720).sort((a,b) => b.height-a.height);
  if (under.length) return under[0];
  const withHeight = scored.filter(x => Number.isFinite(x.height)).sort((a,b) => a.height-b.height);
  return withHeight[0] || videos[0];
}

async function fetchAllDlInfo(url) {
  const response = await request(`https://ahm7xmakki.com/api/alldl?url=${encodeURIComponent(url)}`, { timeout: 45_000 });
  const info = response.data?.mediaInfo;
  if (!response.data?.success || !info) throw new Error('AllDL returned no media');
  return info;
}

function normalizeQualityHeight(value) {
  const text = String(value || '');
  const m = text.match(/(?:^|\D)(\d{3,4})p(?:\D|$)/i);
  return m ? Number(m[1]) : null;
}

function allDlInfoToMedia(info) {
  const media = [];
  if (isUsableMediaUrl(info?.videoUrl)) media.push({ url: info.videoUrl, type: 'video', quality: 'source', height: normalizeQualityHeight(info.videoQuality) });
  if (isUsableMediaUrl(info?.audioUrl)) media.push({ url: info.audioUrl, type: 'audio', quality: 'audio' });
  for (const q of Array.isArray(info?.qualities) ? info.qualities : []) {
    if (isUsableMediaUrl(q?.url)) media.push({
      url: q.url,
      type: /audio|mp3|m4a|aac|ogg/i.test(`${q.quality || ''} ${q.format || ''}`) ? 'audio' : 'video',
      quality: q.quality || q.format || '',
      format: q.format || '',
      size: Number(q.size || q.filesize || q.fileSize || 0) || null,
      height: normalizeQualityHeight(q.quality || q.format)
    });
  }
  return [...new Map(media.map(x => [x.url, x])).values()];
}

async function allDl(url) {
  const info = await fetchAllDlInfo(url);
  const unique = allDlInfoToMedia(info);
  if (!unique.length) throw new Error('AllDL returned no usable links');
  const video = choosePreferredVideo(unique);
  const audio = unique.find(x => x.type === 'audio');
  if (video) return { video: video.url, title: info.title || 'Video', thumbnail: info.thumbnail, quality: video.quality };
  if (audio) return { audio: audio.url, title: info.title || 'Audio', thumbnail: info.thumbnail };
  throw new Error('AllDL returned no supported media');
}

async function allDlOptions(url) {
  const info = await fetchAllDlInfo(url);
  const unique = allDlInfoToMedia(info);
  const videos = unique
    .filter(x => x.type === 'video')
    .map(x => ({ ...x, height: x.height || normalizeQualityHeight(x.quality) }))
    .filter(x => x.height || x.quality === 'source');
  return {
    title: info.title || 'Video',
    thumbnail: info.thumbnail,
    audio: unique.find(x => x.type === 'audio') || null,
    videos
  };
}

async function contentLength(url) {
  try {
    const r = await axios.head(url, { timeout: 8000, maxRedirects: 5, headers: DEFAULT_HEADERS, validateStatus: s => s >= 200 && s < 400 });
    const n = Number(r.headers?.['content-length'] || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (_) { return null; }
}

async function mediaDownloadOptions(url) {
  try {
    const info = await allDlOptions(url);
    const videos = info.videos.slice();
    const lengths = await Promise.all(videos.slice(0, 8).map(x => x.size ? Promise.resolve(x.size) : contentLength(x.url)));
    videos.slice(0, lengths.length).forEach((x, i) => { if (!x.size && lengths[i]) x.size = lengths[i]; });
    const usable = videos.filter(x => isUsableMediaUrl(x.url));
    if (usable.length) return { type: 'video', title: info.title, thumbnail: info.thumbnail, options: usable };
    if (info.audio?.url) return { type: 'audio', title: info.title, audio: info.audio.url };
  } catch (_) {}

  try {
    const result = await reelGrab(url);
    if (result?.video) return { type: 'video', title: result.title || 'Video', options: [{ url: result.video, quality: result.quality || 'متاح', height: normalizeQualityHeight(result.quality) }] };
    if (result?.audio) return { type: 'audio', title: result.title || 'Audio', audio: result.audio };
    if (result?.media?.length) {
      const videos = result.media.filter(x => x.type === 'video');
      if (videos.length === 1) return { type: 'video', title: result.title || 'Video', options: [{ url: videos[0].url, quality: 'متاح' }] };
      if (result.media.every(x => x.type === 'image')) return { type: 'image', title: result.title || 'Images', media: result.media };
    }
  } catch (_) {}
  return null;
}

async function openGraphMedia(url) {
  const response = await request(url, { timeout: 25000, responseType: 'text', headers: { Accept: 'text/html,application/xhtml+xml' } });
  const $ = cheerio.load(String(response.data || ''));
  const media = [];
  const add = (value, type) => {
    if (!value) return;
    try { media.push({ url: new URL(value, url).toString(), type }); } catch (_) {}
  };
  $('meta[property="og:video:secure_url"], meta[property="og:video:url"], meta[property="og:video"]').each((_, el) => add($(el).attr('content'), 'video'));
  $('meta[name="twitter:player:stream"]').each((_, el) => add($(el).attr('content'), 'video'));
  $('meta[property="og:image"], meta[property="og:image:url"], meta[name="twitter:image"]').each((_, el) => add($(el).attr('content'), 'image'));
  const unique = [...new Map(media.map(x => [x.url, x])).values()].slice(0, 20);
  if (!unique.length) throw new Error('No public media exposed by page metadata');
  return { media: unique, title: $('meta[property="og:title"]').attr('content') || $('title').text().trim() || 'Media' };
}

async function xTwitter(url) {
  return withFallback([
    { name: 'ReelGrab', run: async () => reelGrab(url) },
    { name: 'AllDL', run: async () => allDl(url) },
    { name: 'OpenGraph', run: async () => openGraphMedia(url) },
  ], 'X/Twitter');
}

async function socialUniversal(url) {
  const host = new URL(url).hostname.toLowerCase();
  const providers = [];
  if (/pinterest\.com$|pin\.it$/i.test(host)) {
    providers.push({ name: 'ReelGrab', run: async () => reelGrab(url) });
    providers.push({ name: 'OpenGraph', run: async () => openGraphMedia(url) });
  } else if (/threads\.net$|threads\.com$/i.test(host)) {
    // Threads has no unauthenticated public downloader API we can depend on;
    // use public page metadata as a safe fallback for media exposed by the post.
    providers.push({ name: 'OpenGraph', run: async () => openGraphMedia(url) });
  } else {
    providers.push({ name: 'AllDL', run: async () => allDl(url) });
    providers.push({ name: 'ReelGrab', run: async () => reelGrab(url) });
    providers.push({ name: 'OpenGraph', run: async () => openGraphMedia(url) });
  }
  return withFallback(providers, `Universal media (${host})`);
}

async function youtubeLocal(url) {
  if (!distubeYtdl) throw new Error('Local YouTube downloader unavailable');
  const info = await distubeYtdl.getInfo(url);
  const formats = info.formats.filter(f => f.hasVideo && f.hasAudio && f.container === 'mp4');
  if (!formats.length) throw new Error('No compatible YouTube MP4 format');
  const scored = formats.map(f => ({ f, h: Number(f.height || 0) })).sort((a,b) => {
    const aOver = a.h > 720, bOver = b.h > 720;
    if (aOver !== bOver) return aOver ? 1 : -1;
    return Math.abs((a.h || 720) - 720) - Math.abs((b.h || 720) - 720);
  });
  const f = scored[0].f;
  return { video: f.url, title: info.videoDetails?.title || 'YouTube Video', thumbnail: info.videoDetails?.thumbnails?.slice(-1)?.[0]?.url, quality: f.qualityLabel };
}

async function youtubeAudio(url) {
  return withFallback([
    { name: 'EliteProTech', run: async () => { const r=(await request(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`)).data; return r?.success&&r?.downloadURL ? {download:r.downloadURL,title:r.title} : null; } },
    { name: 'Yupra', run: async () => { const r=(await request(`https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`)).data; return r?.success&&r?.data?.download_url ? {download:r.data.download_url,title:r.data.title,thumbnail:r.data.thumbnail} : null; } },
    { name: 'Okatsu', run: async () => { const r=(await request(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`)).data; return r?.dl ? {download:r.dl,title:r.title,thumbnail:r.thumb} : null; } },
    { name: 'Keith', run: async () => { const r=(await request(`https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`)).data; return r?.status&&r?.result?.downloadUrl ? {download:r.result.downloadUrl,title:r.result.title} : null; } },
    { name: 'AllDL', run: async () => allDl(url) },
    { name: 'ReelGrab', run: async () => reelGrab(url) },
  ], 'YouTube audio');
}

async function youtubeVideo(url) {
  return withFallback([
    { name: 'EliteProTech', run: async () => { const r=(await request(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`)).data; return r?.success&&r?.downloadURL ? {download:r.downloadURL,title:r.title} : null; } },
    { name: 'Yupra', run: async () => { const r=(await request(`https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`)).data; return r?.success&&r?.data?.download_url ? {download:r.data.download_url,title:r.data.title,thumbnail:r.data.thumbnail} : null; } },
    { name: 'Okatsu', run: async () => { const r=(await request(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`)).data; return r?.result?.mp4 ? {download:r.result.mp4,title:r.result.title} : null; } },
    { name: 'AllDL', run: async () => allDl(url) },
    { name: 'LocalYTDL', run: async () => youtubeLocal(url) },
    { name: 'ReelGrab', run: async () => reelGrab(url) },
  ], 'YouTube video');
}


function collectMediaUrls(value, out = [], seen = new Set()) {
  if (value == null || out.length >= 20) return out;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && /\.(mp4|webm|mov|m4v|jpg|jpeg|png|webp|mp3|m4a|aac|ogg)(\?|$)/i.test(value)) out.push(value);
    return out;
  }
  if (typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  if (Array.isArray(value)) { for (const item of value) collectMediaUrls(item, out, seen); return out; }
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && /^(url|download|download_url|downloadUrl|video|video_url|videoUrl|audio|audio_url|audioUrl|hd|sd|play|playUrl)$/i.test(key) && /^https?:\/\//i.test(item)) {
      out.push(item);
    } else {
      collectMediaUrls(item, out, seen);
    }
    if (out.length >= 20) break;
  }
  return [...new Set(out)].slice(0, 20);
}

async function tiktok(url) {
  return withFallback([
    { name: 'Siputzx', run: async () => { const r=(await request(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`,{timeout:30000})).data; const d=r?.data; const video=d?.urls?.[0]||d?.video_url||d?.url||d?.download_url; return r?.status&&video ? {video:video,title:d?.metadata?.title||'TikTok Video'} : null; } },
    { name: 'RuhendScraper', run: async () => { const r=await ttdl(url); const data=(r?.data||[]).filter(x=>x?.url); return data.length ? {media:data.map(x=>({url:x.url,type:x.type}))} : null; } },
    { name: 'BTCH', run: async () => { if (!btch?.ttdl) return null; const r=await btch.ttdl(url); const urls=collectMediaUrls(r); return urls.length ? {video:urls[0],media:urls.map(x=>({url:x,type:'video'})),title:r?.title||r?.data?.title||'TikTok Video'} : null; } },
    { name: 'AllDL', run: async () => allDl(url) },
    { name: 'ReelGrab', run: async () => reelGrab(url) }
  ], 'TikTok');
}

async function instagram(url) {
  return withFallback([
    { name: 'RuhendScraper', run: async () => { const r=await igdl(url); const data=(r?.data||[]).filter(x=>x?.url); if (!data.length) throw new Error('No Instagram media found'); return { media:data, provider:'RuhendScraper' }; } },
    { name: 'BTCH', run: async () => { if (!btch?.igdl) return null; const r=await btch.igdl(url); const urls=collectMediaUrls(r); return urls.length ? {media:urls.map(x=>({url:x,type:/\.(mp4|mov|webm)(\?|$)/i.test(x)?'video':'image'})),title:r?.title||r?.data?.title||'Instagram'} : null; } },
    { name: 'AllDL', run: async () => allDl(url) },
    { name: 'ReelGrab', run: async () => reelGrab(url) }
  ], 'Instagram');
}

async function facebook(url) {
  return withFallback([
    { name: 'Hanggts', run: async () => { const api=`https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(url)}`; const data=(await request(api,{timeout:30000})).data; let media=data?.result?.media?.video_hd||data?.result?.media?.video_sd||data?.result?.url||data?.result?.download||data?.result?.video||data?.data?.url||data?.data?.download||data?.data?.video||data?.url||data?.download||data?.video; if(typeof media==='object'&&media?.url) media=media.url; if(!media) throw new Error('No Facebook video found'); return {video:media,title:data?.result?.info?.title||data?.result?.title||data?.title||'Facebook Video'}; } },
    { name: 'BTCH', run: async () => { if (!btch?.fbdown) return null; const r=await btch.fbdown(url); const urls=collectMediaUrls(r); return urls.length ? {video:urls[0],title:r?.title||r?.data?.title||'Facebook Video'} : null; } },
    { name: 'AllDL', run: async () => allDl(url) },
    { name: 'ReelGrab', run: async () => reelGrab(url) }
  ], 'Facebook');
}

async function spotify(query) {
  return withFallback([
    { name: 'Okatsu', run: async () => { const data=(await request(`https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(query)}`,{timeout:30000})).data; const r=data?.result; if(!data?.status||!r?.audio) throw new Error('No Spotify audio found'); return {audio:r.audio,title:r.title||r.name||'Track',artist:r.artist||'',duration:r.duration||'',url:r.url||'',thumbnail:r.thumbnails}; } },
    { name: 'BTCH', run: async () => { if (!btch?.spotify) return null; const r=await btch.spotify(query); const urls=collectMediaUrls(r); const audio=urls.find(x=>/\.(mp3|m4a|aac|ogg)(\?|$)/i.test(x))||urls[0]; return audio ? {audio,title:r?.title||r?.data?.title||'أغنية',artist:r?.artist||r?.data?.artist||'',duration:r?.duration||r?.data?.duration||'',thumbnail:r?.thumbnail||r?.data?.thumbnail} : null; } }
  ], 'Spotify');
}

async function fetchMedia(url, options={}) {
  const response=await request(url,{...options,responseType:'arraybuffer'});
  return Buffer.from(response.data);
}

module.exports = { youtubeAudio, youtubeVideo, tiktok, instagram, facebook, spotify, fetchMedia, withFallback, validateFallbackResult, validateDownloadableResult, health, allDl, allDlOptions, mediaDownloadOptions, xTwitter, socialUniversal };
