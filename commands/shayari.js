require('dotenv').config();
const { t } = require('../lib/i18n');
const fetch = require('node-fetch');

async function shayariCommand(sock, chatId, message) {
    try {
        const response = await fetch(`https://shizoapi.onrender.com/api/texts/shayari?apikey=${encodeURIComponent(process.env.SHIZO_API_KEY || '')}`);
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch (_) { throw new Error('Shayari API returned non-JSON response'); }
        const result = data?.result || data?.data?.result || data?.data?.text || data?.quote || data?.message;
        if (typeof result !== 'string' || !result.trim()) {
            throw new Error('Invalid response from API');
        }

        const buttons = [
            { buttonId: '.shayari', buttonText: { displayText: 'شعر 🪄' }, type: 1 },
        ];

        await sock.sendMessage(chatId, { 
            text: result.trim(),
            buttons: buttons,
            headerType: 1
        }, { quoted: message });
    } catch (error) {
        console.error('Error in shayari command:', error);
        await sock.sendMessage(chatId, { 
            text: t('fun.shayari'),
        }, { quoted: message });
    }
}

module.exports = { shayariCommand }; 
