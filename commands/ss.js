const { assertPublicHttpUrl } = require('../lib/url-security');
const { t } = require('../lib/i18n');
const fetch = require('node-fetch');

async function fetchImage(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 60000);
    try {
        const response = await fetch(url, { ...options.fetchOptions, signal: controller.signal });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${body.slice(0, 180)}`);
        }
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
        const buffer = await response.buffer();
        if (!buffer.length) throw new Error('Empty screenshot');
        return buffer;
    } finally {
        clearTimeout(timer);
    }
}

async function captureScreenshot(targetUrl) {
    const primary = await fetchImage('https://webshot.site/api/capture', {
        timeoutMs: 90000,
        fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'image/*' },
            body: JSON.stringify({ url: targetUrl, format: 'png', mode: 'desktop_full' })
        }
    });
    return primary;
}

async function handleSsCommand(sock, chatId, message, match) {
    if (!match) {
        await sock.sendMessage(chatId, {
            text: `*أداة لقطة الشاشة*\n\n*.لقطة <الرابط>*\n*.ss <الرابط>*\n*.ssweb <الرابط>*\n*.screenshot <الرابط>*\n\n📸 تلتقط صورة لصفحة الموقع التي ترسل رابطها.\n\nمثال:\n.لقطة https://google.com`,
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

        let imageBuffer;
        try {
            imageBuffer = await captureScreenshot(url);
        } catch (primaryError) {
            console.warn('[SS] Webshot failed, using keyless ScreenshotAPI fallback:', primaryError?.message || primaryError);
            const fallbackUrl = `https://screenshotapi.to/api/v1/public/screenshot?url=${encodeURIComponent(url)}&type=png&fullPage=false`;
            imageBuffer = await fetchImage(fallbackUrl, { timeoutMs: 60000, fetchOptions: { headers: { accept: 'image/*' } } });
        }

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
