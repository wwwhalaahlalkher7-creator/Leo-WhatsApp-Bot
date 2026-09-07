const axios = require('axios');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { t } = require('../lib/i18n');
const fileType = require('file-type');
const cheerio = require('cheerio');

const API_BASE = 'https://bk9.fun';
const MAX_RESULTS = 5;
const SESSION_TTL_MS = 10 * 60_000;
const MAX_APK_BYTES = 2 * 1024 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const APK_ZIP_THRESHOLD_BYTES = 50 * 1024 * 1024;
const sessions = new Map();

function sessionKey(chatId, context = {}) {
  return `${chatId}:${context.senderId || context.senderIdAlt || 'unknown'}`;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [key, session] of sessions) if (session.expiresAt <= now) sessions.delete(key);
}
setInterval(cleanupSessions, 60_000).unref();

function textValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeResult(item, index) {
  const meta = item?.metadata || item?.details || item?.info || item?.app || item;
  const source = textValue(item?.source, item?.site, item?.provider, item?.host, item?.website, 'BK9');
  const name = textValue(item?.name, item?.title, item?.appName, item?.app_name, meta?.name, meta?.title, 'Unknown App');
  const version = textValue(item?.version, item?.ver, item?.appVersion, item?.release, meta?.version, meta?.ver, meta?.appVersion);
  const size = textValue(item?.size, item?.fileSize, item?.filesize, item?.apkSize, meta?.size, meta?.fileSize, meta?.filesize);
  const image = textValue(item?.image, item?.imageUrl, item?.icon, item?.iconUrl, item?.thumbnail, item?.thumb, meta?.icon, meta?.thumbnail);
  const id = textValue(item?.id, item?.appId, item?.app_id, item?.urlId, meta?.id, meta?.package_name, meta?.packageName);
  const directUrl = textValue(item?.downloadUrl, item?.dllink, item?.download, item?.url, meta?.downloadUrl, meta?.download);
  return { index: index + 1, id, name, source, version: version || 'غير معروف', size: size || 'غير معروف', image, directUrl };
}

function extractResults(data) {
  const candidates = data?.BK9 || data?.results || data?.data || data;
  if (Array.isArray(candidates)) return candidates;
  if (Array.isArray(candidates?.results)) return candidates.results;
  if (Array.isArray(candidates?.data)) return candidates.data;
  return [];
}

