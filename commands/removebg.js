const settings = require('../settings');
const response = require('../systems/response');
const { t } = require('../lib/i18n');
const axios = require('axios');
const { assertPublicHttpUrl } = require('../lib/url-security');
const FormData = require('form-data');
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

async function removebgCommand(sock, chatId, message, args) {
    return module.exports.exec(sock, message, args);
}

module.exports = {
    name: 'removebg',
    alias: ['rmbg', 'nobg'],
    category: 'general',
    desc: 'إزالة خلفية الصورة مع تحسين النتيجة تلقائيًا.',
    async exec(sock, message, args) {
        try {
            const chatId = message.key.remoteJid;
            let imageUrl = null;
            
            // Check if args contain a URL
            if (args.length > 0) {
                const url = args.join(' ');
                if (isValidUrl(url)) {
                    imageUrl = url;
                } else {
                    return response.text(sock, chatId, t('media.removebg.invalidUrl'), message);
                }
            } else {
                // Try to get image from message or quoted message
                imageUrl = await getQuotedOrOwnImageUrl(sock, message);
                
                if (!imageUrl) {
                    return response.text(sock, chatId, t('media.removebg.usage'), message);
                }
            }

        await assertPublicHttpUrl(imageUrl);

            let output = null;
            const errors = [];
            // First try ClearBackdrop: current no-key endpoint, multipart upload, PNG response.
            try {
                const source = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                const form = new FormData();
                form.append('image', Buffer.from(source.data), { filename: 'input.jpg', contentType: source.headers['content-type'] || 'image/jpeg' });
                const r = await axios.post('https://clearbackdrop.com/api/v1/remove-background', form, { responseType: 'arraybuffer', timeout: 90000, headers: { ...form.getHeaders(), 'User-Agent': `LeoBot/${settings.version}` } });
                if (r.status === 200 && r.data?.length) output = r.data;
            } catch (e) { errors.push(`ClearBackdrop: ${e.message}`); }
            // Optional official remove.bg fallback when a key is configured.
            if (!output && process.env.REMOVEBG_API_KEY) {
                try {
                    const r = await axios.post('https://api.remove.bg/v1.0/removebg', null, { params: { image_url: imageUrl, size: 'auto' }, responseType: 'arraybuffer', timeout: 90000, headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY } });
                    if (r.status === 200 && r.data?.length) output = r.data;
                } catch (e) { errors.push(`remove.bg: ${e.message}`); }
            }
            if (!output) throw new Error('لم يتم الحصول على صورة معالجة');
            await response.media(sock, chatId, { image: output, caption: t('media.removebg.success') }, message);

        } catch (error) {
            console.error('RemoveBG Error:', error.message);
            
            let errorMessage = '❌ تعذر إزالة الخلفية حاليًا.';
            
            if (error.response?.status === 429) {
                errorMessage = '⏳ تم الوصول إلى حد الاستخدام. حاول لاحقًا.';
            } else if (error.response?.status === 400) {
                errorMessage = '❌ رابط الصورة أو صيغتها غير صالحة.';
            } else if (error.response?.status === 500) {
                errorMessage = '🔧 خادم معالجة الصور يواجه مشكلة حاليًا. حاول لاحقًا.';
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = '⏳ انتهت مهلة معالجة الصورة. حاول مرة أخرى.';
            } else if (String(error.message || '').includes('ENOTFOUND') || String(error.message || '').includes('ECONNREFUSED')) {
                errorMessage = '🌐 تعذر الاتصال بخدمة معالجة الصور.';
            }
            
            await response.text(sock, chatId, errorMessage, message);
        }
    }
};

module.exports.removebgCommand = removebgCommand;

// Helper function to validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}
