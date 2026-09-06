const fs = require('fs');
const store = require('../lib/storage');
const path = require('path');
const { channelInfo } = require('../lib/messageConfig');
const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');
const { t } = require('../lib/i18n');
const response = require('../systems/response');
const moderation = require('../systems/moderation');

async function unbanCommand(sock, chatId, message) {
    // Restrict in groups to admins; in private to owner/sudo
    const isGroup = chatId.endsWith('@g.us');
    if (isGroup) {
        const senderId = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, message.key.participantAlt || message.key.remoteJidAlt || null);
        if (!isSenderAdmin && !message.key.fromMe) {
            await response.text(sock, chatId, t('commands.unban.admins'), message, channelInfo);
            return;
        }
    } else {
        const senderId = message.key.participant || message.key.remoteJid;
        const senderIsSudo = await isSudo(senderId);
        const senderIsOwner = await isOwnerOrSudo(senderId, sock, chatId, message.key.participantAlt || message.key.remoteJidAlt || null);
        if (!message.key.fromMe && !senderIsSudo && !senderIsOwner) {
            await response.text(sock, chatId, t('commands.unban.ownerPrivate'), message, channelInfo);
            return;
        }
    }
    const userToUnban = moderation.targets(message)[0];
    
    if (!userToUnban) {
        await sock.sendMessage(chatId, { 
            text: t('commands.unban.mention'), 
            ...channelInfo 
        }, { quoted: message });
        return;
    }

    try {
        let mentionJid = userToUnban;
        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const found=(metadata?.participants||[]).find(p=>[p?.id,p?.lid,p?.phoneNumber,p?.phone_number].filter(Boolean).some(id=>id===userToUnban || String(id).split('@')[0].split(':')[0]===String(userToUnban).split('@')[0].split(':')[0]));
                if(found?.id) mentionJid=found.id;
            } catch {}
        }
        const bannedUsers = store.read('banned', []);
        const numeric = value => String(value || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const index = bannedUsers.findIndex(id => id === userToUnban || numeric(id) === numeric(userToUnban));
        if (index > -1) {
            bannedUsers.splice(index, 1);
            await store.write('banned', bannedUsers);
            
            await sock.sendMessage(chatId, { 
                text: t('commands.unban.success', '', { user: userToUnban.split('@')[0] }),
                mentions: [mentionJid],
                ...channelInfo 
            });
        } else {
            await sock.sendMessage(chatId, { 
                text: t('commands.unban.notBanned', '', { user: userToUnban.split('@')[0] }),
                mentions: [mentionJid],
                ...channelInfo 
            });
        }
    } catch (error) {
        console.error('Error in unban command:', error);
        await sock.sendMessage(chatId, { text: t('commands.unban.failed'), ...channelInfo }, { quoted: message });
    }
}

module.exports = unbanCommand; 