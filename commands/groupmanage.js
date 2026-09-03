const { t } = require('../lib/i18n');
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function ensureGroupAndAdmin(sock, chatId, senderId, message, systems) {
    if (systems?.permissionResult) {
        const result = systems.permissionResult;
        if (!result.isGroup) {
            await systems.response.text(sock, chatId, t('common.onlyGroup'), message);
            return { ok: false };
        }
        if (!result.isBotAdmin) {
            await systems.response.text(sock, chatId, t('common.botMustBeAdmin'), message);
            return { ok: false };
        }
        if (!result.isSenderAdmin && !result.isOwner) {
            await systems.response.text(sock, chatId, t('moderation.admins'), message);
            return { ok: false };
        }
        return { ok: true };
    }
    // Backward-compatible fallback for direct/internal callers outside the registry.
    const isAdmin = require('../lib/isAdmin');
    const status = await isAdmin(sock, chatId, senderId, message?.key?.participantAlt || message?.key?.remoteJidAlt || null);
    if (!status.isBotAdmin) return { ok: false };
    if (!status.isSenderAdmin) return { ok: false };
    return { ok: true };
}

async function setGroupDescription(sock, chatId, senderId, text, message, systems) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message, systems);
    if (!check.ok) return;
    const desc = (text || '').trim();
    if (!desc) {
        await sock.sendMessage(chatId, { text: t('group.usageDesc') }, { quoted: message });
        return;
    }
    try {
        await sock.groupUpdateDescription(chatId, desc);
        await sock.sendMessage(chatId, { text: t('group.descUpdated') }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: t('group.descFailed') }, { quoted: message });
    }
}

async function setGroupName(sock, chatId, senderId, text, message, systems) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message, systems);
    if (!check.ok) return;
    const name = (text || '').trim();
    if (!name) {
        await sock.sendMessage(chatId, { text: t('group.usageName') }, { quoted: message });
        return;
    }
    try {
        await sock.groupUpdateSubject(chatId, name);
        await sock.sendMessage(chatId, { text: t('group.nameUpdated') }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: t('group.nameFailed') }, { quoted: message });
    }
}

async function setGroupPhoto(sock, chatId, senderId, message, systems) {
    const check = await ensureGroupAndAdmin(sock, chatId, senderId, message, systems);
    if (!check.ok) return;

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMessage = quoted?.imageMessage || quoted?.stickerMessage;
    if (!imageMessage) {
        await sock.sendMessage(chatId, { text: t('group.usagePhoto') }, { quoted: message });
        return;
    }
    try {
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const imgPath = path.join(tmpDir, `gpp_${Date.now()}.jpg`);
        fs.writeFileSync(imgPath, buffer);

        await sock.updateProfilePicture(chatId, { url: imgPath });
        try { fs.unlinkSync(imgPath); } catch (_) {}
        await sock.sendMessage(chatId, { text: t('group.photoUpdated') }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: t('group.photoFailed') }, { quoted: message });
    }
}

module.exports = {
    setGroupDescription,
    setGroupName,
    setGroupPhoto
};


