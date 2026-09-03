const settings = require('../settings');
async function aliveCommand(sock, chatId, message) {
    try {
        const text = `*🤖 LeoBot يعمل الآن!*

*الإصدار:* ${settings.version}
*الحالة:* متصل ويعمل
*الاستجابة:* جاهزة
*الوضع:* عام

*🌟 المزايا:*
• إدارة المجموعات
• حماية الروابط والمنشن
• أوامر ترفيهية
• مساعد ذكاء اصطناعي
• تحميل ووسائط

استخدم *.اوامر* أو *.الاوامر* أو *.القائمة* لعرض قائمة الأوامر.`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: '🤖 LeoBot يعمل وحاضر معاك.' }, { quoted: message });
    }
}
module.exports = aliveCommand;
