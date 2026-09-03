const { t } = require('../lib/i18n');
const { isAdmin } = require('../lib/isAdmin');
const { findParticipant, isAdminParticipant } = require('../lib/group-operation');
const moderation = require('../systems/moderation');
const response = require('../systems/response');

// Function to handle manual promotions via command
async function promoteCommand(sock, chatId, mentionedJids, message) {
    let userToPromote = [];
    
    // Check for mentioned users
    if (mentionedJids && mentionedJids.length > 0) {
        userToPromote = mentionedJids;
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToPromote = [message.message.extendedTextMessage.contextInfo.participant];
    }
    
    // If no user found through either method
    if (userToPromote.length === 0) {
        await sock.sendMessage(chatId, { 
            text: t('common.mentionUser')
        });
        return;
    }

    try {
        const before = await sock.groupMetadata(chatId);
        const participants = before?.participants || [];
        const protectedList = await moderation.protectedTargets(sock, chatId, userToPromote, participants);
        const protectedJids = new Set(protectedList.map(item => item.jid));
        if (protectedList.length) {
            const botTarget = protectedList.some(item => item.reason === 'bot');
            const ownerTarget = protectedList.some(item => item.reason === 'owner');
            const key = botTarget ? 'commands.moderationProtection.botKick' : (ownerTarget ? 'commands.moderationProtection.ownerKick' : 'commands.moderationProtection.protected');
            await response.text(sock, chatId, t(key), message);
        }
        const alreadyAdmins = userToPromote.filter(jid => !protectedJids.has(jid) && isAdminParticipant(findParticipant(participants, jid)));
        const targets = userToPromote.filter(jid => !protectedJids.has(jid) && !alreadyAdmins.includes(jid));

        if (!targets.length) {
            const names = alreadyAdmins.map(jid => `@${String(jid).split('@')[0]}`).join(', ');
            return sock.sendMessage(chatId, { text: `ℹ️ ${names || 'العضو المحدد'} مشرف بالفعل، ولم تتغير حالته.` }, { quoted: message });
        }

        await sock.groupParticipantsUpdate(chatId, targets, "promote");
        const after = await sock.groupMetadata(chatId);
        const failed = targets.filter(jid => !isAdminParticipant(findParticipant(after?.participants, jid)));
        const succeeded = targets.filter(jid => !failed.includes(jid));
        if (!succeeded.length) {
            return sock.sendMessage(chatId, { text: '❌ لم تنجح الترقية. لم تتغير حالة أي عضو مستهدف.' }, { quoted: message });
        }
        
        // Get usernames for each promoted user
        const usernames = await Promise.all(succeeded.map(async jid => {
            
            return `@${jid.split('@')[0]}`;
        }));

        // Get promoter's name (the bot user in this case)
        const promoterJid = sock.user.id;
        
        const promotionMessage = `👑 *تمت ترقية العضو${succeeded.length > 1 ? 'اء' : ''}*\n\n` + `${usernames.map(name => `• ${name}`).join('\n')}\n\n` + `👤 *بواسطة:* @${promoterJid.split('@')[0]}`;
        await sock.sendMessage(chatId, { 
            text: promotionMessage,
            mentions: [...succeeded, promoterJid]
        });
    } catch (error) {
        console.error('Error in promote command:', error);
        await sock.sendMessage(chatId, { text: t('commands.promote.failed')});
    }
}

// Function to handle automatic promotion detection
async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        // Safety check for participants
        if (!Array.isArray(participants) || participants.length === 0) {
            return;
        }

        // Get usernames for promoted participants
        const promotedUsernames = await Promise.all(participants.map(async jid => {
            // Handle case where jid might be an object or not a string
            const jidString = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            return `@${jidString.split('@')[0]} `;
        }));

        let promotedBy;
        let mentionList = participants.map(jid => {
            // Ensure all mentions are proper JID strings
            return typeof jid === 'string' ? jid : (jid.id || jid.toString());
        });

        if (author && author.length > 0) {
            // Ensure author has the correct format
            const authorJid = typeof author === 'string' ? author : (author.id || author.toString());
            promotedBy = `@${authorJid.split('@')[0]}`;
            mentionList.push(authorJid);
        } else {
            promotedBy = 'System';
        }

        const promotionMessage = `👑 *تمت ترقية عضو${participants.length > 1 ? 'اء' : ''}*\n\n` + `${promotedUsernames.map(name => `• ${name}`).join('\n')}\n\n` + `👤 *بواسطة:* ${promotedBy}`;
        
        await sock.sendMessage(groupId, {
            text: promotionMessage,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}

module.exports = { promoteCommand, handlePromotionEvent };
