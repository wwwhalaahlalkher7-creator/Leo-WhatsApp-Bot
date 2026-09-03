const fs = require('fs');
const store = require('../lib/storage');
const path = require('path');
const isAdmin = require('../lib/isAdmin');
const { t } = require('../lib/i18n');
const response = require('../systems/response');
const group = require('../systems/group');
const moderation = require('../systems/moderation');

// Define paths
const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

// Initialize warnings file if it doesn't exist
function initializeWarningsFile() {
    // Create database directory if it doesn't exist
    if (!fs.existsSync(databaseDir)) {
        fs.mkdirSync(databaseDir, { recursive: true });
    }
    
    // Create warnings.json if it doesn't exist
    if (!fs.existsSync(warningsPath)) {
        fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
    }
}

async function warnCommand(sock, chatId, senderId, mentionedJids, message) {
    try {
        // Initialize files first
        initializeWarningsFile();

        // First check if it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: t('commands.warn.group')
            });
            return;
        }

        let botIsAdmin = false;
        // Check admin status first
        try {
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, message.key.participantAlt || message.key.remoteJidAlt || null);
            // Keep bot admin status available for the automatic 3-warning kick below.
            botIsAdmin = isBotAdmin;
            
            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, { 
                    text: t('commands.warn.admins')
                });
                return;
            }
        } catch (adminError) {
            console.error('Error checking admin status:', adminError);
            await sock.sendMessage(chatId, { 
                text: t('commands.warn.botAdmin')
            });
            return;
        }

        let userToWarn;
        
        // Check for mentioned users
        if (mentionedJids && mentionedJids.length > 0) {
            userToWarn = mentionedJids[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToWarn = message.message.extendedTextMessage.contextInfo.participant;
        }
        
        if (!userToWarn) {
            await sock.sendMessage(chatId, { 
                text: t('commands.warn.mention')
            });
            return;
        }

        const participants = await group.participants(sock, chatId).catch(() => []);
        const protection = await moderation.protectionReason(sock, chatId, userToWarn, participants);
        if (protection === 'bot') {
            await sock.sendMessage(chatId, { text: t('commands.moderationProtection.botWarn') }, { quoted: message });
            return;
        }
        if (protection === 'owner') {
            await sock.sendMessage(chatId, { text: t('commands.moderationProtection.ownerWarn') }, { quoted: message });
            return;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            // Read warnings, create empty object if file is empty
            let warnings = {};
            try {
                warnings = store.read('warnings', {});
            } catch (error) {
                warnings = {};
            }

            // Initialize nested objects if they don't exist
            if (!warnings[chatId]) warnings[chatId] = {};
            if (!warnings[chatId][userToWarn]) warnings[chatId][userToWarn] = 0;
            
            warnings[chatId][userToWarn]++;
            await store.write('warnings', warnings);

            const warningMessage = `⚠️ *تحذير*\n\n👤 *العضو:* @${userToWarn.split('@')[0]}\n⚠️ *عدد التحذيرات:* ${warnings[chatId][userToWarn]}/3\n👑 *بواسطة:* @${senderId.split('@')[0]}`;

            await sock.sendMessage(chatId, { 
                text: warningMessage,
                mentions: [userToWarn, senderId]
            });

            // Auto-kick after 3 warnings
            if (warnings[chatId][userToWarn] >= 3) {
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (!botIsAdmin) {
                    await sock.sendMessage(chatId, { text: `⚠️ وصل @${userToWarn.split('@')[0]} إلى 3 تحذيرات، لكن لا يمكن طرده لأن ليو ليس مشرفًا.`, mentions: [userToWarn] });
                    return;
                }
                const autoProtection = await moderation.protectionReason(sock, chatId, userToWarn, participants);
                if (autoProtection) {
                    await sock.sendMessage(chatId, { text: autoProtection === 'owner' ? t('commands.moderationProtection.ownerKick') : t('commands.moderationProtection.botKick'), mentions: [userToWarn] }, { quoted: message });
                    return;
                }
                await sock.groupParticipantsUpdate(chatId, [userToWarn], "remove");
                delete warnings[chatId][userToWarn];
                await store.write('warnings', warnings);
                
                const kickMessage = `🚫 تم طرد @${userToWarn.split('@')[0]} بعد وصوله إلى 3 تحذيرات.`;

                await sock.sendMessage(chatId, { 
                    text: kickMessage,
                    mentions: [userToWarn]
                });
            }
        } catch (error) {
            console.error('Error in warn command:', error);
            await sock.sendMessage(chatId, { 
                text: t('commands.warn.failed')
            });
        }
    } catch (error) {
        console.error('Error in warn command:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await sock.sendMessage(chatId, { 
                    text: t('commands.warn.rate')
                });
            } catch (retryError) {
                console.error('Error sending retry message:', retryError);
            }
        } else {
            try {
                await sock.sendMessage(chatId, { 
                    text: t('commands.warn.failed')
                });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

module.exports = warnCommand;
