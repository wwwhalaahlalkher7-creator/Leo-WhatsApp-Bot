'use strict';
const currency = require('./currency');

const messages = Object.freeze({
  insufficient: (cost, balance) => `💸 ${currency.insufficient()}.
تحتاج *${currency.amount(cost)}*.
${currency.balanceLabel(balance)}`,
  reward: (amount, balance) => `🏆 الجائزة: *+${currency.amount(amount)}*
💰 ${currency.balanceLabel(balance)}`,
  balance: amount => `💰 ${currency.balanceLabel(amount)}`,
  transferSuccess: (target, amount, balance) => `🏦 *تم التحويل بنجاح*\n\n👤 المستلم: @${String(target).split('@')[0]}\n💸 المبلغ: *${currency.amount(amount)}*\n💰 المتبقي: *${currency.balance(balance)}*`,
  transferSelf: () => '❌ لا يمكنك تحويل الرصيد إلى نفسك.',
  transferUsage: () => '💸 *طريقة التحويل:*\n.تحويل @العضو المبلغ\n\nمثال: *.تحويل @Leo 50*',
  operationFailure: label => `❌ تعذر ${label} حاليًا. حاول مرة أخرى.`,
});

module.exports = messages;
