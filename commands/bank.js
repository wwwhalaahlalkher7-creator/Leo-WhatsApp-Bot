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
    const history = economy.history(userId, 10);
    const lines = history.length
      ? history.map((tx, i) => `${i + 1}. ${tx.type === 'credit' ? '🟢 +' : '🔴 -'}${tx.amount} — ${tx.reason==='game:trivia:summary'?'المسابقة':economy.formatReason(tx.reason)}`).join('\n')
      : 'لا توجد عمليات مسجلة بعد.';
    return sock.sendMessage(chatId, {
      text: `🏦 *بنك Leo*\n\n💰 *رصيدك:* ${currency.balance(balance)}\n\n📒 *آخر العمليات:*\n${lines}\n\n💡 التحويل: *.تحويل @العضو المبلغ*\n💡 سجل العمليات: *.سجل*\n💡 كسب الرصيد: *.عمل*`
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
  const history = economy.history(userId, 10);
  const text = history.length
    ? `📒 *سجل بنك Leo*\n\n${history.map((tx, i) => `${i + 1}. ${tx.type === 'credit' ? '🟢 +' : '🔴 -'}${tx.amount} — ${tx.reason==='game:trivia:summary'?'المسابقة':economy.formatReason(tx.reason)}\n   ${new Date(tx.at).toLocaleString('ar-EG')}`).join('\n')}`
    : '📒 لا توجد عمليات في السجل بعد.';
  return sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = { bankCommand, transferCommand, historyCommand };
