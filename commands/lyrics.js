const axios = require('axios');
const response = require('../systems/response');

const TIMEOUT = 15000;

async function fetchJson(url, options = {}) {
    const res = await axios.get(url, { timeout: TIMEOUT, validateStatus: s => s >= 200 && s < 500, ...options });
    if (res.status >= 400) return null;
    return res.data;
}

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLyrics(value) {
    return String(value || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

async function lyricsOvh(query) {
    const suggestion = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`);
    const list = suggestion?.data || [];
    if (!Array.isArray(list) || !list.length) return null;
    const ranked = [...list].sort((a, b) => {
        const aa = clean(`${a?.artist?.name || ''} ${a?.title || ''}`).toLowerCase();
        const bb = clean(`${b?.artist?.name || ''} ${b?.title || ''}`).toLowerCase();
        const q = query.toLowerCase();
        return (aa.includes(q) ? 0 : 1) - (bb.includes(q) ? 0 : 1);
    });
    for (const item of ranked.slice(0, 8)) {
        const artist = clean(item?.artist?.name);
        const title = clean(item?.title);
        if (!artist || !title) continue;
        const exact = await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
        if (exact?.lyrics) return { lyrics: exact.lyrics, artist, title, source: 'Lyrics.ovh' };
    }
    return null;
}

async function lrclib(query) {
    const data = await fetchJson(`https://lrclib.net/api/search?${new URLSearchParams({ q: query })}`, {
        headers: { 'User-Agent': 'LeoBot/1.37.6 lyrics fallback' }
    });
    const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    if (!list.length) return null;
    const q = query.toLowerCase();
    const ranked = [...list].sort((a, b) => {
        const sa = clean(`${a?.artistName || ''} ${a?.trackName || ''}`).toLowerCase();
        const sb = clean(`${b?.artistName || ''} ${b?.trackName || ''}`).toLowerCase();
        return (sa === q ? 0 : sa.includes(q) ? 1 : 2) - (sb === q ? 0 : sb.includes(q) ? 1 : 2);
    });
    for (const item of ranked.slice(0, 8)) {
        const lyrics = normalizeLyrics(item?.plainLyrics);
        if (lyrics) return { lyrics, artist: clean(item.artistName), title: clean(item.trackName), source: 'LRCLIB' };
    }
    return null;
}

async function lyricsCommand(sock, chatId, songTitle, message) {
    const query = clean(songTitle);
    if (!query) {
        await response.text(sock, chatId, '🔍 اكتب اسم الأغنية للبحث عن كلماتها. مثال: `.كلمات <اسم الأغنية>`', message);
        return;
    }

    try {
        // Keep Lyrics.ovh first for the existing English/French behavior, then
        // fall back to LRCLIB which has broader Arabic coverage.
        let result = await lyricsOvh(query);
        if (!result) result = await lrclib(query);

        const lyrics = normalizeLyrics(result?.lyrics);
        if (!lyrics) {
            await response.text(sock, chatId, `❌ عذرًا، لم أجد كلمات للأغنية «${query}».`, message);
            return;
        }

        const maxChars = 5500;
        const output = lyrics.length > maxChars ? lyrics.slice(0, maxChars - 3) + '...' : lyrics;
        const header = `🎵 *${result.title || query}*${result.artist ? `\n👤 ${result.artist}` : ''}${result.source ? `\n🔎 المصدر: ${result.source}` : ''}`;
        await response.text(sock, chatId, `${header}\n\n${output}`, message);
    } catch (error) {
        console.error('Error in lyrics command:', error?.message || error);
        await response.text(sock, chatId, `❌ تعذر جلب كلمات الأغنية «${query}» حاليًا.`, message);
    }
}

module.exports = { lyricsCommand };
