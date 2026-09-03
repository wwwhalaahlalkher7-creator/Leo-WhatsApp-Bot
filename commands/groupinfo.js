const input = require('../systems/input');
const response = require('../systems/response');
const { t } = require('../lib/i18n');

async function groupInfoCommand(sock, chatId, msg) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        const groupAdmins = participants.filter(p => p.admin);
        const listAdmin = groupAdmins.length
            ? groupAdmins.map((v, i) => `${i + 1}. @${String(v.id || v.lid || '').split('@')[0]}`).join('\n')
            : 'لا يوجد مشرفون مسجلون.';
        const owner = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin')?.id || null;
        const text = [
            '┌──「 *معلومات المجموعة* 」',
            `▢ 🆔 *المعرّف:* ${groupMetadata.id}`,
            `▢ 🏷️ *الاسم:* ${groupMetadata.subject || 'بدون اسم'}`,
            `▢ 👥 *عدد الأعضاء:* ${participants.length}`,
            `▢ 👑 *مالك المجموعة:* ${owner ? `@${owner.split('@')[0]}` : 'غير معروف'}`,
            '▢ 🛡️ *المشرفون:*',
            listAdmin,
            `▢ 📌 *الوصف:* ${groupMetadata.desc?.toString() || t('commands.groupinfo.noDescription')}`,
            '└────────────────'
        ].join('\n');
        await response.text(sock, chatId, text, msg, { mentions: [...groupAdmins.map(v => v.id).filter(Boolean), owner].filter(Boolean) });
    } catch (error) {
        console.error('Error in groupinfo command:', error);
        await response.text(sock, chatId, t('commands.groupinfo.failed'), msg)
    }
}
module.exports = groupInfoCommand;
