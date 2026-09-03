require('dotenv').config();
const { t } = require('../lib/i18n');
const fetch = require('node-fetch');

async function goodnightCommand(sock, chatId, message) {
    try {
        const shizokeys = process.env.SHIZO_API_KEY || '';
        const res = await fetch(`https://shizoapi.onrender.com/api/texts/lovenight?apikey=${shizokeys}`);
        
        if (!res.ok) {
            throw await res.text();
        }
        
        const json = await res.json();
        const goodnightMessage = typeof json?.result === 'string'
            ? json.result.trim()
            : (typeof json?.message === 'string' ? json.message.trim() : '');
        if (!goodnightMessage) throw new Error('Goodnight API returned no text result');

        // Baileys requires text payloads to contain a string, not an object/array.
        await sock.sendMessage(chatId, { text: goodnightMessage }, { quoted: message });
    } catch (error) {
        console.error('Error in goodnight command:', error);
        await sock.sendMessage(chatId, { text: t('fun.goodnight') }, { quoted: message });
    }
}

module.exports = { goodnightCommand }; 
