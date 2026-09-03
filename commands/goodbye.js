const { t } = require('../lib/i18n');
const { handleGoodbye } = require('../lib/welcome');
const { isGoodByeOn, getGoodbye } = require('../lib/index');
const { replaceVariables } = require('./welcome');

async function goodbyeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: t('common.onlyGroup') });
        return;
    }
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(/\s+/).slice(1).join(' ');
    await handleGoodbye(sock, chatId, message, matchText);
}

async function handleLeaveEvent(sock, id, participants) {
    if (!(await isGoodByeOn(id))) return;
    const customMessage = await getGoodbye(id);
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject || 'المجموعة';
    const groupDesc = groupMetadata.desc || 'لا يوجد وصف للمجموعة.';
    const memberCount = groupMetadata.participants?.length || 0;
    const adminCount = (groupMetadata.participants || []).filter(p => p?.admin).length;

    for (const participant of participants) {
        try {
            const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const user = participantString.split('@')[0];
            let displayName = user;
            try {
                const contact = await sock.getBusinessProfile(participantString);
                if (contact?.name) displayName = contact.name;
                else {
                    const gp = (groupMetadata.participants || []).find(p => p.id === participantString);
                    if (gp?.name) displayName = gp.name;
                }
            } catch {}
            const now = new Date();
            const time = now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
            const date = now.toLocaleDateString('ar', { year: 'numeric', month: '2-digit', day: '2-digit' });
            let finalMessage;
            if (customMessage) {
                const body = replaceVariables(customMessage, {
                    user: `@${displayName}`, group: groupName, description: groupDesc,
                    members: String(memberCount), admins: String(adminCount), date, time
                });
                finalMessage = `╭━━━〔 👋 وداع 〕━━━╮\n┃ ${body.split('\n').join('\n┃ ')}\n╰━━━━━━━━━━━━━━━━━━╯`;
            } else {
                finalMessage = `╭━━━〔 👋 وداع 〕━━━╮\n┃ مع السلامة يا @${displayName} 🌷\n┃ سنفتقدك في *${groupName}*.\n╰━━━━━━━━━━━━━━━━━━╯`;
            }
            await sock.sendMessage(id, { text: finalMessage, mentions: [participantString] });
        } catch (error) {
            console.error('Error sending goodbye message:', error);
        }
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };
