const response = require('../systems/response');
const fetch = require('node-fetch');

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await response.text(sock, chatId, '🔍 اكتب اسم الأغنية للبحث عن كلماتها. مثال: `.كلمات <اسم الأغنية>`', message);
        return;
    }

    try {
        // Use lyricsapi.fly.dev and return only the raw lyrics text
        const apiUrl = `https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(songTitle)}`;
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
            const errText = await res.text();
            throw errText;
        }
        
        const data = await res.json();

        const lyrics = data && data.result && data.result.lyrics ? data.result.lyrics : null;
        if (!lyrics) {
            await response.text(sock, chatId, `❌ عذرًا، لم أجد كلمات للأغنية «${songTitle}».ا`, message);
            return;
        }

        const maxChars = 4096;
        const output = lyrics.length > maxChars ? lyrics.slice(0, maxChars - 3) + '...' : lyrics;

        await response.text(sock, chatId, output, message);
    } catch (error) {
        console.error('Error in lyrics command:', error);
        await response.text(sock, chatId, `❌ حدث خطأ أثناء جلب كلمات الأغنية «${songTitle}».`, message);
    }
}

module.exports = { lyricsCommand };
