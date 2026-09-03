const response = require('../systems/response');
const { t } = require('../lib/i18n');
require('dotenv').config();
const axios = require('axios');
const { assertPublicHttpUrl } = require('../lib/url-security');
const sharp = require('sharp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');

async function getQuotedOrOwnImageUrl(sock, message) {
    // 1) Quoted image (highest priority)
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        return await uploadImage(buffer);
    }

    // 2) Image in the current message
    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        return await uploadImage(buffer);
    }

    return null;
}

async function reminiCommand(sock, chatId, message, args) {
    try {
        let imageUrl = null;
        
        // Check if args contain a URL
        if (args.length > 0) {
            const url = args.join(' ');
            if (isValidUrl(url)) {
                imageUrl = url;
            } else {
                return response.text(sock, chatId, t('media.remini.invalidUrl'), message);
            }
        } else {
            // Try to get image from message or quoted message
            imageUrl = await getQuotedOrOwnImageUrl(sock, message);
            
            if (!imageUrl) {
                return response.text(sock, chatId, t('media.remini.usage'), message);
            }
        }

        await assertPublicHttpUrl(imageUrl);

        // Try the configured Remini provider first; if unavailable, perform a reliable
        // local enhancement so the command never dies with a raw English server error.
        const apiUrl = `https://api.princetechn.com/api/tools/remini?apikey=${encodeURIComponent(process.env.PRINCE_API_KEY || '')}&url=${encodeURIComponent(imageUrl)}`;
        let providerResponse = null;
        try {
            providerResponse = await axios.get(apiUrl, { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        } catch (providerError) {
            console.warn('[REMINI] Provider unavailable, using local enhancement:', providerError?.message || providerError);
            providerResponse = null;
        }

        if (providerResponse?.data && providerResponse.data.success && providerResponse.data.result) {
            const result = providerResponse.data.result;
            
            if (result.image_url) {
                await assertPublicHttpUrl(result.image_url);
                // Download the enhanced image
                const imageResponse = await axios.get(result.image_url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                
                if (imageResponse.status === 200 && imageResponse.data) {
                    // Send the enhanced image
                    await sock.sendMessage(chatId, {
                        image: imageResponse.data,
                        caption: t('media.remini.success')
                    }, { quoted: message });
                } else {
                    throw new Error('Failed to download enhanced image');
                }
            } else {
                throw new Error(result.message || 'Failed to enhance image');
            }
        } else {
            const sourceResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const enhanced = await sharp(Buffer.from(sourceResponse.data))
                .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: false })
                .sharpen({ sigma: 1.2, m1: 1.5, m2: 2.0 })
                .jpeg({ quality: 92 })
                .toBuffer();
            await response.media(sock, chatId, { image: enhanced, caption: '✨ تم تحسين الصورة محليًا بنجاح.' }, message);
        }

    } catch (error) {
        console.error('Remini Error:', error.message);
        
        let errorMessage = '❌ تعذر تحسين الصورة حاليًا.';
        
        if (error.response?.status === 429) {
            errorMessage = '⏳ تم الوصول إلى حد الاستخدام. حاول لاحقًا.';
        } else if (error.response?.status === 400) {
            errorMessage = '❌ رابط الصورة أو صيغتها غير صالحة.';
        } else if (error.response?.status === 500) {
            errorMessage = '🔧 خادم تحسين الصور يواجه مشكلة. تمّت محاولة المعالجة المحلية.';
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = '⏳ انتهت مهلة معالجة الصورة.';
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            errorMessage = '🌐 تعذر الاتصال بخدمة تحسين الصور.';
        } else if (error.message.includes('Error processing image')) {
            errorMessage = '❌ تعذر معالجة الصورة. جرّب صورة أخرى.';
        }
        
        await response.text(sock, chatId, errorMessage, message);
    }
}

// Helper function to validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = { reminiCommand };
