require('dotenv').config();
const { t } = require('../lib/i18n');
const fetch = require('node-fetch');

async function rosedayCommand(sock, chatId, message) {
    try {
        const apiKey = String(process.env.PRINCE_API_KEY || '').trim();
        if (!apiKey) {
            return sock.sendMessage(chatId, { text: '🌹 أتمنى لك يومًا مليئًا بالورد والفرح والجمال.' }, { quoted: message });
        }
        const res = await fetch(`https://api.princetechn.com/api/fun/roseday?apikey=${encodeURIComponent(apiKey)}`);
        
        if (!res.ok) {
            throw await res.text();
        }
        
        const json = await res.json();
        const rosedayMessage = json?.result || json?.data?.result || json?.message;
        if (typeof rosedayMessage !== 'string' || !rosedayMessage.trim()) throw new Error('Invalid Rose Day API response');
        await sock.sendMessage(chatId, { text: rosedayMessage.trim() }, { quoted: message });
    } catch (error) {
        console.error('Error in roseday command:', error);
        await sock.sendMessage(chatId, { text: t('fun.roseday') }, { quoted: message });
    }
}

module.exports = { rosedayCommand };
