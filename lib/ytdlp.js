'use strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { assertPublicHttpUrl } = require('./url-security');

const execFileAsync = promisify(execFile);
const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';
const TMP_ROOT = path.join(os.tmpdir(), 'leobot-ytdlp');
const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const COOKIE_FILE = path.join(TMP_ROOT, 'cookies.txt');
fs.ensureDirSync(TMP_ROOT);

async function getCookieFile() {
  const b64 = String(process.env.YTDLP_COOKIES_B64 || '').trim();
  const raw = process.env.YTDLP_COOKIES;
  if (!b64 && !raw) return null;
  try {
    const content = b64 ? Buffer.from(b64, 'base64').toString('utf8') : String(raw);
    if (!content.includes('# Netscape HTTP Cookie File') && !content.includes('\t')) {
      throw new Error('YTDLP_COOKIES must be a Netscape cookie file');
    }
    await fs.writeFile(COOKIE_FILE, content, { mode: 0o600 });
    return COOKIE_FILE;
  } catch (error) {
    throw new Error(`yt-dlp cookies invalid: ${error.message}`);
  }
}


function cookieHeaderFromContent(content) {
  return String(content || '').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const parts = line.split('\t');
    if (parts.length >= 7) return `${parts[5]}=${parts[6]}`;
    return '';
  }).filter(Boolean).join('; ');
}

async function getCookieHeader() {
  const b64 = String(process.env.YTDLP_COOKIES_B64 || '').trim();
  const raw = process.env.YTDLP_COOKIES;
  if (!b64 && !raw) return '';
  try {
    const content = b64 ? Buffer.from(b64, 'base64').toString('utf8') : String(raw);
    return cookieHeaderFromContent(content);
  } catch {
    return '';
  }
}

async function resolveUrl(rawUrl) {
  const original = String(rawUrl);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const cookieHeader = await getCookieHeader();
      const response = await fetch(original, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
          'accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          ...(cookieHeader ? { cookie: cookieHeader } : {})
        },
        signal: controller.signal
      });
      const finalUrl = response.url || original;
      const final = new URL(finalUrl);
      const pathLower = final.pathname.toLowerCase();
      const host = final.hostname.toLowerCase();
      const looksGeneric =
        (host === 'facebook.com' || host.endsWith('.facebook.com')) && (pathLower === '/' || pathLower.startsWith('/login')) ||
        (host === 'tiktok.com' || host.endsWith('.tiktok.com')) && pathLower === '/' ||
        (host === 'pinterest.com' || host.endsWith('.pinterest.com')) && pathLower === '/';
      if (!looksGeneric && finalUrl !== original) return finalUrl;
      return original;
    } finally { clearTimeout(timer); }
  } catch {
    return original;
  }
}

async function commonArgs(options = {}) {
  const cookieFile = await getCookieFile();
  return [
    '--no-warnings', '--no-update', '--ignore-config', '--js-runtimes', 'node',
    ...(cookieFile ? ['--cookies', cookieFile] : []),
    ...extractorArgs(options.extractorApi)
  ];
}

