const { t } = require('../lib/i18n');

const FACTS = [
    '🧠 معلومة: الأخطبوط لديه ثلاثة قلوب، ودمه يميل إلى اللون الأزرق بسبب الهيموسيانين.',
    '🧠 معلومة: العسل يمكن أن يبقى صالحًا لفترات طويلة جدًا إذا حُفظ في ظروف مناسبة.',
    '🧠 معلومة: الضوء القادم من الشمس يحتاج حوالي 8 دقائق و20 ثانية ليصل إلى الأرض.',
    '🧠 معلومة: قلب الحوت الأزرق من أكبر القلوب في عالم الحيوان ويمكن أن يكون ضخمًا جدًا مقارنة بحجم الإنسان.'
];

module.exports = async function factCommand(sock, chatId, message) {
    try {
        const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
        await sock.sendMessage(chatId, { text: fact }, { quoted: message });
    } catch (error) {
        console.error('Error in fact command:', error);
        await sock.sendMessage(chatId, { text: t('fun.fact') }, { quoted: message });
    }
};
