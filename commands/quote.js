const input = require('../systems/input');
const response = require('../systems/response');
const { t } = require('../lib/i18n');

const QUOTES = [
    '💬 «النجاح ليس أن لا تسقط، بل أن تعرف كيف تنهض كل مرة.»',
    '💬 «ابدأ من حيث أنت، واستخدم ما تملك، وافعل ما تستطيع.»',
    '💬 «الخطوات الصغيرة المستمرة تصنع فرقًا كبيرًا مع الوقت.»',
    '💬 «لا تقارن بدايتك بنهاية شخص آخر؛ لكل شخص طريقه.»',
    '💬 «العقل الهادئ يرى حلولًا لا يراها العقل المستعجل.»'
];

module.exports = async function quoteCommand(sock, chatId, message) {
    try {
        const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        await response.text(sock, chatId, quote, message);
    } catch (error) {
        console.error('Error in quote command:', error);
        await response.text(sock, chatId, t('fun.quote'), message);
    }
};
