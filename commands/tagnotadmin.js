const input = require('../systems/input');
const response = require('../systems/response');
const { t } = require('../lib/i18n');
const isAdmin = require('../lib/isAdmin');
const group = require('../systems/group');

async function tagNotAdminCommand(sock, chatId, senderId, message) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, message.key.participantAlt || message.key.remoteJidAlt || null);

        if (!isSenderAdmin && !message.key.fromMe) {
            await response.text(sock, chatId, t('common.notAdmin'), message);
            return;
        }

        const participants = await group.participants(sock, chatId);

        const nonAdmins = participants.filter(p => !p.admin).map(p => p.id);
        if (nonAdmins.length === 0) {
            await response.text(sock, chatId, t('tag.noNonAdmins'), message);
            return;
        }

        let text = '🔊 *يا جماعة:*\n\n';
        nonAdmins.forEach(jid => {
            text += `@${jid.split('@')[0]}\n`;
        });

        await sock.sendMessage(chatId, { text, mentions: nonAdmins }, { quoted: message });
    } catch (error) {
        console.error('Error in tagnotadmin command:', error);
        await response.text(sock, chatId, t('tag.failed'), message);
    }
}

module.exports = tagNotAdminCommand;


