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

        // PrinceTechn is the primary third-party enhancer when a key is configured.
        // The local Sharp path is a resilient fallback for cases where the provider is
        // unavailable or the deployment intentionally runs without a paid key.
        const princeKey = String(process.env.PRINCE_API_KEY || '').trim();
        let providerError = null;

        if (princeKey) {
            const apiUrl = `https://api.princetechn.com/api/tools/remini?apikey=${encodeURIComponent(princeKey)}&url=${encodeURIComponent(imageUrl)}`;
            try {
                const providerResponse = await axios.get(apiUrl, {
                    timeout: 60000,
                    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
                });

                const result = providerResponse?.data?.result;
                const enhancedUrl = result?.image_url;
                if (providerResponse?.data?.success && enhancedUrl) {
                    await assertPublicHttpUrl(enhancedUrl);
                    const imageResponse = await axios.get(enhancedUrl, {
                        responseType: 'arraybuffer',
                        timeout: 45000,
                        maxContentLength: 25 * 1024 * 1024,
                        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
                    });

                    const contentType = String(imageResponse.headers?.['content-type'] || '').toLowerCase();
                    if (imageResponse.status === 200 && imageResponse.data && contentType.startsWith('image/')) {
                        const verified = await sharp(Buffer.from(imageResponse.data)).metadata();
                        if (!verified.width || !verified.height) throw new Error('Provider returned an invalid image');

                        await sock.sendMessage(chatId, {
                            image: Buffer.from(imageResponse.data),
                            caption: t('media.remini.success'),
                        }, { quoted: message });
                        return;
                    }
                    throw new Error('Provider returned an invalid image response');
                }
                throw new Error(result?.message || 'Enhancement provider returned no result');
            } catch (error) {
                providerError = error;
                console.warn('[REMINI] Primary enhancer unavailable, using local fallback:', error?.message || error);
            }
        } else {
            console.warn('[REMINI] PRINCE_API_KEY is not configured; using local fallback.');
        }

        // Robust local fallback: decode/rotate all common WhatsApp formats, normalize
        // oversized images, sharpen without introducing extreme artifacts, and emit a
        // widely compatible JPEG. This is enhancement/resampling, not AI super-resolution.
        try {
            const sourceResponse = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                maxContentLength: 25 * 1024 * 1024,
                headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
            });
            const source = Buffer.from(sourceResponse.data);
            const metadata = await sharp(source).metadata();
            if (!metadata.width || !metadata.height) throw new Error('Invalid source image');

            const enhanced = await sharp(source, { failOn: 'none' })
                .rotate()
                .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
                .sharpen({ sigma: 1.1, m1: 1.3, m2: 2.0 })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 93, chromaSubsampling: '4:4:4', mozjpeg: true })
                .toBuffer();

            const verified = await sharp(enhanced).metadata();
            if (!verified.width || !verified.height) throw new Error('Local enhancement produced an invalid image');

            await response.media(sock, chatId, {
                image: enhanced,
                caption: providerError
                    ? '✨ *تم تحسين الصورة بنجاح.*'
                    : '✨ *تم تحسين الصورة.*',
            }, message);
        } catch (localError) {
            if (providerError) {
                localError.cause = providerError;
            }
            throw localError;
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
