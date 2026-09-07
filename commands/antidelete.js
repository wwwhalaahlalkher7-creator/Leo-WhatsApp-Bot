const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');
const dataStore = require('../lib/storage');
const { optimizeAudio, optimizeVideo, cleanup } = require('../lib/media-optimizer');

const messageStore = new Map();
const deletedAlbumBatches = new Map();
const DELETED_ALBUM_BATCH_DELAY_MS = 900;
const CONFIG_PATH = 'antidelete.json';
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

// Ensure tmp dir exists
if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

// Function to get folder size in MB
const getFolderSizeInMB = (folderPath) => {
    try {
        const files = fs.readdirSync(folderPath);
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
                totalSize += fs.statSync(filePath).size;
            }
        }

        return totalSize / (1024 * 1024); // Convert bytes to MB
    } catch (err) {
        console.error('Error getting folder size:', err);
        return 0;
    }
};

// Function to clean temp folder if size exceeds 10MB
const cleanTempFolderIfLarge = () => {
    try {
        const sizeMB = getFolderSizeInMB(TEMP_MEDIA_DIR);
        
        if (sizeMB > 200) {
            const files = fs.readdirSync(TEMP_MEDIA_DIR);
            for (const file of files) {
                const filePath = path.join(TEMP_MEDIA_DIR, file);
                fs.unlinkSync(filePath);
            }
        }
    } catch (err) {
        console.error('Temp cleanup error:', err);
    }
};

// Start periodic cleanup check every 1 minute
setInterval(cleanTempFolderIfLarge, 60 * 1000);

// Load config
function loadAntideleteConfig() {
    try {
        return dataStore.read(CONFIG_PATH, { enabled: false });
    } catch {
        return { enabled: false };
    }
}

// Save config
function saveAntideleteConfig(config) {
    try {
        dataStore.writeSync(CONFIG_PATH, config);
    } catch (err) {
        console.error('Config save error:', err);
    }
}

const isOwnerOrSudo = require('../lib/isOwner');

// Command Handler
async function handleAntideleteCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    const rawMatch = String(match || '').trim().toLowerCase();
    const action = ['on', 'تشغيل', 'تفعيل', 'enable', 'enabled'].includes(rawMatch)
        ? 'on'
        : ['off', 'إيقاف', 'ايقاف', 'تعطيل', 'disable', 'disabled'].includes(rawMatch)
            ? 'off'
            : rawMatch;
    
    if (!message.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId, { text: '*❌ هذا الأمر متاح لمالك البوت فقط.*' }, { quoted: message });
    }

    const config = loadAntideleteConfig();

    if (!action) {
        return sock.sendMessage(chatId, {
            text: `*إعداد الحذف التلقائي*\n\nالحالة الحالية: ${config.enabled ? '✅ مفعّل' : '❌ متوقف'}\n\n*.منع الحذف تشغيل* — تفعيل\n*.منع الحذف إيقاف* — إيقاف`
        }, {quoted: message});
    }

    if (action === 'on') {
        config.enabled = true;
    } else if (action === 'off') {
        config.enabled = false;
    } else {
        return sock.sendMessage(chatId, { text: '*❌ الأمر غير صحيح. استخدم `.منع الحذف` لعرض طريقة الاستخدام.*' }, {quoted:message});
    }

    saveAntideleteConfig(config);
    return sock.sendMessage(chatId, { text: action === 'on' ? '*✅ تم تفعيل منع الحذف.*' : '*⛔ تم إيقاف منع الحذف.*' }, {quoted:message});
}

