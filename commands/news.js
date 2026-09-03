const settings = require('../settings');
const response = require('../systems/response');
const { firstAvailable, define } = require('../systems/provider');
const axios = require('axios');
const cheerio = require('cheerio');

function clean(value = '') {
  return String(value).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

const providers = [
  define('google-news-ar', {
    async fetch() {
      const res = await axios.get('https://news.google.com/rss?hl=ar&gl=SD&ceid=SD:ar', { timeout: 20000, headers: { 'User-Agent': `LeoBot/${settings.version}` } });
      const $ = cheerio.load(res.data, { xmlMode: true });
      return $('item').slice(0, 5).map((_, el) => ({
        title: clean($(el).find('title').text()),
        link: $(el).find('link').text().trim(),
        date: $(el).find('pubDate').text().trim()
      })).get();
    }
  })
];

module.exports = async function newsCommand(sock, chatId, message) {
  try {
    const result = await firstAvailable(providers, 'fetch');
    if (!result.ok || !result.value.length) throw new Error('No news items');
    const lines = ['📰 *آخر الأخبار*', ''];
    result.value.forEach((item, index) => {
      lines.push(`${index + 1}. *${item.title || 'خبر بدون عنوان'}*`);
      if (item.date) lines.push(`🕒 ${item.date}`);
      if (item.link) lines.push(`🔗 ${item.link}`);
      lines.push('');
    });
    await response.text(sock, chatId, lines.join('\n'), message);
  } catch (error) {
    console.error('Error fetching news:', error?.message || error);
    await response.text(sock, chatId, '⚠️ تعذر جلب الأخبار حاليًا. جرّب مرة ثانية بعد قليل.', message);
  }
};