function isHttpUrl(value) { return /^https?:\/\//i.test(String(value || '')); }
function looksLikeApkUrl(value) { return /\.apk(?:$|[?#])/i.test(String(value || '')); }
function safeName(name) {
  return String(name || 'LeoBot-App').replace(/[^\p{L}\p{N}._ -]/gu, '').trim().slice(0, 80) || 'LeoBot-App';
}
function parseSelection(args) {
  const value = String(args?.join(' ') || '').trim();
  const match = /^(?:download|تحميل|تنزيل)?\s*(\d+)$/i.exec(value);
  return match ? Number(match[1]) : null;
}
function isCancel(args) { return /^(cancel|الغاء|إلغاء)$/i.test(String(args?.join(' ') || '').trim()); }

async function resolveApkComboDownload(pageUrl) {
  const common = {
    timeout: 30_000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
      'Accept-Language': 'ar,en;q=0.8',
      Referer: pageUrl,
      Origin: 'https://apkcombo.com'
    }
  };

  // APKCombo currently uses a /checkin token for variant links. The token is
  // deliberately requested immediately before parsing the download page.
  let checkin = '';
  try {
    const check = await axios.post('https://apkcombo.com/checkin', null, common);
    checkin = String(check.data || '').trim().replace(/^\?/, '');
  } catch (error) {
    console.warn('[APK] APKCombo checkin unavailable:', error.message);
  }

  const page = await axios.get(pageUrl, common);
  const $ = cheerio.load(page.data || '');
  const hrefs = $('a[href]').map((_, el) => String($(el).attr('href') || '').trim()).get();

  const direct = hrefs.find(h => /\/r2\?u=/i.test(h));
  if (direct) {
    try {
      const parsed = new URL(direct.startsWith('http') ? direct : new URL(direct, pageUrl).href);
      const encoded = parsed.searchParams.get('u');
      if (encoded) return decodeURIComponent(encoded);
    } catch {}
  }

  const variants = hrefs.filter(h => /(?:\.apk|\.xapk|\.apks)(?:$|[?#])/i.test(h) || /\/download\//i.test(h));
  if (variants.length && checkin) {
    for (const href of variants) {
      const absolute = href.startsWith('http') ? href : new URL(href, pageUrl).href;
      const candidate = absolute.includes('?') ? `${absolute}&${checkin}` : `${absolute}?${checkin}`;
      try {
        const head = await axios.head(candidate, { ...common, timeout: 20_000, validateStatus: s => s >= 200 && s < 400 });
        const type = String(head.headers?.['content-type'] || '').toLowerCase();
        const location = head.headers?.location;
        if (location && isHttpUrl(location)) return location;
        if (type.includes('android') || type.includes('zip') || type.includes('octet-stream') || /\.(?:apk|xapk|apks)(?:$|[?#])/i.test(candidate)) return candidate;
      } catch {}
    }
  }

  const xidMatch = String(page.data || '').match(/(?:xid|download_id|file_id)\s*[:=]\s*["']([^"']+)["']/i);
  if (xidMatch?.[1]) {
    try {
      const dl = await axios.post(`https://apkcombo.com/${encodeURIComponent(xidMatch[1])}/dl`, null, common);
      const body = typeof dl.data === 'string' ? dl.data : JSON.stringify(dl.data || {});
      const match = body.match(/https?:\\?\/\\?\/[^"'\\s<>]+\.(?:apk|xapk|apks)(?:\?[^"'\\s<>]*)?/i);
      if (match && isHttpUrl(match[0])) return match[0].replace(/\\\//g, '/');
    } catch (error) {
      console.warn('[APK] APKCombo xid download unavailable:', error.message);
    }
  }

  throw new Error('APKCombo direct download link not found');
}

async function resolveDownloadUrl(result) {
  if (!isHttpUrl(result.directUrl)) {
    if (!result.id) return null;
    const response = await axios.get(`${API_BASE}/download/apk`, { params: { id: result.id }, timeout: 30_000 });
    const data = response.data;
    return textValue(data?.BK9?.dllink, data?.result?.dllink, data?.data?.dllink, data?.dllink, data?.url);
  }

  const direct = result.directUrl;
  const host = new URL(direct).hostname.toLowerCase();
  if (/(?:^|\.)apkcombo\.com$/i.test(host) && /\/download\//i.test(new URL(direct).pathname)) {
    return resolveApkComboDownload(direct);
  }

  const isStorePage = /(?:apkpure\.net)$/i.test(host) || /\.apkcombo\.com$/i.test(host);
  if (!isStorePage) return direct;

  const page = await axios.get(direct, {
    timeout: 30_000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', 'Accept-Language': 'ar,en;q=0.8' }
  });
  const $ = cheerio.load(page.data || '');
  const hrefs = $('a[href]').map((_, el) => String($(el).attr('href') || '').trim()).get();
  const directFile = hrefs.find(h => /(?:\.apk|\.xapk|\.apks)(?:$|[?#])/i.test(h));
  if (directFile) return directFile.startsWith('http') ? directFile : new URL(directFile, direct).href;
  const downloadHref = hrefs.find(h => /download/i.test(h) && !/^javascript:/i.test(h));
  if (downloadHref) return downloadHref.startsWith('http') ? downloadHref : new URL(downloadHref, direct).href;
  throw new Error('APK download link not found');
}
async function sendSearchResults(sock, chatId, message, results) {
  await sock.sendMessage(chatId, { text: t('commands.apk.resultsTitle', '🔎 نتائج البحث عن APK:') }, { quoted: message });
  for (const item of results) {
    const caption = [
      `${item.index}️⃣ ${item.name}`,
      `📦 الحجم: ${item.size}`,
      `🏷️ الإصدار: ${item.version}`,
      `🌐 المصدر: ${item.source}`,
      '',
      t('commands.apk.chooseItem', 'اكتب `.تطبيق {number}` لاختيار هذا التطبيق.', { number: item.index })
    ].join('\n');
    if (isHttpUrl(item.image)) {
      try {
        await sock.sendMessage(chatId, { image: { url: item.image }, caption }, { quoted: message });
        continue;
      } catch (error) {
        console.warn('[APK] Result image failed:', error.message);
      }
    }
    await sock.sendMessage(chatId, { text: caption }, { quoted: message });
  }
  await sock.sendMessage(chatId, {
    text: `${t('commands.apk.choose', '📌 اختر رقمًا باستخدام `.تطبيق <الرقم>` أو `.تطبيق تحميل <الرقم>`.')}\n${t('commands.apk.expiry', '⏳ النتائج صالحة لمدة 10 دقائق.')}`
  }, { quoted: message });
}

async function downloadAndSend(sock, chatId, message, result) {
  const url = await resolveDownloadUrl(result);
  if (!isHttpUrl(url)) throw new Error('No APK download URL');

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxRedirects: 8,
    maxContentLength: MAX_APK_BYTES,
    maxBodyLength: MAX_APK_BYTES,
    validateStatus: status => status >= 200 && status < 300
  });

  const contentType = String(response.headers['content-type'] || '').toLowerCase();
  const contentLength = Number(response.headers['content-length'] || 0);
  if (contentLength > MAX_APK_BYTES) throw new Error('APK exceeds size limit');
  if (contentType && !contentType.includes('android.package') && !contentType.includes('application/zip') && !contentType.includes('octet-stream') && !contentType.includes('xapk') && !contentType.includes('apks')) {
    if (!looksLikeApkUrl(url) && !/\.(?:xapk|apks)(?:$|[?#])/i.test(url)) throw new Error(`Unexpected content type: ${contentType}`);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'leobot-apk-'));
  const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}.package`);
  let total = 0;
  try {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmpPath);
      response.data.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_APK_BYTES) {
          response.data.destroy(new Error('APK exceeds size limit'));
          out.destroy();
          reject(new Error('APK exceeds size limit'));
        }
      });
      response.data.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      response.data.pipe(out);
    });

    if (total <= 0) throw new Error('Empty APK');
    const detected = await fileType.fromFile(tmpPath).catch(() => null);
    const contentTypeLower = String(response.headers['content-type'] || '').toLowerCase();
    const urlLower = String(url).toLowerCase();
    const isXapk = contentTypeLower.includes('xapk') || /\.xapk(?:$|[?#])/i.test(urlLower) || /xapk-package-archive/i.test(contentTypeLower);
    const isApks = contentTypeLower.includes('apks') || /\.apks(?:$|[?#])/i.test(urlLower);
    const isZipLike = detected?.mime === 'application/zip' || detected?.ext === 'zip' || isXapk || isApks;
    const isApk = detected?.ext === 'apk' || contentTypeLower.includes('android.package');
    if (!isApk && !isZipLike) throw new Error(`Downloaded file is not an APK/XAPK/APKS: ${detected?.mime || contentTypeLower || 'unknown'}`);
    const finalSize = (await fs.stat(tmpPath)).size;
    const baseName = safeName(result.name);
    const packageExt = isXapk ? 'xapk' : isApks ? 'apks' : 'apk';
    const packageMime = isXapk ? 'application/xapk-package-archive' : isApks ? 'application/octet-stream' : 'application/vnd.android.package-archive';
    if (finalSize <= APK_ZIP_THRESHOLD_BYTES || packageExt !== 'apk') {
      await sock.sendMessage(chatId, {
        document: fs.createReadStream(tmpPath),
        mimetype: packageMime,
        fileName: `${baseName}.${packageExt}`,
        caption: t('commands.apk.caption', '', { name: result.name, version: result.version, source: result.source })
      }, { quoted: message });
    } else {
      const zipPath = path.join(tmpDir, `${baseName}-${crypto.randomUUID()}.zip`);
      await execFileAsync('zip', ['-9', '-q', zipPath, path.basename(tmpPath)], { cwd: tmpDir, timeout: 120_000 });
      await execFileAsync('unzip', ['-t', zipPath], { cwd: tmpDir, timeout: 60_000 });
      await sock.sendMessage(chatId, {
        document: fs.createReadStream(zipPath),
        mimetype: 'application/zip',
        fileName: `${baseName}.zip`,
        caption: `📦 ${t('commands.apk.caption', '', { name: result.name, version: result.version, source: result.source })}\n🗜️ تم ضغط ملف التثبيت لأن حجمه تجاوز 50MB. ملف APK الأصلي محفوظ داخل ZIP دون تعديل.`
      }, { quoted: message });
    }
  } finally {
    await fs.remove(tmpDir).catch(() => {});
  }
}


function slugifySearch(query) {
  return String(query || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function isApkComboAppPath(href) {
  return /^\/ar\/[^/]+\/[^/]+\/?$/i.test(href) || /^\/[^/]+\/[^/]+\/?$/i.test(href);
}

async function enrichApkComboResult(result) {
  if (!result?.directUrl) return result;
  try {
    const res = await axios.get(result.directUrl, {
      timeout: 20_000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', 'Accept-Language': 'ar,en;q=0.8' }
    });
    const $ = cheerio.load(res.data || '');
    const text = $('body').text().replace(/\s+/g, ' ');
    const name = textValue($('h1').first().text(), result.name);
    const version = textValue(
      text.match(/(?:Latest Version|Current Version|Version|الإصدار)\s*[:\-]?\s*([0-9]+(?:\.[0-9A-Za-z_-]+){1,5})/i)?.[1],
      $('meta[itemprop="softwareVersion"]').attr('content'),
      result.version
    );
    const size = textValue(
      text.match(/(?:Download APK|تحميل APK)\s*\(\s*([0-9]+(?:\.[0-9]+)?\s*(?:KB|MB|GB))\s*\)/i)?.[1],
      text.match(/(?:APK|XAPK)\s*([0-9]+(?:\.[0-9]+)?\s*(?:KB|MB|GB))/i)?.[1],
      result.size
    );
    const image = textValue($('meta[property="og:image"]').attr('content'), $('meta[name="twitter:image"]').attr('content'), result.image);
    const downloadHref = $('a[href]').map((_, el) => String($(el).attr('href') || '')).get()
      .find(h => /\/download\/apk\/?$/i.test(h) || /\/download\//i.test(h));
    const downloadPage = downloadHref ? (downloadHref.startsWith('http') ? downloadHref : new URL(downloadHref, result.directUrl).href) : result.directUrl;
    return { ...result, name: name || result.name, version: version || result.version, size: size || result.size, image, directUrl: downloadPage };
  } catch (error) {
    console.warn('[APK] APKCombo metadata unavailable:', error.message);
    return result;
  }
}

async function searchApkCombo(query) {
  const slug = slugifySearch(query);
  if (!slug) return [];
  const url = `https://apkcombo.com/ar/search/${encodeURIComponent(slug)}`;
  const res = await axios.get(url, {
    timeout: 25_000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', 'Accept-Language': 'ar,en;q=0.8' }
  });
  const $ = cheerio.load(res.data || '');
  const seen = new Set();
  const results = [];
  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim();
    if (!isApkComboAppPath(href)) return;
    const absolute = href.startsWith('http') ? href : `https://apkcombo.com${href}`;
    const normalized = absolute.replace(/\/$/, '');
    if (seen.has(normalized) || /\/search(?:\/|$)/i.test(normalized)) return;
    const pathParts = new URL(normalized).pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return;
    const packageId = pathParts[pathParts.length - 1];
    const rawName = textValue($(el).find('h2,h3,.name,.title').first().text(), $(el).attr('title'), $(el).text());
    const name = rawName.replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2) return;
    seen.add(normalized);
    results.push({ index: results.length + 1, id: packageId, name: name.slice(0, 100), source: 'APKCombo', version: 'غير معروف', size: 'غير معروف', image: '', directUrl: normalized });
  });
  const unique = results.slice(0, MAX_RESULTS);
  return Promise.all(unique.map(enrichApkComboResult));
}

async function searchApkPure(query) {
  const url = `https://apkpure.net/search?q=${encodeURIComponent(query)}`;
  const res = await axios.get(url, { timeout: 25_000, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', 'Accept-Language': 'ar,en;q=0.8' } });
  const $ = cheerio.load(res.data || '');
  const seen = new Set();
  const results = [];
  $('a').each((_, el) => {
    const href = String($(el).attr('href') || '');
    if (!/^\/[^/]+\/com\.[^/]+(?:\/download)?$/i.test(href) && !/^\/[^/]+\/[^/]+\/download$/i.test(href)) return;
    const absolute = href.startsWith('http') ? href : `https://apkpure.net${href}`;
    const key = absolute.replace(/\/$/, '');
    if (seen.has(key)) return;
    const name = textValue($(el).find('.p1, .name, .title').first().text(), $(el).text()).replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2) return;
    seen.add(key);
    const match = key.match(/\/([^/]+)\/([^/]+)\/download$/i) || key.match(/\/([^/]+)\/(com\.[^/]+)$/i);
    const packageId = match?.[2] || '';
    results.push({ index: results.length + 1, id: packageId, name: name.slice(0, 100), source: 'APKPure', version: 'غير معروف', size: 'غير معروف', image: '', directUrl: key });
  });
  return results.slice(0, MAX_RESULTS);
}

async function enrichApkPureResult(result) {
  if (!result?.directUrl) return result;
  try {
    const res = await axios.get(result.directUrl, { timeout: 20_000, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', 'Accept-Language': 'ar,en;q=0.8' } });
    const $ = cheerio.load(res.data || '');
    const text = $('body').text().replace(/\s+/g, ' ');
    const jsonLd = $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get();
    let ld = {};
    for (const raw of jsonLd) { try { const v = JSON.parse(raw); ld = Array.isArray(v) ? (v.find(x => x?.softwareVersion || x?.fileSize) || v[0] || {}) : v; if (ld && typeof ld === 'object') break; } catch {} }
    const version = textValue(
      ld?.softwareVersion,
      $('meta[itemprop="softwareVersion"]').attr('content'),
      $('meta[name="version"]').attr('content'),
      text.match(/(?:Latest Version|Latest version|Version|الإصدار|أحدث إصدار)\s*[:\-]?\s*v?([0-9]+(?:\.[0-9]+){1,4})/i)?.[1],
      text.match(/\bv([0-9]+(?:\.[0-9]+){1,4})\b/i)?.[1]
    );
    const size = textValue(
      ld?.fileSize,
      $('meta[itemprop="fileSize"]').attr('content'),
      $('meta[name="fileSize"]').attr('content'),
      text.match(/(?:File Size|File size|حجم الملف|حجم)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:KB|MB|GB))/i)?.[1],
      text.match(/([0-9]+(?:\.[0-9]+)?\s*(?:KB|MB|GB))\s*(?:APK|Android)?/i)?.[1]
    );
    const image = textValue($('meta[property="og:image"]').attr('content'), ld?.image, result.image);
    const canonical = $('link[rel="canonical"]').attr('href');
    return { ...result, version: version || result.version, size: size || result.size, image, directUrl: canonical || result.directUrl };
  } catch { return result; }
}

async function searchFdroid(query) {
  try {
    const res = await axios.get('https://search.f-droid.org/api/search_apps', { params: { q: query }, timeout: 15_000, headers: { 'User-Agent': 'LeoBot/1.37.6' } });
    const list = Array.isArray(res.data?.apps) ? res.data.apps : (Array.isArray(res.data) ? res.data : []);
    return list.slice(0, MAX_RESULTS).map((item, i) => ({ index: i + 1, id: item.package_name || item.packageName || '', name: item.name || item.title || 'Unknown App', source: 'F-Droid', version: item.version || item.versionName || item.latest_version || 'غير معروف', size: item.size || item.apk_size || item.fileSize || item.binary_size || 'غير معروف', image: item.icon || '', directUrl: item.download_url || item.apk_url || item.url || '' }));
  } catch { return []; }
}


function normalizeSearchText(value) {
  let text = String(value || '').toLowerCase().normalize('NFKC');
  const aliases = [
    [/واتساب/g, ' whatsapp '], [/واتس/g, ' whatsapp '], [/فيس ?بوك/g, ' facebook '],
    [/انستغرام|انستجرام|انستا/g, ' instagram '], [/تيك ?توك/g, ' tiktok '],
    [/يوتيوب/g, ' youtube '], [/تليجرام|تلجرام/g, ' telegram '], [/سبوتيفاي/g, ' spotify '],
    [/كروم/g, ' chrome '], [/فايرفوكس/g, ' firefox '], [/سناب ?شات/g, ' snapchat ']
  ];
  for (const [pattern, replacement] of aliases) text = text.replace(pattern, replacement);
  return text.replace(/[._-]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function scoreApkResult(query, item) {
  const q = normalizeSearchText(query);
  const name = normalizeSearchText(item.name);
  const id = normalizeSearchText(item.id);
  if (!q || !name) return 0;
  if (name === q) return 1;
  const qTokens = q.split(' ').filter(Boolean);
  const hay = `${name} ${id}`;
  const matched = qTokens.filter(token => hay.includes(token)).length;
  let score = qTokens.length ? matched / qTokens.length : 0;
  if (name.includes(q)) score += 0.35;
  if (id === q || id.includes(q.replace(/\s+/g, ''))) score += 0.3;
  return Math.min(1, score);
}

function rankApkResults(query, results) {
  const dedupe = new Map();
  for (const item of results || []) {
    const key = normalizeSearchText(item.id || item.name);
    const previous = dedupe.get(key);
    if (!previous || scoreApkResult(query, item) > scoreApkResult(query, previous)) dedupe.set(key, item);
  }
  return [...dedupe.values()]
    .map(item => ({ item, score: scoreApkResult(query, item) }))
    .filter(x => x.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((x, i) => ({ ...x.item, index: i + 1 }));
}

async function apkCommand(sock, chatId, message, args, context = {}) {
  const input = String(args?.join(' ') || '').trim();
  const key = sessionKey(chatId, context);
  const session = sessions.get(key);

  // Direct URL mode: still validates and downloads only the explicit URL.
  if (isHttpUrl(input)) {
    const direct = { name: 'LeoBot APK', source: 'Direct URL', version: 'غير معروف', size: 'غير معروف', directUrl: input };
    try {
      await sock.sendMessage(chatId, { text: t('commands.apk.downloading', '⬇️ جاري التحقق من ملف APK وتحميله...') }, { quoted: message });
      await downloadAndSend(sock, chatId, message, direct);
    } catch (error) {
      console.error('[APK direct]', error);
      await sock.sendMessage(chatId, { text: t('commands.apk.failed', '❌ تعذر تحميل ملف APK. تأكد من الرابط والحجم ونوع الملف.') }, { quoted: message });
    }
    return;
  }

  if (isCancel(args)) {
    sessions.delete(key);
    await sock.sendMessage(chatId, { text: t('commands.apk.cancelled', '❌ تم إلغاء جلسة بحث APK.') }, { quoted: message });
    return;
  }

  const selection = parseSelection(args);
  if (selection !== null) {
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(key);
      return sock.sendMessage(chatId, { text: t('commands.apk.expired', '⏰ انتهت صلاحية نتائج البحث. أعد البحث مرة أخرى.') }, { quoted: message });
    }
    const result = session.results.find(item => item.index === selection);
    if (!result) return sock.sendMessage(chatId, { text: t('commands.apk.invalidSelection', '❌ رقم النتيجة غير صحيح. اختر رقمًا من النتائج.') }, { quoted: message });
    session.selected = result;
    try {
      await sock.sendMessage(chatId, { text: `⬇️ جاري تحميل *${result.name}*...\n🏷️ الإصدار: ${result.version}\n📦 الحجم: ${result.size}\n🌐 المصدر: ${result.source}` }, { quoted: message });
      await downloadAndSend(sock, chatId, message, result);
      sessions.delete(key);
    } catch (error) {
      console.error('[APK download]', error);
      await sock.sendMessage(chatId, { text: t('commands.apk.failed', '❌ تعذر تحميل ملف APK. تأكد من المصدر والحجم ونوع الملف.') }, { quoted: message });
    }
    return;
  }

  if (!input) return sock.sendMessage(chatId, { text: t('commands.apk.usage', '📌 مثال: `.تطبيق WhatsApp`') }, { quoted: message });

  try {
    await sock.sendMessage(chatId, { text: t('commands.apk.searching', '🔍 جاري البحث عن التطبيقات...') }, { quoted: message });
    const settled = await Promise.allSettled([
      searchApkCombo(input),
      axios.get(`${API_BASE}/search/apk`, { params: { q: input }, timeout: 15_000 }).then(r => extractResults(r.data).slice(0, MAX_RESULTS).map(normalizeResult)),
      searchApkPure(input).then(results => Promise.all(results.map(enrichApkPureResult))),
      searchFdroid(input)
    ]);
    const allResults = [];
    for (const item of settled) {
      if (item.status === 'fulfilled' && Array.isArray(item.value)) allResults.push(...item.value);
      else if (item.status === 'rejected') console.warn('[APK] Search provider failed:', item.reason?.message || item.reason);
    }
    const results = rankApkResults(input, allResults);
    if (!results.length) return sock.sendMessage(chatId, { text: `❌ لم أجد تطبيقًا يطابق «${input}» بدرجة ثقة كافية. جرّب الاسم الإنجليزي أو اسم الحزمة مثل com.example.app.` }, { quoted: message });
    sessions.set(key, { query: input, results, expiresAt: Date.now() + SESSION_TTL_MS, selected: null });
    await sendSearchResults(sock, chatId, message, results);
  } catch (error) {
    console.error('[APK search]', error);
    await sock.sendMessage(chatId, { text: t('commands.apk.failed', '❌ تعذر البحث عن تطبيقات APK حاليًا.') }, { quoted: message });
  }
}

module.exports = apkCommand;
