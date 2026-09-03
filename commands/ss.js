const { assertPublicHttpUrl } = require('../lib/url-security');
const { t } = require('../lib/i18n');
const fetch = require('node-fetch');

async function handleSsCommand(sock, chatId, message, match) {
    if (!match) {
        await sock.sendMessage(chatId, {
            text: `*SCREENSHOT TOOL*\n\n*.ss <url>*\n*.ssweb <url>*\n*.screenshot <url>*\n\nTake a screenshot of any website\n\nExample:\n.ss https://google.com\n.ssweb https://google.com\n.screenshot https://google.com`,
            quoted: message
        });
        return;
    }

    try {
        // Show typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        // Extract URL from command
        const url = match.trim();
        
        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return sock.sendMessage(chatId, {
                text: t('media.screenshot.invalidUrl'),
                quoted: message
            });
        }
        await assertPublicHttpUrl(url);

        // Call the API
        const apiUrl = `https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(url)}&theme=light&device=desktop`;
        const response = await fetch(apiUrl, { headers: { 'accept': '*/*' } });
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        // Get the image buffer
        const imageBuffer = await response.buffer();

        // Send the screenshot
        await sock.sendMessage(chatId, {
            image: imageBuffer,
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('❌ Error in ss command:', error);
        await sock.sendMessage(chatId, {
            text: t('media.screenshot.failed'),
            quoted: message
        });
    }
}

module.exports = {
    handleSsCommand
}; 
