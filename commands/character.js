const { channelInfo } = require('../lib/messageConfig');

async function characterCommand(sock, chatId, message) {
    let userToAnalyze;
    const context = message.message?.extendedTextMessage?.contextInfo;
    if (context?.mentionedJid?.length) userToAnalyze = context.mentionedJid[0];
    else if (context?.participant) userToAnalyze = context.participant;

    if (!userToAnalyze) {
        await sock.sendMessage(chatId, { text: '📌 منشن شخصًا أو رد على رسالته لتحليل شخصيته بشكل ترفيهي.', ...channelInfo }, { quoted: message });
        return;
    }

    try {
        const traits = [
            'ذكي', 'مبدع', 'طموح', 'مُصمم', 'ودود', 'كاريزمي', 'واثق', 'متفهم',
            'نشيط', 'كريم', 'صادق', 'مرح', 'خيالي', 'مستقل', 'حدسي', 'طيب',
            'منطقي', 'وفيّ', 'متفائل', 'صبور', 'مثابر', 'موثوق', 'مخلص', 'حكيم'
        ];
        const selected = [];
        while (selected.length < 4) {
            const trait = traits[Math.floor(Math.random() * traits.length)];
            if (!selected.includes(trait)) selected.push(trait);
        }
        const percentages = selected.map(trait => `${trait}: ${Math.floor(Math.random() * 41) + 60}%`);
        const analysis = `🔮 *تحليل شخصية ترفيهي* 🔮\n\n👤 المستخدم: @${userToAnalyze.split('@')[0]}\n\n✨ *الصفات:*\n${percentages.join('\n')}\n\n🎯 *التقييم العام:* ${Math.floor(Math.random() * 21) + 80}%\n\nℹ️ هذا التحليل للترفيه فقط وليس تقييمًا حقيقيًا للشخصية.`;

        let profilePic = null;
        try { profilePic = await sock.profilePictureUrl(userToAnalyze, 'image'); } catch {}
        if (profilePic) {
            await sock.sendMessage(chatId, { image: { url: profilePic }, caption: analysis, mentions: [userToAnalyze], ...channelInfo }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: analysis, mentions: [userToAnalyze], ...channelInfo }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in character command:', error);
        await sock.sendMessage(chatId, { text: '❌ تعذر تحليل الشخصية حاليًا. جرّب مرة ثانية لاحقًا.', ...channelInfo }, { quoted: message });
    }
}
module.exports = characterCommand;
