const store = require('../lib/storage');
const { channelInfo } = require('../lib/messageConfig');
const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');
const { t } = require('../lib/i18n');
const response = require('../systems/response');
const moderation = require('../systems/moderation');

async function banCommand(sock, chatId, message) {
    // Restrict in groups to admins; in private to owner/sudo
    const isGroup = chatId.endsWith('@g.us');
    if (isGroup) {
        const senderId = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, message.key.participantAlt || message.key.remoteJidAlt || null);
        if (!isSenderAdmin && !message.key.fromMe) {
            await response.text(sock, chatId, t('commands.ban.admins'), message, channelInfo);
            return;
        }
    } else {
        const senderId = message.key.participant || message.key.remoteJid;
        const senderIsSudo = await isSudo(senderId);
        const senderIsOwner = await isOwnerOrSudo(senderId, sock, chatId, message.key.participantAlt || message.key.remoteJidAlt || null);
        if (!message.key.fromMe && !senderIsSudo && !senderIsOwner) {
            await response.text(sock, chatId, t('commands.ban.ownerPrivate'), message, channelInfo);
            return;
        }
    }
    const userToBan = moderation.targets(message)[0];
    
    if (!userToBan) {
        await response.text(sock, chatId, t('commands.ban.mention'), message, channelInfo);
        return;
    }

    const participants = isGroup ? await moderation.resolveTargets(sock, chatId, message, [userToBan]).then(r => r.participants).catch(() => []) : [];
    const protection = await moderation.protectionReason(sock, chatId, userToBan, participants);
    if (protection === 'bot') {
        await response.text(sock, chatId, t('commands.moderationProtection.botBan'), message, channelInfo);
        return;
    }
    if (protection === 'owner') {
        await response.text(sock, chatId, t('commands.moderationProtection.ownerBan'), message, channelInfo);
        return;
    }

    try {
        // Add user to banned list
        const bannedUsers = store.read('banned', []);
        if (!bannedUsers.includes(userToBan)) {
            bannedUsers.push(userToBan);
            await store.write('banned', bannedUsers);
            
            await response.text(sock, chatId, t('commands.ban.success', '', { user: userToBan.split('@')[0] }), message, { mentions: [userToBan], ...channelInfo });
        } else {
            await response.text(sock, chatId, t('commands.ban.already', '', { user: userToBan.split('@')[0] }), message, { mentions: [userToBan], ...channelInfo });
        }
    } catch (error) {
        console.error('Error in ban command:', error);
        await response.text(sock, chatId, t('commands.ban.failed'), message, channelInfo);
    }
}

module.exports = banCommand;
