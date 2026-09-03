const competitionConfig = require('../competition/config');
const competitionPrices = require('../competition/economy/prices');
const currency = require('../systems/economy/currency');
const economyMessages = require('../systems/economy/messages');
const input = require('../systems/input');

function extractTarget(message) {
  const mentioned = input.mentions(message);
  if (mentioned[0]) return mentioned[0];
  return input.replySender(message);
}

function parseAmount(text) {
  const normalized = input.normalizeArabicDigits(String(text || '').trim()).replace(/[,،]/g, '');
  const result = input.number(normalized, { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
  return result.ok ? result.value : NaN;
}

function isTriviaTx(tx) { return String(tx?.reason || '').startsWith('game:trivia'); }
function summarizeHistory(transactions) {
  const out=[]; let triviaCredit=0, triviaDebit=0, triviaSeen=false;
  for (const tx of transactions) {
    if (isTriviaTx(tx)) { triviaSeen=true; if(tx.type==='credit') triviaCredit+=Number(tx.amount||0); else triviaDebit+=Number(tx.amount||0); continue; }
    out.push(tx);
  }
  if (triviaSeen) out.push({type: triviaCredit-triviaDebit>=0?'credit':'debit', amount:Math.abs(triviaCredit-triviaDebit), reason:'game:trivia:summary', at:Math.max(...transactions.filter(isTriviaTx).map(x=>x.at||0))});
  return out.sort((a,b)=>(b.at||0)-(a.at||0));
}

async function bankCommand(sock, chatId, userId, message, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  try {
    const balance = await economy.balance(userId);
    const history = summarizeHistory(economy.history(userId, 50)).slice(0,5);
    const lines = history.length
      ? history.map((tx, i) => `${i + 1}. ${tx.type === 'credit' ? '🟢 +' : '🔴 -'}${tx.amount} — ${tx.reason==='game:trivia:summary'?'المسابقة':economy.formatReason(tx.reason)}`).join('\n')
      : 'لا توجد عمليات مسجلة بعد.';
    const rewardAt = q => Object.entries(competitionPrices.QUESTION_REWARDS).filter(([n]) => Number(n) <= q).reduce((sum, [, value]) => sum + Number(value || 0), 0);
    const questionCostText = `Q1–5 = ${competitionPrices.QUESTION_COSTS[1]} لكل سؤال | Q6–9 = ${competitionPrices.QUESTION_COSTS[6]} لكل سؤال | Q10 = ${competitionPrices.QUESTION_COSTS[10]} | Q11–14 = ${competitionPrices.QUESTION_COSTS[11]} لكل سؤال | Q15 = ${competitionPrices.QUESTION_COSTS[15]} | Q16–20 = ${competitionPrices.QUESTION_COSTS[16]} لكل سؤال.`;
    const contestHelp = `🏆 *المسابقة الكبرى*\n\n20 سؤالًا — 4 مراحل — الجائزة الكبرى *${currency.amount(rewardAt(20))}*.\n\n🛡️ نقاط الأمان: Q1 = ${rewardAt(1)} | Q5 = ${rewardAt(5)} | Q10 = ${rewardAt(10)} | Q15 = ${rewardAt(15)}.\n💰 تكاليف الأسئلة: ${questionCostText}\n🆘 المساعدة الأساسية: المرحلة 1 = ${competitionPrices.OPTION_COSTS[1]}، المرحلة 2 = ${competitionPrices.OPTION_COSTS[2]}، المرحلة 3 = ${competitionPrices.OPTION_COSTS[3]}.\n🗑️ حذف خيار خاطئ بعد المساعدة: المرحلة 2 = ${competitionPrices.REMOVE_OPTION_COSTS[2]}، المرحلة 3 = ${competitionPrices.REMOVE_OPTION_COSTS[3]}.\n⏱️ مهلة الإجابة: دقيقتان. عدم الإجابة = خسارة.\n🚪 المغادرة الاختيارية أثناء السؤال تمنح جائزة آخر سؤال تمت إجابته، مع مهلة 15 دقيقة.\n🛡️ عند الخسارة أو عدم اتخاذ قرار في نقطة الأمان خلال دقيقتين: تبقى آخر جائزة مضمونة، ومهلة إعادة اللعب 5 دقائق.\n\n${Object.entries(competitionConfig.STAGES).map(([stage, spec]) => `المرحلة ${stage}: Q${spec.from}–Q${spec.to}`).join(' | ')}`;
    return sock.sendMessage(chatId, {
      text: `🏦 *بنك Leo*\n\n💰 *رصيدك:* ${currency.balance(balance)}\n\n📒 *آخر العمليات:*\n${lines}\n\n${contestHelp}\n\n💡 التحويل: *.تحويل @العضو المبلغ*\n💡 سجل المسابقة: *.سجل المسابقة*\n💡 كسب الرصيد: *.عمل*`
    }, { quoted: message });
  } catch (error) {
    console.error('[BANK]', error?.message || error);
    return sock.sendMessage(chatId, { text: '❌ تعذر فتح البنك حاليًا. حاول مرة أخرى.' }, { quoted: message });
  }
}

async function transferCommand(sock, chatId, userId, message, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  try {
    const parts = input.args(input.text(message));
    parts.shift();
    const target = extractTarget(message);
    const amount = parseAmount(parts.filter(p => !p.startsWith('@')).pop());

    if (!target || !Number.isSafeInteger(amount) || amount <= 0) {
      return sock.sendMessage(chatId, {
        text: economyMessages.transferUsage()
      }, { quoted: message });
    }
    if (economy.normalizeId(target) === economy.normalizeId(userId)) {
      return sock.sendMessage(chatId, { text: economyMessages.transferSelf() }, { quoted: message });
    }

    const result = await economy.transfer(userId, target, amount, 'bank:transfer');
    if (!result.ok) {
      return sock.sendMessage(chatId, { text: economyMessages.insufficient(amount, result.senderBalance) }, { quoted: message });
    }

    return sock.sendMessage(chatId, {
      text: economyMessages.transferSuccess(target, amount, result.senderBalance),
      mentions: [target]
    }, { quoted: message });
  } catch (error) {
    console.error('[TRANSFER]', error?.message || error);
    return sock.sendMessage(chatId, { text: '❌ تعذر تنفيذ التحويل حاليًا. حاول مرة أخرى.' }, { quoted: message });
  }
}

async function historyCommand(sock, chatId, userId, message, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  const history = summarizeHistory(economy.history(userId, 50)).slice(0,15);
  const text = history.length
    ? `📒 *سجل بنك Leo*\n\n${history.map((tx, i) => `${i + 1}. ${tx.type === 'credit' ? '🟢 +' : '🔴 -'}${tx.amount} — ${tx.reason==='game:trivia:summary'?'المسابقة':economy.formatReason(tx.reason)}\n   ${new Date(tx.at).toLocaleString('ar-EG')}`).join('\n')}`
    : '📒 لا توجد عمليات في السجل بعد.';
  return sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = { bankCommand, transferCommand, historyCommand };
