const axios = require('axios');
const { ttdl, igdl } = require('ruhend-scraper');
const health = require('../core/health');
const { normalizeMediaResult } = require('../core/normalize');
const telemetry = require('../core/telemetry');
let btch = null;
try { btch = require('btch-downloader'); } catch { btch = null; }

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


async function withFallback(providers, label, options = {}) {
  const errors = [];
  const errorDetails = [];
  const validate = typeof options.validate === 'function' ? options.validate : validateFallbackResult;
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


async function reelGrab(url) {
  const response = await axios.post('https://grabsocial.org/api/download', { url }, { timeout: 35000, headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
  const data = response.data || {};
  if (!data?.success) throw new Error(data?.error?.message || 'ReelGrab returned no media');
  const links = Array.isArray(data.downloadLinks) ? data.downloadLinks.filter(x => isUsableMediaUrl(x?.url)) : [];
  if (!links.length) throw new Error('ReelGrab returned no download links');
  const audio = links.find(x => /mp3|audio/i.test(`${x.format || ''} ${x.quality || ''}`));
  const video = links.find(x => /mp4|video/i.test(`${x.format || ''} ${x.quality || ''}`)) || links[0];
  return audio && !video ? { audio: audio.url, title: data.title || 'Audio' } : { video: video.url, title: data.title || 'Video', thumbnail: data.thumbnail };
}

async function youtubeAudio(url) {
  return withFallback([
    { name: 'EliteProTech', run: async () => { const r=(await request(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`)).data; return r?.success&&r?.downloadURL ? {download:r.downloadURL,title:r.title} : null; } },
    { name: 'Yupra', run: async () => { const r=(await request(`https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`)).data; return r?.success&&r?.data?.download_url ? {download:r.data.download_url,title:r.data.title,thumbnail:r.data.thumbnail} : null; } },
    { name: 'Okatsu', run: async () => { const r=(await request(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`)).data; return r?.dl ? {download:r.dl,title:r.title,thumbnail:r.thumb} : null; } },
    { name: 'Keith', run: async () => { const r=(await request(`https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`)).data; return r?.status&&r?.result?.downloadUrl ? {download:r.result.downloadUrl,title:r.result.title} : null; } },
    { name: 'ReelGrab', run: async () => reelGrab(url) },
  ], 'YouTube audio');
}

async function youtubeVideo(url) {
  return withFallback([
    { name: 'EliteProTech', run: async () => { const r=(await request(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`)).data; return r?.success&&r?.downloadURL ? {download:r.downloadURL,title:r.title} : null; } },
    { name: 'Yupra', run: async () => { const r=(await request(`https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`)).data; return r?.success&&r?.data?.download_url ? {download:r.data.download_url,title:r.data.title,thumbnail:r.data.thumbnail} : null; } },
    { name: 'Okatsu', run: async () => { const r=(await request(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`)).data; return r?.result?.mp4 ? {download:r.result.mp4,title:r.result.title} : null; } },
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
    { name: 'ReelGrab', run: async () => reelGrab(url) }
  ], 'TikTok');
}

async function instagram(url) {
  return withFallback([
    { name: 'RuhendScraper', run: async () => { const r=await igdl(url); const data=(r?.data||[]).filter(x=>x?.url); if (!data.length) throw new Error('No Instagram media found'); return { media:data, provider:'RuhendScraper' }; } },
    { name: 'BTCH', run: async () => { if (!btch?.igdl) return null; const r=await btch.igdl(url); const urls=collectMediaUrls(r); return urls.length ? {media:urls.map(x=>({url:x,type:/\.(mp4|mov|webm)(\?|$)/i.test(x)?'video':'image'})),title:r?.title||r?.data?.title||'Instagram'} : null; } },
    { name: 'ReelGrab', run: async () => reelGrab(url) }
  ], 'Instagram');
}

async function facebook(url) {
  return withFallback([
    { name: 'Hanggts', run: async () => { const api=`https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(url)}`; const data=(await request(api,{timeout:30000})).data; let media=data?.result?.media?.video_hd||data?.result?.media?.video_sd||data?.result?.url||data?.result?.download||data?.result?.video||data?.data?.url||data?.data?.download||data?.data?.video||data?.url||data?.download||data?.video; if(typeof media==='object'&&media?.url) media=media.url; if(!media) throw new Error('No Facebook video found'); return {video:media,title:data?.result?.info?.title||data?.result?.title||data?.title||'Facebook Video'}; } },
    { name: 'BTCH', run: async () => { if (!btch?.fbdown) return null; const r=await btch.fbdown(url); const urls=collectMediaUrls(r); return urls.length ? {video:urls[0],title:r?.title||r?.data?.title||'Facebook Video'} : null; } },
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

module.exports = { youtubeAudio, youtubeVideo, tiktok, instagram, facebook, spotify, fetchMedia, withFallback, validateFallbackResult, health };
