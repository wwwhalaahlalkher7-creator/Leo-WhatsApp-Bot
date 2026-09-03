const store = require('../lib/storage');
const { CooldownManager } = require('../systems/cooldown');
const currency = require('../systems/economy/currency');
const { EARNINGS } = require('../systems/economy/prices');

const cooldown = new CooldownManager();

const COOLDOWN = 60 * 60 * 1000;
const JOBS = EARNINGS.jobs;

function pickJob(previousTitle = '') {
  // اختيار موزون، مع منع تكرار المهنة السابقة متى كانت هناك بدائل؛
  // هذا يجعل التنوع واضحًا دون إلغاء العشوائية.
  const pool = previousTitle && JOBS.length > 1 ? JOBS.filter(j => j.title !== previousTitle) : JOBS;
  const total = pool.reduce((s, j) => s + j.weight, 0);
  let n = Math.random() * total;
  for (const job of pool) { n -= job.weight; if (n <= 0) return job; }
  return pool[0];
}

function payout(job) {
  const base = Math.floor(job.min + Math.random() * (job.max - job.min + 1));
  // Small performance bonus; it can never overwhelm the job's normal income.
  const performance = Math.random() < EARNINGS.performanceChance ? Math.max(EARNINGS.performanceMinBonus, Math.floor(base * EARNINGS.performanceRate)) : 0;
  return base + performance;
}

module.exports = async function workCommand(sock, chatId, userId, message, economy = null) {
  economy ||= require('../systems/economy').createEconomy();
  try {
    const key = economy.normalizeId(userId);
    const data = store.read('work', { users: {} });
    const last = Number(data.users?.[key]?.lastWork || 0);
    const remaining = Math.max(0, COOLDOWN - (cooldown.now() - last));
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      return sock.sendMessage(chatId, { text: `⏳ لقد عملت مؤخرًا. ارجع بعد *${mins} دقيقة* وحاول مرة أخرى.` }, { quoted: message });
    }

    const job = pickJob(data.users?.[key]?.lastJob || '');
    const amount = payout(job);
    await economy.reward(userId, amount, `work:${job.title}`);

    await store.update('work', current => {
      current.users ||= {};
      current.users[key] ||= {};
      current.users[key].lastWork = Date.now();
      current.users[key].lastJob = job.title;
      return current;
    }, { users: {} });

    const balance = await economy.balance(userId);
    return sock.sendMessage(chatId, {
      text: `💼 *يوم عمل جديد!*

👷 المهنة: *${job.title}*
🛠️ المهمة: ${job.text}.
💰 الدخل: *+${currency.amount(amount)}*
🏦 رصيدك الحالي: *${currency.balance(balance)}*

⏰ يمكنك العمل مرة أخرى بعد ساعة.`
    }, { quoted: message });
  } catch (error) {
    console.error('[WORK]', error?.message || error);
    return sock.sendMessage(chatId, { text: '❌ تعذر تنفيذ العمل حاليًا. حاول مرة أخرى.' }, { quoted: message });
  }
};