// Store incoming messages (also handles anti-view-once by forwarding immediately)
async function storeMessage(sock, message) {
    try {
        const config = loadAntideleteConfig();
        if (!config.enabled) return; // Don't store if antidelete is disabled

        if (!message.key?.id) return;

        const messageId = message.key.id;
        let content = '';
        let mediaType = '';
        let mediaPath = '';
        let isViewOnce = false;

        const sender = message.key.participant || message.key.remoteJid;

        // Detect content (including view-once wrappers)
        const viewOnceContainer = message.message?.viewOnceMessageV2?.message || message.message?.viewOnceMessage?.message;
        if (viewOnceContainer) {
            // unwrap view-once content
            if (viewOnceContainer.imageMessage) {
                mediaType = 'image';
                content = viewOnceContainer.imageMessage.caption || '';
                const buffer = await downloadContentFromMessage(viewOnceContainer.imageMessage, 'image');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
                await writeFile(mediaPath, buffer);
                isViewOnce = true;
            } else if (viewOnceContainer.videoMessage) {
                mediaType = 'video';
                content = viewOnceContainer.videoMessage.caption || '';
                const buffer = await downloadContentFromMessage(viewOnceContainer.videoMessage, 'video');
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
                await writeFile(mediaPath, buffer);
                isViewOnce = true;
            }
        } else if (message.message?.conversation) {
            content = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            content = message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage) {
            mediaType = 'image';
            content = message.message.imageMessage.caption || '';
            const buffer = await downloadContentFromMessage(message.message.imageMessage, 'image');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.stickerMessage) {
            mediaType = 'sticker';
            const buffer = await downloadContentFromMessage(message.message.stickerMessage, 'sticker');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.webp`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.videoMessage) {
            mediaType = 'video';
            content = message.message.videoMessage.caption || '';
            const buffer = await downloadContentFromMessage(message.message.videoMessage, 'video');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.audioMessage) {
            mediaType = 'audio';
            const mime = message.message.audioMessage.mimetype || '';
            const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
            const buffer = await downloadContentFromMessage(message.message.audioMessage, 'audio');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
            await writeFile(mediaPath, buffer);
        }

        const albumParentKey = message.message?.messageContextInfo?.messageAssociation?.parentMessageKey || null;
        messageStore.set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
            albumParentKey,
            timestamp: new Date().toISOString()
        });

        // Anti-ViewOnce: forward immediately to owner if captured
        if (isViewOnce && mediaType && fs.existsSync(mediaPath)) {
            try {
                        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const senderName = sender.split('@')[0];
                const mediaOptions = {
                    caption: `*Anti-ViewOnce ${mediaType}*
From: @${senderName}`,
                    mentions: [sender]
                };
                if (mediaType === 'image') {
                    await sock.sendMessage(ownerNumber, { image: { url: mediaPath }, ...mediaOptions });
                } else if (mediaType === 'video') {
                    const optimized = await optimizeVideo(mediaPath, { maxWidth: 640, crf: 32, audioBitrate: '64k' });
                    try {
                        await sock.sendMessage(ownerNumber, {
                            video: { url: optimized },
                            mimetype: 'video/mp4',
                            fileName: 'antidelete.mp4',
                            ...mediaOptions
                        });
                    } finally { cleanup(optimized); }
                }
                // Cleanup immediately for view-once forward
                try { fs.unlinkSync(mediaPath); } catch {}
            } catch (e) {
                // ignore
            }
        }

    } catch (err) {
        console.error('storeMessage error:', err);
    }
}

async function sendRecoveredMedia(sock, destination, original, senderName) {
    if (!original.mediaType || !original.mediaPath || !fs.existsSync(original.mediaPath)) return;

    const mediaOptions = {
        caption: `*الوسائط المحذوفة (${original.mediaType})*\nمن: @${senderName}`,
        mentions: [original.sender]
    };

    try {
        switch (original.mediaType) {
            case 'image':
                await sock.sendMessage(destination, { image: { url: original.mediaPath }, ...mediaOptions });
                break;
            case 'sticker':
                await sock.sendMessage(destination, { sticker: { url: original.mediaPath }, ...mediaOptions });
                break;
            case 'video': {
                const optimized = await optimizeVideo(original.mediaPath, { maxWidth: 640, crf: 32, audioBitrate: '64k' });
                try {
                    await sock.sendMessage(destination, {
                        video: { url: optimized },
                        mimetype: 'video/mp4',
                        fileName: 'deleted.mp4',
                        ...mediaOptions
                    });
                } finally { cleanup(optimized); }
                break;
            }
            case 'audio': {
                const optimized = await optimizeAudio(original.mediaPath, { bitrate: '96k', mono: false });
                try {
                    await sock.sendMessage(destination, {
                        audio: { url: optimized },
                        mimetype: 'audio/mpeg',
                        fileName: 'deleted.mp3',
                        ptt: false,
                        ...mediaOptions
                    });
                } finally { cleanup(optimized); }
                break;
            }
        }
    } catch (err) {
        await sock.sendMessage(destination, { text: '⚠️ تعذر إرسال الوسائط المحفوظة حاليًا.' }).catch(() => {});
    } finally {
        try { fs.unlinkSync(original.mediaPath); } catch {}
    }
}

function queueDeletedAlbumImage(sock, item) {
    const albumKey = JSON.stringify(item.original.albumParentKey);
    let batch = deletedAlbumBatches.get(albumKey);
    if (!batch) {
        batch = {
            destination: item.destination,
            sender: item.sender,
            senderName: item.senderName,
            text: item.text,
            deletedBy: item.deletedBy,
            items: new Map(),
            timer: null
        };
        deletedAlbumBatches.set(albumKey, batch);
    }

    batch.items.set(item.messageId, item.original);
    if (batch.timer) clearTimeout(batch.timer);
    batch.timer = setTimeout(() => flushDeletedAlbumBatch(sock, albumKey).catch(err => {
        console.error('[ANTIDELETE ALBUM]', err);
    }), DELETED_ALBUM_BATCH_DELAY_MS);
}

async function flushDeletedAlbumBatch(sock, albumKey) {
    const batch = deletedAlbumBatches.get(albumKey);
    if (!batch) return;
    deletedAlbumBatches.delete(albumKey);

    const items = [...batch.items.values()]
        .filter(item => item.mediaType === 'image' && item.mediaPath && fs.existsSync(item.mediaPath));
    if (!items.length) return;

    // If only one image was deleted, keep the normal single-image behavior.
    if (items.length === 1) {
        const item = items[0];
        await sendRecoveredMedia(sock, batch.destination, item, batch.senderName);
        messageStore.forEach((value, key) => {
            if (value === item) messageStore.delete(key);
        });
        return;
    }

    // Report first, then send the recovered images as one native WhatsApp album.
    await sock.sendMessage(batch.destination, {
        text: batch.text,
        mentions: [batch.deletedBy, batch.sender]
    });

    let albumParent = null;
    try {
        // Baileys v7 supports albumMessage through an album parent message plus
        // child media messages associated with albumParentKey.
        const parent = await sock.sendMessage(batch.destination, {
            album: { expectedImageCount: items.length, expectedVideoCount: 0 }
        });
        albumParent = parent?.key || null;
    } catch (error) {
        console.warn('[ANTIDELETE ALBUM] Could not create album parent:', error.message);
    }

    if (!albumParent) {
        for (const item of items) {
            await sendRecoveredMedia(sock, batch.destination, item, batch.senderName);
        }
    } else {
        for (const item of items) {
            try {
                await sock.sendMessage(batch.destination, {
                    image: { url: item.mediaPath },
                    caption: `*الوسائط المحذوفة (صورة)*\nمن: @${batch.senderName}`,
                    mentions: [batch.sender],
                    albumParentKey: albumParent
                });
            } catch (error) {
                await sock.sendMessage(batch.destination, { text: '⚠️ تعذر إرسال إحدى الصور المحفوظة.' }).catch(() => {});
            } finally {
                try { fs.unlinkSync(item.mediaPath); } catch {}
            }
        }
    }

    for (const [key, value] of messageStore.entries()) {
        if (batch.items.has(key) || batch.items.get(key) === value) messageStore.delete(key);
    }
}

// Handle message deletion
async function handleMessageRevocation(sock, revocationMessage) {
    try {
        const config = loadAntideleteConfig();
        if (!config.enabled) return;

        const messageId = revocationMessage.message.protocolMessage.key.id;
        const deletedBy = revocationMessage.participant || revocationMessage.key.participant || revocationMessage.key.remoteJid;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (deletedBy.includes(sock.user.id) || deletedBy === ownerNumber) return;

        const original = messageStore.get(messageId);
        if (!original) return;
        const destination = original.group || ownerNumber;

        const sender = original.sender;
        const senderName = sender.split('@')[0];
        const groupName = original.group ? (await sock.groupMetadata(original.group)).subject : '';

        const time = new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        let text = `*🔰 تقرير منع الحذف 🔰*\n\n` +
            `*🗑️ حُذفت بواسطة:* @${deletedBy.split('@')[0]}\n` +
            `*👤 المرسل:* @${senderName}\n` +
            `*🕒 الوقت:* ${time}\n`;

        if (groupName) text += `*👥 المجموعة:* ${groupName}\n`;

        if (original.content) {
            text += `\n*💬 الرسالة المحذوفة:*\n${original.content}`;
        }

        // Album images: WhatsApp delivers album items as separate messages that
        // share messageAssociation.parentMessageKey. Batch them briefly so the
        // report is sent once and the recovered images appear as one WhatsApp album.
        if (original.mediaType === 'image' && original.albumParentKey) {
            queueDeletedAlbumImage(sock, {
                messageId,
                original,
                destination,
                sender,
                senderName,
                text,
                deletedBy
            });
            return;
        }

        await sock.sendMessage(destination, {
            text,
            mentions: [deletedBy, sender]
        });
        await sendRecoveredMedia(sock, destination, original, senderName);
        messageStore.delete(messageId);

    } catch (err) {
        console.error('handleMessageRevocation error:', err);
    }
}

module.exports = {
    handleAntideleteCommand,
    handleMessageRevocation,
    storeMessage
};
