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
const MAX_APK_BYTES = 100 * 1024 * 1024;
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
  const source = textValue(item?.source, item?.site, item?.provider, item?.host, item?.website, 'BK9');
  const name = textValue(item?.name, item?.title, item?.appName, item?.app_name, 'Unknown App');
  const version = textValue(item?.version, item?.ver, item?.appVersion, item?.release, 'غير معروف');
  const size = textValue(item?.size, item?.fileSize, item?.filesize, item?.apkSize, 'غير معروف');
  const image = textValue(item?.image, item?.imageUrl, item?.icon, item?.iconUrl, item?.thumbnail, item?.thumb);
  const id = textValue(item?.id, item?.appId, item?.app_id, item?.urlId);
  const directUrl = textValue(item?.downloadUrl, item?.dllink, item?.download, item?.url);
  return { index: index + 1, id, name, source, version, size, image, directUrl };
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
function isConfirm(args) { return /^(confirm|yes|نعم|موافق|تحميل)$/i.test(String(args?.join(' ') || '').trim()); }

async function resolveDownloadUrl(result) {
  if (isHttpUrl(result.directUrl) && !/apkpure\.net/i.test(result.directUrl)) return result.directUrl;
  if (isHttpUrl(result.directUrl) && /apkpure\.net/i.test(result.directUrl)) {
    const page = await axios.get(result.directUrl, { timeout: 25_000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(page.data || '');
    const links = $('a').map((_, el) => $(el).attr('href') || '').get();
    const candidate = links.find(h => /\.(?:apk|xapk)(?:$|[?#])/i.test(h)) || links.find(h => /download/i.test(h) && /^https?:\/\//i.test(h));
    if (candidate) return candidate.startsWith('http') ? candidate : new URL(candidate, result.directUrl).href;
    throw new Error('APKPure download link not found');
  }
  if (!result.id) return null;
  const response = await axios.get(`${API_BASE}/download/apk`, { params: { id: result.id }, timeout: 30_000 });
  const data = response.data;
  return textValue(data?.BK9?.dllink, data?.result?.dllink, data?.data?.dllink, data?.dllink, data?.url);
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
    timeout: 60_000,
    maxRedirects: 5,
    maxContentLength: MAX_APK_BYTES,
    maxBodyLength: MAX_APK_BYTES,
    validateStatus: status => status >= 200 && status < 300
  });

  const contentType = String(response.headers['content-type'] || '').toLowerCase();
  const contentLength = Number(response.headers['content-length'] || 0);
  if (contentLength > MAX_APK_BYTES) throw new Error('APK exceeds size limit');
  if (contentType && !contentType.includes('android.package') && !contentType.includes('application/zip') && !contentType.includes('octet-stream')) {
    if (!looksLikeApkUrl(url)) throw new Error(`Unexpected content type: ${contentType}`);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'leobot-apk-'));
  const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}.apk`);
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
    if (detected && detected.mime !== 'application/zip' && detected.ext !== 'apk') {
      throw new Error(`Downloaded file is not an APK/ZIP: ${detected.mime}`);
    }
    const finalSize = (await fs.stat(tmpPath)).size;
    const baseName = safeName(result.name);
    if (finalSize <= APK_ZIP_THRESHOLD_BYTES) {
      await sock.sendMessage(chatId, {
        document: fs.createReadStream(tmpPath),
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${baseName}.apk`,
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
    const res = await axios.get(result.directUrl, { timeout: 20_000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data || '');
    const text = $('body').text().replace(/\s+/g, ' ');
    const version = text.match(/(?:Latest Version|أحدث إصدار|Version|الإصدار)\s*([0-9]+(?:\.[0-9]+){1,4})/i)?.[1];
    const size = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(MB|GB)/i)?.[0];
    const canonical = $('link[rel="canonical"]').attr('href');
    return { ...result, version: version || result.version, size: size || result.size, directUrl: canonical || result.directUrl };
  } catch { return result; }
}

async function searchFdroid(query) {
  try {
    const res = await axios.get('https://search.f-droid.org/api/search_apps', { params: { q: query }, timeout: 15_000, headers: { 'User-Agent': 'LeoBot/1.37.6' } });
    const list = Array.isArray(res.data?.apps) ? res.data.apps : (Array.isArray(res.data) ? res.data : []);
    return list.slice(0, MAX_RESULTS).map((item, i) => ({ index: i + 1, id: item.package_name || item.packageName || '', name: item.name || item.title || 'Unknown App', source: 'F-Droid', version: item.version || 'غير معروف', size: item.size || 'غير معروف', image: item.icon || '', directUrl: item.download_url || item.apk_url || item.url || '' }));
  } catch { return []; }
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
    await sock.sendMessage(chatId, {
      text: t('commands.apk.confirm', '📦 {name}\n🏷️ الإصدار: {version}\n📦 الحجم: {size}\n🌐 المصدر: {source}\n\nهل تريد تحميل هذا التطبيق؟\n\nاكتب `.تطبيق تأكيد` للمتابعة أو `.تطبيق إلغاء` للإلغاء.', {
        name: result.name, version: result.version, size: result.size, source: result.source
      })
    }, { quoted: message });
    return;
  }

  if (isConfirm(args)) {
    if (!session?.selected || session.expiresAt <= Date.now()) {
      sessions.delete(key);
      return sock.sendMessage(chatId, { text: t('commands.apk.expired', '⏰ انتهت صلاحية نتائج البحث. أعد البحث مرة أخرى.') }, { quoted: message });
    }
    const result = session.selected;
    try {
      await sock.sendMessage(chatId, { text: t('commands.apk.downloading', '⬇️ جاري التحقق من ملف APK وتحميله...') }, { quoted: message });
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
    let results = [];
    try {
      const search = await axios.get(`${API_BASE}/search/apk`, { params: { q: input }, timeout: 15_000 });
      const raw = extractResults(search.data);
      results = raw.slice(0, MAX_RESULTS).map(normalizeResult).filter(r => r.name);
    } catch (bk9Error) {
      console.warn('[APK] BK9 search unavailable:', bk9Error?.message || bk9Error);
    }
    if (!results.length) {
      try {
        results = await searchApkPure(input);
        if (results.length) {
          results = await Promise.all(results.map(enrichApkPureResult));
        }
      } catch (apkPureError) {
        console.warn('[APK] APKPure search unavailable:', apkPureError?.message || apkPureError);
      }
    }
    if (!results.length) results = await searchFdroid(input);
    if (!results.length) return sock.sendMessage(chatId, { text: t('commands.apk.notFound', '', { query: input }) }, { quoted: message });
    sessions.set(key, { query: input, results, expiresAt: Date.now() + SESSION_TTL_MS, selected: null });
    await sendSearchResults(sock, chatId, message, results);
  } catch (error) {
    console.error('[APK search]', error);
    await sock.sendMessage(chatId, { text: t('commands.apk.failed', '❌ تعذر البحث عن تطبيقات APK حاليًا.') }, { quoted: message });
  }
}

module.exports = apkCommand;
