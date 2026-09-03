const { t } = require('../lib/i18n');
const isAdmin = require('../lib/isAdmin');
const { findParticipant, isAdminParticipant } = require('../lib/group-operation');
const response = require('../systems/response');
const group = require('../systems/group');
const moderation = require('../systems/moderation');

async function demoteCommand(sock, chatId, mentionedJids, message) {
    try {
        // First check if it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: t('commands.demote.group')
            });
            return;
        }

        // Check admin status first, before any other operations
        try {
            const adminStatus = await isAdmin(sock, chatId, message.key.participant || message.key.remoteJid, message.key.participantAlt || message.key.remoteJidAlt || null);
            
            if (!adminStatus.isBotAdmin) {
                await sock.sendMessage(chatId, { 
                    text: t('commands.demote.botAdmin')
                });
                return;
            }

            if (!adminStatus.isSenderAdmin) {
                await sock.sendMessage(chatId, { 
                    text: t('commands.demote.admins')
                });
                return;
            }
        } catch (adminError) {
            console.error('Error checking admin status:', adminError);
            await sock.sendMessage(chatId, { 
                text: t('commands.demote.botAdmin')
            });
            return;
        }

        let userToDemote = [];
        
        // Check for mentioned users
        if (mentionedJids && mentionedJids.length > 0) {
            userToDemote = mentionedJids;
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToDemote = [message.message.extendedTextMessage.contextInfo.participant];
        }
        
        // If no user found through either method
        if (userToDemote.length === 0) {
            await sock.sendMessage(chatId, { 
                text: t('commands.demote.mention')
            });
            return;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        const before = await sock.groupMetadata(chatId);
        const participants = before?.participants || [];
        const protectedList = await moderation.protectedTargets(sock, chatId, userToDemote, participants);
        const protectedJids = new Set(protectedList.map(item => item.jid));
        if (protectedList.length) {
            const botTarget = protectedList.some(item => item.reason === 'bot');
            const ownerTarget = protectedList.some(item => item.reason === 'owner');
            const key = botTarget ? 'commands.moderationProtection.botKick' : (ownerTarget ? 'commands.moderationProtection.ownerKick' : 'commands.moderationProtection.protected');
            await response.text(sock, chatId, t(key), message);
        }
        const targets = userToDemote.filter(jid => !protectedJids.has(jid) && isAdminParticipant(findParticipant(before?.participants, jid))); 
        const alreadyNonAdmins = userToDemote.filter(jid => !targets.includes(jid));
        if (!targets.length) {
            const names = alreadyNonAdmins.map(jid => `@${String(jid).split('@')[0]}`).join(', ');
            return sock.sendMessage(chatId, { text: `ℹ️ ${names || 'العضو المحدد'} ليس مشرفًا أصلًا، ولم تتغير حالته.` }, { quoted: message });
        }

        await sock.groupParticipantsUpdate(chatId, targets, "demote");
        const after = await sock.groupMetadata(chatId);
        const failed = targets.filter(jid => isAdminParticipant(findParticipant(after?.participants, jid)));
        const succeeded = targets.filter(jid => !failed.includes(jid));
        if (!succeeded.length) {
            return sock.sendMessage(chatId, { text: '❌ لم تنجح عملية الخفض. لم تتغير حالة أي عضو مستهدف.' }, { quoted: message });
        }
        
        // Get usernames for each demoted user
        const usernames = await Promise.all(succeeded.map(async jid => {
            return `@${jid.split('@')[0]}`;
        }));

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        const demotionMessage = `⬇️ *تم تنزيل العضو${succeeded.length > 1 ? 'اء' : ''}*\n\n` + `${usernames.map(name => `• ${name}`).join('\n')}\n\n` + `👤 *بواسطة:* @${message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid.split('@')[0]}`;
        
        await sock.sendMessage(chatId, { 
            text: demotionMessage,
            mentions: [...succeeded, message.key.participant || message.key.remoteJid]
        });
    } catch (error) {
        console.error('Error in demote command:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await sock.sendMessage(chatId, { 
                    text: t('commands.demote.rate')
                });
            } catch (retryError) {
                console.error('Error sending retry message:', retryError);
            }
        } else {
            try {
                await sock.sendMessage(chatId, { 
                    text: t('commands.demote.failed')
                });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

// Function to handle automatic demotion detection
async function handleDemotionEvent(sock, groupId, participants, author) {
    try {
        // Safety check for participants
        if (!Array.isArray(participants) || participants.length === 0) {
            return;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get usernames for demoted participants
        const demotedUsernames = await Promise.all(participants.map(async jid => {
            // Handle case where jid might be an object or not a string
            const jidString = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            return `@${jidString.split('@')[0]}`;
        }));

        let demotedBy;
        let mentionList = participants.map(jid => {
            // Ensure all mentions are proper JID strings
            return typeof jid === 'string' ? jid : (jid.id || jid.toString());
        });

        if (author && author.length > 0) {
            // Ensure author has the correct format
            const authorJid = typeof author === 'string' ? author : (author.id || author.toString());
            demotedBy = `@${authorJid.split('@')[0]}`;
            mentionList.push(authorJid);
        } else {
            demotedBy = 'System';
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        const demotionMessage = `⬇️ *تم تنزيل عضو${participants.length > 1 ? 'اء' : ''}*\n\n` + `${demotedUsernames.map(name => `• ${name}`).join('\n')}\n\n` + `👤 *بواسطة:* ${demotedBy}`;
        
        await sock.sendMessage(groupId, {
            text: demotionMessage,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Error handling demotion event:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

module.exports = { demoteCommand, handleDemotionEvent };
