const { t } = require('../lib/i18n');
const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { channelInfo } = require('../lib/messageConfig');

async function welcomeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: t('common.onlyGroup') });
        return;
    }
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(/\s+/).slice(1).join(' ');
    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants) {
    if (!(await isWelcomeOn(id))) return;
    const customMessage = await getWelcome(id);
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
                finalMessage = `╭━━━〔 👋 ترحيب 〕━━━╮\n┃ ${body.split('\n').join('\n┃ ')}\n╰━━━━━━━━━━━━━━━━━━╯`;
            } else {
                finalMessage = `╭━━━〔 👋 عضو جديد 〕━━━╮\n┃ أهلًا وسهلًا @${displayName} 🌷\n┃ نورت مجموعة *${groupName}*!\n┃ 👥 عدد الأعضاء: ${memberCount}\n┃ ⏰ الوقت: ${time}\n╰━━━━━━━━━━━━━━━━━━╯`;
            }
            await sock.sendMessage(id, { text: finalMessage, mentions: [participantString], ...channelInfo });
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    }
}

function replaceVariables(text, values) {
    return String(text || '')
        .replace(/\{user\}|\{العضو\}|\{عضو\}/gi, values.user)
        .replace(/\{group\}|\{المجموعة\}|\{مجموعة\}/gi, values.group)
        .replace(/\{description\}|\{الوصف\}|\{وصف\}/gi, values.description)
        .replace(/\{members\}|\{الأعضاء\}|\{الاعضاء\}|\{عدد_الأعضاء\}|\{عدد_الاعضاء\}/gi, values.members)
        .replace(/\{admins\}|\{المشرفين\}|\{المشرفون\}/gi, values.admins)
        .replace(/\{date\}|\{التاريخ\}/gi, values.date)
        .replace(/\{time\}|\{الوقت\}/gi, values.time);
}

module.exports = { welcomeCommand, handleJoinEvent, replaceVariables };
