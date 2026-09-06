const response = require('../systems/response');
const fetch = require('node-fetch');

async function fetchJson(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 180)}`);
        return JSON.parse(text);
    } finally {
        clearTimeout(timer);
    }
}

async function findLyrics(query) {
    const suggestion = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`);
    const first = Array.isArray(suggestion?.data) ? suggestion.data.find(item => item?.artist?.name && item?.title) : null;
    if (!first) return null;
    const artist = first.artist.name;
    const title = first.title;
    const exact = await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    return { lyrics: exact?.lyrics, artist, title };
}

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await response.text(sock, chatId, '🔍 اكتب اسم الأغنية للبحث عن كلماتها. مثال: `.كلمات <اسم الأغنية>`', message);
        return;
    }

    try {
        const result = await findLyrics(songTitle);
        const lyrics = result?.lyrics || null;
        if (!lyrics) {
            await response.text(sock, chatId, `❌ عذرًا، لم أجد كلمات للأغنية «${songTitle}».ا`, message);
            return;
        }

        const maxChars = 4096;
        const output = lyrics.length > maxChars ? lyrics.slice(0, maxChars - 3) + '...' : lyrics;

        const heading = result?.artist && result?.title ? `🎵 *${result.title}* — ${result.artist}\n\n` : '';
        await response.text(sock, chatId, heading + output, message);
    } catch (error) {
        console.error('Error in lyrics command:', error);
        await response.text(sock, chatId, `❌ حدث خطأ أثناء جلب كلمات الأغنية «${songTitle}».`, message);
    }
}

module.exports = { lyricsCommand };
