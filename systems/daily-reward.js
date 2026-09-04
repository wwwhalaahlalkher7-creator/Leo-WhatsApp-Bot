'use strict';
const subscriptions = require('./subscriptions');
const currency = require('./economy/currency');

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function afterSuccessfulCommand(sock, chatId, userId, message, commandName, economy) {
  if (!userId || String(commandName || '').startsWith('monitor')) return false;
  const claim = await subscriptions.claimDaily(userId);
  if (!claim.ok || claim.amount <= 0) return false;
  await delay(2500);
  let balance;
  try { balance = await economy.reward(userId, claim.amount, `subscription:daily:${claim.plan}`); }
  catch (error) { await subscriptions.unclaimDaily(userId, claim.day); throw error; }
  const details = subscriptions.plans()[claim.plan];
  const text = `✨ *مكافأتك اليومية وصلت!*\n\n🎁 لأنك أحد أعضاء *${details?.name || 'Leo Premium'}*، تم إيداع *${currency.amount(claim.amount)}* كمكافأة دخول يومية في حسابك.\n\n💰 رصيدك الآن: *${currency.balance(balance)}*\n\n🤍 شكرًا لاستخدامك ليو وثقتك بنا، ونتمنى لك يومًا رائعًا.`;
  await sock.sendMessage(chatId, { text }, { quoted: message });
  return true;
}
module.exports = { afterSuccessfulCommand };