function safeName(value, fallback = 'media') {
  const out = String(value || '').replace(/[\\/:*?"<>|\x00-\x1F]/g, '').trim().slice(0, 90);
  return out || fallback;
}

function isTwitterUrl(url) {
  try { return /(^|\.)((x|twitter)\.com)$/i.test(new URL(url).hostname); } catch { return false; }
}

function twitterApiAttempts(url) {
  return isTwitterUrl(url) ? ['graphql', 'syndication', 'legacy'] : [null];
}

function extractorArgs(api) {
  return api ? ['--extractor-args', `twitter:api=${api}`] : [];
}

function durationSeconds(info) {
  const n = Number(info?.duration);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function bytesForFormat(format, duration = 0) {
  const direct = Number(format?.filesize || format?.filesize_approx);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const tbr = Number(format?.tbr || 0);
  if (duration > 0 && tbr > 0) return duration * tbr * 1000 / 8;
  const abr = Number(format?.abr || 0);
  if (duration > 0 && abr > 0) return duration * abr * 1000 / 8;
  return 0;
}

function isVideoFormat(f) {
  return f && f.vcodec && f.vcodec !== 'none' && Number(f.height || 0) > 0;
}
function isAudioFormat(f) {
  return f && f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none');
}

function formatPreference(f) {
  let score = 0;
  if (String(f.ext).toLowerCase() === 'mp4') score += 30;
  if (String(f.vcodec).startsWith('avc1')) score += 25;
  if (String(f.acodec).startsWith('mp4a')) score += 20;
  score += Number(f.fps || 0) / 100;
  score += Number(f.tbr || 0) / 10000;
  return score;
}

function pickAudio(formats) {
  return formats.filter(isAudioFormat).sort((a, b) => {
    const ac = String(a.acodec || '').startsWith('mp4a') ? 1 : 0;
    const bc = String(b.acodec || '').startsWith('mp4a') ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return Number(b.abr || b.tbr || 0) - Number(a.abr || a.tbr || 0);
  })[0] || null;
}

function buildVideoOptions(info) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const videos = formats.filter(isVideoFormat);
  if (!videos.length) return [];

  const audio = pickAudio(formats);
  const heights = [...new Set(videos.map(f => Number(f.height)).filter(h => h > 0))].sort((a, b) => a - b);
  const preferredHeights = [360, 480, 720, 1080, 1440, 2160];
  const selectedHeights = preferredHeights.filter(h => heights.some(x => x === h));
  // If the site exposes unusual heights, keep the closest useful real values.
  for (const h of heights) {
    if (selectedHeights.length >= 6) break;
    if (!selectedHeights.includes(h)) selectedHeights.push(h);
  }

  return selectedHeights.map(height => {
    const candidates = videos.filter(f => Number(f.height) === height);
    const video = candidates.sort((a, b) => formatPreference(b) - formatPreference(a))[0];
    const selector = `bestvideo[height=${height}]+bestaudio/best[height=${height}]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
    const videoBytes = bytesForFormat(video, durationSeconds(info));
    const audioBytes = audio ? bytesForFormat(audio, durationSeconds(info)) : 0;
    const size = videoBytes + audioBytes;
    return {
      engine: 'yt-dlp',
      height,
      quality: `${height}p`,
      selector,
      size: size > 0 ? Math.round(size) : null,
      sourceFormat: video.format_id,
      ext: 'mp4'
    };
  }).sort((a, b) => a.height - b.height);
}

function classifyInfo(info) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const videos = formats.filter(isVideoFormat);
  const audios = formats.filter(isAudioFormat);
  const ext = String(info?.ext || '').toLowerCase();
  if (videos.length || ['mp4', 'webm', 'mov', 'm4v', 'mkv'].includes(ext)) return 'video';
  if (audios.length || ['mp3', 'm4a', 'aac', 'opus', 'ogg', 'wav', 'flac'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) return 'image';
  return 'unknown';
}

async function probe(url) {
  await assertPublicHttpUrl(url);
  url = await resolveUrl(url);
  await assertPublicHttpUrl(url);
  let lastMessage = 'yt-dlp probe failed';
  for (const api of twitterApiAttempts(url)) {
    try {
      const common = await commonArgs({ extractorApi: api });
      const { stdout } = await execFileAsync(YTDLP_BIN, [
        '--dump-single-json',
        '--no-playlist',
        '--skip-download',
        ...common,
        url
      ], { timeout: 90_000, maxBuffer: 12 * 1024 * 1024, windowsHide: true });
      const info = JSON.parse(stdout.trim().split('\n').filter(Boolean).pop());
      const type = classifyInfo(info);
      if (type === 'video') {
        return { type, title: info.title || 'Video', duration: durationSeconds(info), thumbnail: info.thumbnail, options: buildVideoOptions(info), raw: info, extractorApi: api, resolvedUrl: url };
      }
      if (type === 'audio') return { type, title: info.title || 'Audio', duration: durationSeconds(info), raw: info, extractorApi: api, resolvedUrl: url };
      if (type === 'image') return { type, title: info.title || 'Image', raw: info, extractorApi: api, resolvedUrl: url };
      lastMessage = 'yt-dlp لم يتعرف على نوع الوسائط.';
    } catch (error) {
      const stderr = error?.stderr ? String(error.stderr).trim() : '';
      lastMessage = stderr || error?.message || lastMessage;
    }
  }
  throw new Error(`yt-dlp probe failed: ${String(lastMessage).slice(-1600)}`);
}

async function download(url, selector, options = {}) {
  await assertPublicHttpUrl(url);
  url = await resolveUrl(url);
  await assertPublicHttpUrl(url);
  const jobDir = await fs.mkdtemp(path.join(TMP_ROOT, 'job-'));
  const title = safeName(options.title, 'media');
  const outputTemplate = path.join(jobDir, `${title}.%(ext)s`);
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-update',
    '--ignore-config',
    '--js-runtimes', 'node',
    '--restrict-filenames',
    '--max-filesize', '2G',
    ...extractorArgs(options.extractorApi),
    '-f', selector || 'bestvideo*+bestaudio/best',
    '--merge-output-format', 'mp4',
    '-o', outputTemplate,
    url
  ];
  try {
    await execFileAsync(YTDLP_BIN, args, { timeout: 240_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    const files = (await fs.readdir(jobDir)).filter(name => !name.endsWith('.part') && !name.endsWith('.ytdl'));
    if (!files.length) throw new Error('yt-dlp لم ينتج ملفًا.');
    const filePath = path.join(jobDir, files.sort((a, b) => fs.statSync(path.join(jobDir, b)).size - fs.statSync(path.join(jobDir, a)).size)[0]);
    const stat = await fs.stat(filePath);
    if (stat.size <= 0 || stat.size > MAX_BYTES) throw new Error('حجم الملف غير صالح أو يتجاوز الحد المسموح.');
    return { path: filePath, dir: jobDir, title, size: stat.size };
  } catch (error) {
    await fs.remove(jobDir).catch(() => {});
    const stderr = error?.stderr ? String(error.stderr).trim() : '';
    const message = stderr || error?.message || 'yt-dlp download failed';
    throw new Error(`yt-dlp download failed: ${message.slice(-1800)}`);
  }
}

async function downloadAudio(url, title = 'audio', options = {}) {
  await assertPublicHttpUrl(url);
  url = await resolveUrl(url);
  await assertPublicHttpUrl(url);
  const jobDir = await fs.mkdtemp(path.join(TMP_ROOT, 'audio-'));
  const outputTemplate = path.join(jobDir, `${safeName(title, 'audio')}.%(ext)s`);
  try {
    await execFileAsync(YTDLP_BIN, [
      '--no-playlist', ...(await commonArgs(options)),
      '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '-o', outputTemplate, url
    ], { timeout: 240_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    const files = (await fs.readdir(jobDir)).filter(n => /\.mp3$/i.test(n));
    if (!files.length) throw new Error('yt-dlp لم ينتج ملف صوت.');
    return { path: path.join(jobDir, files[0]), dir: jobDir, title: safeName(title, 'audio') };
  } catch (error) {
    await fs.remove(jobDir).catch(() => {});
    const stderr = error?.stderr ? String(error.stderr).trim() : '';
    throw new Error(`yt-dlp audio failed: ${(stderr || error?.message || 'unknown error').slice(-1600)}`);
  }
}

async function downloadBestImage(url, title = 'image', options = {}) {
  await assertPublicHttpUrl(url);
  url = await resolveUrl(url);
  await assertPublicHttpUrl(url);
  const jobDir = await fs.mkdtemp(path.join(TMP_ROOT, 'image-'));
  const outputTemplate = path.join(jobDir, `${safeName(title, 'image')}.%(ext)s`);
  try {
    await execFileAsync(YTDLP_BIN, [
      '--no-playlist', ...(await commonArgs(options)),
      '-f', 'best', '-o', outputTemplate, url
    ], { timeout: 180_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    const files = await fs.readdir(jobDir);
    if (!files.length) throw new Error('yt-dlp لم ينتج صورة.');
    return { path: path.join(jobDir, files[0]), dir: jobDir, title: safeName(title, 'image') };
  } catch (error) {
    await fs.remove(jobDir).catch(() => {});
    const stderr = error?.stderr ? String(error.stderr).trim() : '';
    throw new Error(`yt-dlp image failed: ${(stderr || error?.message || 'unknown error').slice(-1600)}`);
  }
}

async function cleanupJob(job) {
  if (job?.dir) await fs.remove(job.dir).catch(() => {});
}

module.exports = { probe, download, downloadAudio, downloadBestImage, cleanupJob, buildVideoOptions, classifyInfo, resolveUrl };
