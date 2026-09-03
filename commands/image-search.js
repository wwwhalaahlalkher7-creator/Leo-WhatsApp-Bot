const settings = require('../settings');
const response = require('../systems/response');
const axios = require('axios');
const sharp = require('sharp');
const { t } = require('../lib/i18n');
const economyMessages = require('../systems/economy/messages');

function getText(message) {
  return message.message?.conversation?.trim() ||
    message.message?.extendedTextMessage?.text?.trim() ||
    message.message?.imageMessage?.caption?.trim() ||
    message.message?.videoMessage?.caption?.trim() || '';
}

async function translateArabicQuery(query) {
  if (!/[\u0600-\u06ff]/.test(query)) return query;
  try {
    const r = await axios.get('https://api.mymemory.translated.net/get', {
      timeout: 12000,
      params: { q: query, langpair: 'ar|en' },
    });
    const translated = r.data?.responseData?.translatedText;
    return translated && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(translated) ? translated.trim() : query;
  } catch {
    return query;
  }
}

async function searchWikimedia(query) {
  const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
    timeout: 20000,
    params: {
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: 6,
      gsrlimit: 12,
      prop: 'imageinfo',
      iiprop: 'url|mime|size',
      iiurlwidth: 1280,
      format: 'json',
      origin: '*',
    },
  });

  const pages = Object.values(response.data?.query?.pages || {});
  return pages.map(page => ({
    title: page.title?.replace(/^File:/i, '') || 'Image',
    url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
    mime: page.imageinfo?.[0]?.mime || '',
    source: 'Wikimedia Commons',
  })).filter(item => item.url && /^image\//i.test(item.mime));
}

// Wikimedia can occasionally return a valid search response whose first file is
// unavailable for direct download. Wikipedia thumbnails provide a second reliable
// source without requiring an API key.
async function searchWikipedia(query, lang = 'ar') {
  const response = await axios.get(`https://${lang}.wikipedia.org/w/api.php`, {
    timeout: 20000,
    params: {
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrlimit: 8,
      prop: 'pageimages',
      piprop: 'thumbnail|original',
      pithumbsize: 1280,
      format: 'json',
      origin: '*',
    },
  });

  const pages = Object.values(response.data?.query?.pages || {});
  return pages.map(page => ({
    title: page.title || 'Image',
    url: page.thumbnail?.source || page.original?.source,
    mime: 'image/*',
    source: `Wikipedia ${lang.toUpperCase()}`,
  })).filter(item => item.url);
}

async function downloadImageCandidates(candidates) {
  const failures = [];
  for (const candidate of candidates.slice(0, 18)) {
    try {
      const response = await axios.get(candidate.url, {
        timeout: 25000,
        responseType: 'arraybuffer',
        maxContentLength: 15 * 1024 * 1024,
        maxBodyLength: 15 * 1024 * 1024,
        headers: { 'User-Agent': `LeoBot/${settings.version} image-search` },
        validateStatus: status => status >= 200 && status < 300,
      });
      const buffer = Buffer.from(response.data);
      const meta = await sharp(buffer).metadata();
      if (!meta?.width || !meta?.height || !meta?.format) throw new Error('invalid image');
      return { ...candidate, buffer };
    } catch (error) {
      failures.push(`${candidate.source}: ${error?.message || 'download failed'}`);
    }
  }
  const error = new Error('No downloadable image candidate');
  error.failures = failures;
  throw error;
}

module.exports = async function imageSearchCommand(sock, chatId, message, userId, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  const priceKey = 'image';
  const cost = economy.cost(priceKey);
  try {
    const raw = getText(message);
    const query = raw.split(/\s+/).slice(1).join(' ').trim();
    if (!query) return response.text(sock, chatId, t('ai.imageSearchUsage'), message);

    const payment = await economy.runPaid({
      userId, priceKey, reason: 'search:image', refundReason: 'refund:search:image',
      task: async () => {
        await response.text(sock, chatId, t('ai.imageSearchProcessing'), message);
        const translatedQuery = await translateArabicQuery(query);
        const searches = [];
        const addSearch = async (fn, q, ...args) => {
          try { searches.push(...await fn(q, ...args)); } catch (error) { console.warn('[IMAGE-SEARCH]', error?.message || error); }
        };
        await addSearch(searchWikimedia, query);
        if (translatedQuery !== query) await addSearch(searchWikimedia, translatedQuery);
        await addSearch(searchWikipedia, query, /[\u0600-\u06ff]/.test(query) ? 'ar' : 'en');
        if (translatedQuery !== query) await addSearch(searchWikipedia, translatedQuery, 'en');
        const seen = new Set();
        const candidates = searches.filter(item => {
          if (!item.url || seen.has(item.url)) return false;
          seen.add(item.url);
          return true;
        });
        if (!candidates.length) {
          const error = new Error('No image candidates found');
          error.code = 'IMAGE_NOT_FOUND';
          throw error;
        }
        const chosen = await downloadImageCandidates(candidates);
        await sock.sendMessage(chatId, {
          image: chosen.buffer,
          caption: t('ai.imageSearchCaption', '', { title: chosen.title, query }),
        }, { quoted: message });
      },
    });
    if (!payment.ok) return response.text(sock, chatId, economyMessages.insufficient(cost, payment.balance), message);
  } catch (error) {
    console.error('[IMAGE-SEARCH]', error?.message || error, error?.failures || '');
    const messageKey = error?.code === 'IMAGE_NOT_FOUND' ? 'ai.imageSearchNotFound' : 'ai.imageSearchFailed';
    await response.text(sock, chatId, t(messageKey), message);
  }
};
