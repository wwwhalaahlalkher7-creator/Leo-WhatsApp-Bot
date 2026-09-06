const settings = require('../settings');
const response = require('../systems/response');
const { SessionManager } = require('../systems/session');
const { firstAvailable, define } = require('../systems/provider');
const axios = require('axios');
const cheerio = require('cheerio');

const newsSessions = new SessionManager({ defaultTtl: 15 * 60 * 1000 });
const MAX_RESULTS = 5;

function clean(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function text(args) {
  return Array.isArray(args) ? args.join(' ').trim() : String(args || '').trim();
}

function buildUrl(query = '') {
  const base = query
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=SD&ceid=SD:ar`
    : 'https://news.google.com/rss?hl=ar&gl=SD&ceid=SD:ar';
  return base;
}

const providers = [
  define('google-news-ar', {
    async fetch(query = '') {
      const res = await axios.get(buildUrl(query), {
        timeout: 20000,
        headers: { 'User-Agent': `LeoBot/${settings.version}` }
      });
      const $ = cheerio.load(res.data, { xmlMode: true });
      return $('item').slice(0, query ? 10 : MAX_RESULTS).map((_, el) => ({
        title: clean($(el).find('title').text()),
        source: clean($(el).find('source').text()),
        description: clean($(el).find('description').text()),
        date: $(el).find('pubDate').text().trim(),
        link: $(el).find('link').text().trim()
      })).get();
    }
  })
];

function resultLine(item, index) {
  const source = item.source ? ` • ${item.source}` : '';
  return `〔 ${index + 1} 〕 *${item.title || 'خبر بدون عنوان'}*${source}`;
}

function formatDetails(item) {
  const lines = [
    '📰 *تفاصيل الخبر*',
    '',
    `📝 *العنوان:* ${item.title || 'بدون عنوان'}`,
  ];
  if (item.source) lines.push(`🏷️ *المصدر:* ${item.source}`);
  if (item.date) lines.push(`🕒 *التاريخ:* ${item.date}`);
  if (item.description) lines.push('', `📄 *الخبر:* ${item.description}`);
  return lines.join('\n');
}

async function fetchNews(query = '') {
  const result = await firstAvailable(providers, 'fetch', query);
  if (!result.ok || !Array.isArray(result.value) || !result.value.length) throw new Error('No news items');
  return result.value;
}

async function newsCommand(sock, chatId, message, args = [], ctx = {}) {
  const query = text(args);
  try {
    const items = (await fetchNews(query)).slice(0, MAX_RESULTS);
    const heading = query ? `📰 *نتائج الأخبار عن: ${query}*` : '📰 *آخر الأخبار*';
    const lines = [heading, '', ...items.map(resultLine), '', '↩️ *أرسل رقم الخبر بالرد على هذه الرسالة لعرضه بشكل مكبّر.*'];
    const sent = await response.text(sock, chatId, lines.join('\n'), message);
    if (ctx.senderId && sent?.key?.id) {
      newsSessions.create({
        type: 'news-search',
        chatId,
        ownerId: ctx.senderId,
        activeMessageId: sent.key.id,
        data: { results: items, query }
      });
    }
    return sent;
  } catch (error) {
    console.error('[News]', error?.message || error);
    const msg = query
      ? '⚠️ تعذر العثور على أخبار مطابقة لبحثك حاليًا. جرّب كلمات أخرى.'
      : '⚠️ تعذر جلب الأخبار حاليًا. جرّب مرة ثانية بعد قليل.';
    return response.text(sock, chatId, msg, message);
  }
}

async function handleNewsReply(sock, chatId, message, senderId) {
  if (!senderId) return false;
  const session = newsSessions.get('news-search', chatId, senderId);
  if (!session) return false;
  const interaction = require('../systems/interaction').replyNumber(
    message,
    session.activeMessageId,
    { min: 1, max: session.data.results.length }
  );
  if (!interaction.ok) return false;
  const item = session.data.results[interaction.value - 1];
  newsSessions.close(session, 'selected');
  try {
    await response.text(sock, chatId, formatDetails(item), message);
  } catch (error) {
    console.error('[News selection]', error?.message || error);
    await response.text(sock, chatId, '❌ تعذر عرض تفاصيل الخبر المختار. حاول البحث عنه مرة أخرى.', message);
  }
  return true;
}

module.exports = { newsCommand, handleNewsReply };
