const { t } = require('../lib/i18n');
const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');
const response = require('../systems/response');
const group = require('../systems/group');
const moderation = require('../systems/moderation');

async function kickCommand(sock, chatId, senderId, mentionedJids, message) {
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId, message.key.participantAlt || message.key.remoteJidAlt || null);
    if (!isOwner) {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, message.key.participantAlt || message.key.remoteJidAlt || null);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: t('common.botMustBeAdmin') }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: t('common.notAdmin') }, { quoted: message });
            return;
        }
    }

    let usersToKick = moderation.targets(message, mentionedJids);
    
    if (usersToKick.length === 0) {
        await response.text(sock, chatId, t('common.mentionUser'), message);
        return;
    }

    const participants = await group.participants(sock, chatId).catch(() => []);
    const protectedTargets = await moderation.protectedTargets(sock, chatId, usersToKick, participants);

    if (protectedTargets.length) {
        const botTarget = protectedTargets.some(item => item.reason === 'bot');
        const ownerTarget = protectedTargets.some(item => item.reason === 'owner');
        const text = botTarget ? t('commands.moderationProtection.botKick') :
            (ownerTarget ? t('commands.moderationProtection.ownerKick') : t('commands.moderationProtection.protected'));
        await response.text(sock, chatId, text, message);
        return;
    }

    try {
        // WhatsApp may reject specific targets (for example a group owner).
        // Never report success until a fresh metadata check confirms removal.
        await sock.groupParticipantsUpdate(chatId, usersToKick, "remove");
        const afterMetadata = await sock.groupMetadata(chatId);
        const remaining = usersToKick.filter(jid => (afterMetadata?.participants || []).some(p => {
            const ids = [p?.id, p?.lid, p?.phoneNumber, p?.phone_number].filter(Boolean);
            return ids.some(id => {
                const a = String(id).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
                const b = String(jid).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
                return a && b && a === b;
            });
        }));
        const succeeded = usersToKick.filter(jid => !remaining.includes(jid));
        if (!succeeded.length) {
            await response.text(sock, chatId, '❌ لم يتم طرد أي عضو. يبدو أن العملية لم تنجح.', message);
            return;
        }
        const usernames = await Promise.all(succeeded.map(async jid => `@${jid.split('@')[0]}`));
        const suffix = remaining.length ? `\n\n⚠️ تعذر طرد: ${remaining.map(jid => `@${jid.split('@')[0]}`).join(', ')}` : '';
        await response.text(sock, chatId, t('commands.kick.success', '', { users: usernames.join(', ') }) + suffix, message, { mentions: [...succeeded, ...remaining] });
    } catch (error) {
        console.error('Error in kick command:', error);
        await response.text(sock, chatId, t('commands.kick.failed'), message);
    }
}

module.exports = kickCommand;
