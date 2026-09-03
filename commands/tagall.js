const input = require('../systems/input');
const response = require('../systems/response');
const { t } = require('../lib/i18n');
const isAdmin = require('../lib/isAdmin');
const group = require('../systems/group');  // Move isAdmin to helpers

async function tagAllCommand(sock, chatId, senderId, message) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, message.key.participantAlt || message.key.remoteJidAlt || null);
        

        if (!isSenderAdmin && !message.key.fromMe) {
            await response.text(sock, chatId, t('commands.tagall.admins'), message);
            return;
        }

        // Get group metadata
        const participants = await group.participants(sock, chatId);

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { text: t('commands.tagall.empty') });
            return;
        }

        // Create message with each member on a new line
        let messageText = t('commands.tagall.header') + '\n\n';
        participants.forEach(participant => {
            messageText += `@${participant.id.split('@')[0]}\n`; // Add \n for new line
        });

        // Send message with mentions
        await sock.sendMessage(chatId, {
            text: messageText,
            mentions: participants.map(p => p.id)
        });

    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { text: t('commands.tagall.failed') });
    }
}

module.exports = tagAllCommand;  // Export directly
