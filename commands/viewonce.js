const { t } = require('../lib/i18n');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { optimizeVideo, cleanup } = require('../lib/media-optimizer');

async function viewonceCommand(sock, chatId, message) {
    // Extract quoted imageMessage or videoMessage from your structure
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    if (quotedImage && quotedImage.viewOnce) {
        // Download and send the image
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(chatId, { image: buffer, fileName: 'media.jpg', caption: quotedImage.caption || '' }, { quoted: message });
    } else if (quotedVideo && quotedVideo.viewOnce) {
        // Download and send the video
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        const optimized = await optimizeVideo(buffer, { maxWidth: 640, crf: 32, audioBitrate: '64k' });
        try {
            await sock.sendMessage(chatId, {
                video: { url: optimized },
                mimetype: 'video/mp4',
                fileName: 'media.mp4',
                caption: quotedVideo.caption || ''
            }, { quoted: message });
        } finally {
            cleanup(optimized);
        }
    } else {
        await sock.sendMessage(chatId, { text: t('media.viewonce.usage') }, { quoted: message });
    }
}

module.exports = viewonceCommand; 