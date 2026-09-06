const response = require('../systems/response');
const { t } = require('../lib/i18n');

function participantId(participant) {
    if (!participant) return null;
    return participant.id || participant.jid || participant.lid || null;
}

function displayId(value) {
    return String(value || '').split('@')[0].split(':')[0];
}

async function groupInfoCommand(sock, chatId, msg) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = Array.isArray(groupMetadata?.participants) ? groupMetadata.participants : [];
        const groupAdmins = participants.filter(p => p?.admin);
        const adminIds = groupAdmins.map(participantId).filter(Boolean);
        const listAdmin = adminIds.length
            ? adminIds.map((id, i) => `${i + 1}. @${displayId(id)}`).join('\n')
            : 'لا يوجد مشرفون مسجلون.';
        const superAdmin = groupAdmins.find(p => p?.admin === 'superadmin');
        const owner = groupMetadata?.owner || participantId(superAdmin) || null;
        const mentions = [...new Set([...adminIds, owner].filter(Boolean))];
        const description = typeof groupMetadata?.desc === 'string'
            ? groupMetadata.desc.trim()
            : (groupMetadata?.desc?.toString?.() || '');
        const text = [
            '┌──「 *معلومات المجموعة* 」',
            `▢ 🆔 *المعرّف:* ${groupMetadata?.id || chatId}`,
            `▢ 🏷️ *الاسم:* ${groupMetadata?.subject || 'بدون اسم'}`,
            `▢ 👥 *عدد الأعضاء:* ${participants.length}`,
            `▢ 👑 *مالك المجموعة:* ${owner ? `@${displayId(owner)}` : 'غير معروف'}`,
            '▢ 🛡️ *المشرفون:*',
            listAdmin,
            `▢ 📌 *الوصف:* ${description || t('commands.groupinfo.noDescription', 'لا يوجد وصف.')}`,
            '└────────────────'
        ].join('\n');
        return await response.text(sock, chatId, text, msg, { mentions });
    } catch (error) {
        console.error('[GroupInfo] Failed:', error?.stack || error?.message || error);
        return response.text(sock, chatId, t('commands.groupinfo.failed', '❌ تعذر جلب معلومات المجموعة.'), msg);
    }
}

module.exports = groupInfoCommand;
