'use strict';
const currency = require('../systems/economy/currency');
const interaction = require('../systems/interaction');

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const os = require('os');
const economySystem = require('../systems/economy');
const config = require('./config');
const history = require('./history');
const bank = require('./question-bank.json');
const competitionPrices = require('./economy/prices');

const xp = require('../systems/xp');
const subscriptions = require('../systems/subscriptions');
const economy = economySystem.createEconomy();

const sessions = new Map(); // exactly one active contest per group

function normalizeAnswer(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ');
}
function normalizeId(id) { return economy.normalizeId(id); }
function ids(...values) { return values.flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean).map(normalizeId); }
function sameUser(a, ...candidates) {
  const left = new Set(ids(a));
  return ids(candidates).some(id => left.has(id));
}
function userKeys(userId, altUserId) { return [...new Set(ids(userId, altUserId))]; }
function stageFor(questionNumber) {
  for (const [stage, spec] of Object.entries(config.STAGES)) {
    if (questionNumber >= spec.from && questionNumber <= spec.to) return Number(stage);
  }
  return null;
}
function safeQuestion(q) { return config.SAFE_QUESTIONS.includes(q); }
function cumulativeReward(q) {
  let total = 0;
  for (let i = 1; i <= q; i += 1) total += Number(competitionPrices.QUESTION_REWARDS[i] || 0);
  return total;
}
function cumulativeCost(q) {
  let total = 0;
  for (let i = 1; i <= q; i += 1) total += Number(competitionPrices.QUESTION_COSTS[i] || 0);
  return total;
}
function money(n) { return currency.amount(n); }
function durationText(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return `${minutes} دقيقة`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function prizeChequeSvg(session, awarded, result) {
  const player = escapeXml(session.playerName || 'المتسابق');
  const amount = Number(awarded || 0).toLocaleString('en-US');
  const date = new Date().toLocaleDateString('ar-EG');
  const chequeNo = escapeXml(`LEO-${String(session.contestId || Date.now()).replace(/[^A-Za-z0-9-]/g, '').slice(-14).toUpperCase()}`);
  const stage = `${session.stage || 1}/4`;
  const resultText = escapeXml(result === 'فوز كامل' ? 'إتمام المسابقة' : result === 'مغادرة اختيارية' ? 'مغادرة اختيارية' : result || 'جائزة المسابقة');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="820" viewBox="0 0 1400 820">
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#f4eddc"/></linearGradient>
      <linearGradient id="navy" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#081a33"/><stop offset="1" stop-color="#17365e"/></linearGradient>
      <pattern id="wm" width="220" height="130" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)"><text x="10" y="70" font-family="DejaVu Sans" font-size="34" font-weight="800" fill="#c5a14b" opacity="0.08">LEO</text></pattern>
    </defs>
    <rect x="8" y="8" width="1384" height="804" rx="38" fill="url(#paper)" stroke="#b88a17" stroke-width="10"/>
    <rect x="25" y="25" width="1350" height="770" rx="28" fill="none" stroke="#9aa8b8" stroke-width="2"/>
    <rect x="42" y="42" width="1316" height="736" rx="20" fill="url(#wm)"/>
    <rect x="55" y="52" width="1290" height="115" rx="20" fill="url(#navy)"/>
    <text x="88" y="104" font-family="Georgia,serif" font-size="48" font-weight="800" fill="#f3d36b">LEO</text>
    <text x="88" y="139" font-family="Arial,sans-serif" font-size="19" letter-spacing="7" fill="#ffffff">PRIZE BANK</text>
    <text x="1308" y="105" text-anchor="end" font-family="DejaVu Sans,Arial,sans-serif" font-size="43" font-weight="800" fill="#f3d36b">شيك الجائزة</text>
    <text x="1308" y="139" text-anchor="end" font-family="DejaVu Sans,Arial,sans-serif" font-size="20" fill="#ffffff">المسابقة الكبرى • Leo</text>

    <text x="80" y="220" font-family="DejaVu Sans,Arial,sans-serif" font-size="26" fill="#30445e">التاريخ: ${escapeXml(date)}</text>
    <text x="1320" y="220" text-anchor="end" font-family="DejaVu Sans,Arial,sans-serif" font-size="26" fill="#30445e">رقم الشيك: ${chequeNo}</text>

    <text x="80" y="282" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" fill="#6c7890">يُدفع إلى</text>
    <text x="240" y="286" font-family="DejaVu Sans,Arial,sans-serif" font-size="52" font-weight="900" letter-spacing="1.5" fill="#102442">${player}</text>
    <line x1="240" y1="305" x2="1010" y2="305" stroke="#17365e" stroke-width="2"/>

    <rect x="1030" y="245" width="285" height="125" rx="18" fill="#fffdf7" stroke="#b88a17" stroke-width="4"/>
    <text x="1172" y="278" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="21" fill="#65728a">القيمة المعتمدة</text>
    <text x="1172" y="333" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="54" font-weight="900" fill="#102442">${amount}</text>
    <text x="1172" y="359" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="19" fill="#65728a">رصيد</text>

    <line x1="80" y1="405" x2="1315" y2="405" stroke="#c5a14b" stroke-width="3"/>
    <text x="80" y="448" font-family="DejaVu Sans,Arial,sans-serif" font-size="28" fill="#6c7890">نوع الاستحقاق</text>
    <text x="310" y="448" font-family="DejaVu Sans,Arial,sans-serif" font-size="31" font-weight="800" fill="#102442">جائزة المسابقة الكبرى • المرحلة ${stage}</text>
    <text x="310" y="486" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" fill="#30445e">الحالة: ${resultText}</text>

    <rect x="80" y="520" width="770" height="120" rx="18" fill="#fbf6e9" stroke="#d0b56c" stroke-width="2"/>
    <text x="110" y="557" font-family="DejaVu Sans,Arial,sans-serif" font-size="23" fill="#65728a">المبلغ كتابةً</text>
    <text x="110" y="602" font-family="DejaVu Sans,Arial,sans-serif" font-size="42" font-weight="900" letter-spacing="1.2" fill="#102442">${amount} رصيد فقط</text>

    <g transform="translate(930 500)">
      <circle cx="125" cy="72" r="66" fill="none" stroke="#c5a14b" stroke-width="5"/>
      <circle cx="125" cy="72" r="55" fill="none" stroke="#c5a14b" stroke-width="1"/>
      <text x="125" y="68" text-anchor="middle" font-family="Georgia,serif" font-size="29" font-weight="800" fill="#b88a17">LEO</text>
      <text x="125" y="92" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" letter-spacing="2" fill="#b88a17">VERIFIED</text>
      <text x="125" y="145" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="19" fill="#65728a">ختم الإدارة</text>
    </g>

    <line x1="930" y1="650" x2="1300" y2="650" stroke="#17365e" stroke-width="2"/>
    <text x="1115" y="632" text-anchor="middle" font-family="cursive" font-size="43" font-style="italic" fill="#102442">Leonardo</text>
    <text x="1115" y="683" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="21" fill="#65728a">توقيع الإدارة • Leonardo</text>

    <text x="80" y="720" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" fill="#738198">هذا الشيك إثبات تذكاري للجائزة المعتمدة داخل نظام Leo، ولا يمثل وسيلة دفع خارج النظام.</text>
    <text x="1315" y="720" text-anchor="end" font-family="DejaVu Sans,Arial,sans-serif" font-size="20" font-weight="800" fill="#30445e">LEO • المسابقة الكبرى</text>
  </svg>`;
}

async function makePrizeCheque(session, awarded, result) {
  if (!(Number(awarded) > 0)) return null;
  const svg = prizeChequeSvg(session, awarded, result);
  const out = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  return out;
}

async function sendPrizeCheque(sock, session, awarded, result) {
  if (!(Number(awarded) > 0)) return;
  try {
    const cheque = await makePrizeCheque(session, awarded, result);
    await sock.sendMessage(session.chatId, {
      image: cheque,
      caption: `🧾 *شيك جائزة Leo*\n\n👤 المتسابق: *${session.playerName || 'المتسابق'}*\n💰 المبلغ المعتمد: *${Number(awarded).toLocaleString('en-US')} ${currency.name}*\n✍️ التوقيع: *Leonardo*`
    });
  } catch (error) {
    console.error('[competition] prize cheque failed', error);
  }
}
function getQuotedId(message) { return interaction.quotedId(message); }
function isReplyTo(message, messageId) { return interaction.isReplyTo(message, messageId); }
function parseCommand(value) {
  return String(value || '').trim().toLowerCase();
}
function optionLetterIndex(value, optionCount) {
  const v = parseCommand(value).replace(/[.)]/g, '');
  const map = { a: 0, b: 1, c: 2, d: 3 };
  if (Object.prototype.hasOwnProperty.call(map, v) && map[v] < optionCount) return map[v];
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= optionCount) return n - 1;
  return -1;
}
function optionBlock(options) {
  return options.map((x, i) => `${String.fromCharCode(65 + i)}) ${x}`).join('\n');
}
function pickQuestion(stage, usedIds) {
  const pool = (bank.questions?.[stage] || []).filter(q => !usedIds.includes(q.id));
  if (!pool.length) throw new Error(`Trivia question bank exhausted for stage ${stage}`);
  return pool[Math.floor(Math.random() * pool.length)];
}
function makeDisplayedOptions(question, stage) {
  const expected = config.STAGES[stage].optionCount;
  if (!expected) return [];
  const source = Array.isArray(question.options) ? [...question.options] : [];
  if (source.length < expected || !source.some(v => normalizeAnswer(v) === normalizeAnswer(question.answer))) {
    throw new Error(`Invalid option set for ${question.id}`);
  }
  const unique = [];
  const seen = new Set();
  for (const value of source) {
    const key = normalizeAnswer(value);
    if (!seen.has(key)) { seen.add(key); unique.push(value); }
  }
  if (unique.length !== expected) throw new Error(`Question ${question.id} has invalid option count`);
  return unique.sort(() => Math.random() - 0.5);
}
function validateBank() {
  for (const stage of [1, 2, 3, 4]) {
    const list = bank.questions?.[stage];
    if (!Array.isArray(list) || list.length < 100) throw new Error(`Stage ${stage} needs a large question pool`);
    const idsSeen = new Set();
    const textsSeen = new Set();
    for (const q of list) {
      if (!q?.id || !q.question || !q.answer) throw new Error(`Invalid question in stage ${stage}`);
      if (idsSeen.has(q.id)) throw new Error(`Duplicate question id ${q.id}`);
      const text = normalizeAnswer(q.question);
      if (textsSeen.has(text)) throw new Error(`Duplicate question text in stage ${stage}: ${q.id}`);
      idsSeen.add(q.id); textsSeen.add(text);
      const count = config.STAGES[stage].optionCount;
      if (count === 0) {
        if (q.options !== null) throw new Error(`Stage 4 question ${q.id} must have no options`);
      } else if (!Array.isArray(q.options) || q.options.length !== count || !q.options.some(o => normalizeAnswer(o) === normalizeAnswer(q.answer))) {
        throw new Error(`Invalid options for ${q.id}`);
      }
    }
  }
}
validateBank();

function questionText(session, extra = '') {
  const q = session.currentQuestion;
  const stage = session.stage;
  const shown = session.displayedOptions || [];
  const progress = Array.from({ length: config.TOTAL_QUESTIONS }, (_, i) => i + 1 === session.questionNumber ? '🔶' : i + 1 < session.questionNumber ? '🟢' : '⚫').join('');
  const options = shown.length ? `\n\n${optionBlock(shown)}` : '';
  const helpLine = stage <= 3
    ? (session.optionsShown
      ? '\n🆘 المساعدة الأساسية مفعّلة لهذا السؤال.'
      : '\n💡 للمساعدة: *خيارات* بالرد على رسالة هذا السؤال.')
    : '\n🚫 لا تتوفر خيارات في هذه المرحلة.';
  const removeLine = session.removeAvailable
    ? '\n🗑️ لحذف خيار خاطئ واحد: *حذف_خيار* بالرد على رسالة هذا السؤال.'
    : '';
  return `╭━━━〔 🏆 المسابقة الكبرى 〕━━━╮\n┃ المرحلة: *${stage}/4*\n┃ السؤال: *${session.questionNumber}/${config.TOTAL_QUESTIONS}*\n┃ ⏱️ مهلة الإجابة: *دقيقتان*\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n${progress}\n\n🧠 *${q.category || 'عام'}*\n\n❓ ${q.question}${options}${helpLine}${removeLine}\n\n↩️ *أجب فقط بالرد على رسالة هذا السؤال.*${extra ? `\n\n${extra}` : ''}`;
}
function saveRecord(session, result, awarded, extra = {}) {
  const record = {
    contestId: session.contestId,
    groupId: session.chatId,
    userId: normalizeId(session.userId),
    startedAt: session.startedAt,
    endedAt: Date.now(),
    result,
    questionReached: session.questionNumber,
    stageReached: session.stage,
    lastAnsweredQuestion: session.lastAnsweredQuestion,
    bankedReward: session.bankedReward,
    lastAnsweredReward: session.currentReward,
    awarded: Number(awarded) || 0,
    paidReward: session.paidReward,
    totalQuestionCosts: cumulativeCost(session.questionNumber),
    ...extra,
  };
  history.save(session.userId, record);
  return record;
}
async function setCooldown(userId, ms) {
  const key = normalizeId(userId);
  // Contest history is separate from the general bot economy, but cooldown is
  // kept in the existing trivia namespace for backward compatibility.
  const legacyStore = require('../lib/storage');
  await legacyStore.update('trivia', data => {
    data.users ||= {};
    data.users[key] ||= {};
    data.users[key].cooldownUntil = Date.now() + ms;
    data.users[key].updatedAt = Date.now();
    return data;
  }, { users: {} });
}
async function cooldownLeft(userId) {
  const legacyStore = require('../lib/storage');
  const data = legacyStore.read('trivia', { users: {} });
  return Math.max(0, Number(data.users?.[normalizeId(userId)]?.cooldownUntil || 0) - Date.now());
}
async function creditUpTo(session, targetReward) {
  const delta = Math.max(0, Number(targetReward) - Number(session.paidReward || 0));
  if (!delta) return 0;
  await economy.reward(session.userId, delta, `game:reward:trivia:q${session.questionNumber}`);
  await xp.add(session.userId, Math.max(5, Math.round(10 * Number(subscriptions.get(session.userId)?.details?.xpBoost || 1))), `game:progress:trivia:q${session.questionNumber}`);
  session.paidReward = Number(session.paidReward || 0) + delta;
  return delta;
}
function clearTimer(session) {
  if (session.timerHandle) clearTimeout(session.timerHandle);
  session.timerHandle = null;
  session.timerToken = Number(session.timerToken || 0) + 1;
}
function armTimer(sock, session, mode) {
  clearTimer(session);
  const token = session.timerToken;
  const duration = mode === 'decision' ? config.SAFE_DECISION_TIMEOUT_MS : config.QUESTION_TIMEOUT_MS;
  session.timerMode = mode;
  session.timerHandle = setTimeout(() => {
    if (session.timerToken !== token || sessions.get(session.chatId) !== session) return;
    timeoutContest(sock, session, mode).catch(err => console.error('[competition] timeout', err));
  }, duration);
}
async function finishLoss(sock, session, reason) {
  clearTimer(session);
  sessions.delete(session.chatId);
  await setCooldown(session.userId, config.NORMAL_COOLDOWN_MS);
  const awarded = Number(session.bankedReward || 0);
  saveRecord(session, reason, awarded);
  const answer = session.currentQuestion?.answer || 'غير متاحة';
  await sock.sendMessage(session.chatId, { text: `❌ *انتهت المسابقة بالخسارة.*\n\nالإجابة الصحيحة: *${answer}*\n\n💰 آخر جائزة مضمونة لك: *${awarded} ${currency.name}*\n⏰ يمكنك بدء مسابقة جديدة بعد *5 دقائق*.` });
}
async function timeoutContest(sock, session, mode) {
  const label = mode === 'decision' ? 'انتهاء مهلة القرار' : 'انتهاء مهلة الإجابة';
  clearTimer(session);
  sessions.delete(session.chatId);
  await setCooldown(session.userId, config.NORMAL_COOLDOWN_MS);
  const awarded = Number(session.bankedReward || 0);
  saveRecord(session, label, awarded);
  const text = mode === 'decision'
    ? `⏰ *انتهت مهلة القرار.*\n\nلم تختر الاستمرار أو المغادرة خلال *دقيقتين*، لذلك اعتبرك النظام *منسحبًا*.\n\n💰 الجائزة المضمونة: *${awarded} ${currency.name}*\n⏰ مهلة إعادة اللعب: *5 دقائق*.`
    : `⏰ *انتهت مهلة الإجابة.*\n\nلم تصل إجابتك خلال *دقيقتين*، لذلك اعتُبرت الحالة *خسارة* وليست مغادرة.\n\n💰 الجائزة المضمونة: *${awarded} ${currency.name}*\n⏰ مهلة إعادة اللعب: *5 دقائق*.`;
  await sock.sendMessage(session.chatId, { text });
}
function ensurePlayerReply(session, userId, altUserId, message) {
  if (!sameUser(session.userId, userId, altUserId)) return false;
  return isReplyTo(message, session.questionMessageId);
}
async function sendQuestion(sock, session, quotedMessage, extra = '') {
  const sent = await sock.sendMessage(session.chatId, { text: questionText(session, extra) }, { quoted: quotedMessage });
  session.questionMessageId = sent?.key?.id || null;
  session.decisionMessageId = null;
  session.optionsShown = Boolean(session.displayedOptions?.length);
  session.removeAvailable = session.stage === 2 || session.stage === 3 ? session.optionsShown && !session.removeUsed : false;
  session.awaitingDecision = false;
  armTimer(sock, session, 'question');
  return sent;
}
async function startTrivia(sock, chatId, userId, message, altUserId = null) {
  if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ المسابقة متاحة داخل المجموعات فقط.' }, { quoted: message });
  if (sessions.has(chatId)) return sock.sendMessage(chatId, { text: '⚠️ توجد مسابقة قيد التشغيل في هذه المجموعة. يجب انتظار انتهائها قبل بدء مسابقة أخرى.' }, { quoted: message });
  const left = await cooldownLeft(userId);
  if (left > 0) return sock.sendMessage(chatId, { text: `⏳ لا يمكنك بدء مسابقة جديدة الآن. حاول بعد *${durationText(left)}*.` }, { quoted: message });
  const cost = competitionPrices.QUESTION_COSTS[1];
  const charged = await economy.charge(userId, cost, 'game:trivia:question1');
  if (!charged.ok) return sock.sendMessage(chatId, { text: `💸 لا تملك ما يكفي من ${currency.name} لبدء المسابقة.` }, { quoted: message });

  const session = {
    contestId: `LEO-CONTEST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    chatId, userId, altUserId,
    userIds: userKeys(userId, altUserId),
    questionNumber: 1, stage: 1,
    currentQuestion: null,
    displayedOptions: [],
    optionsShown: false,
    removeAvailable: false,
    removeUsed: false,
    usedQuestionIds: [],
    currentReward: 0,
    bankedReward: 0,
    paidReward: 0,
    lastAnsweredQuestion: 0,
    startedAt: Date.now(),
    questionMessageId: null,
    decisionMessageId: null,
    playerName: String(message?.pushName || message?.verifiedBizName || 'المتسابق').trim() || 'المتسابق',
    timerHandle: null,
    timerToken: 0,
    timerMode: 'question',
    awaitingDecision: false,
  };
  session.currentQuestion = pickQuestion(1, session.usedQuestionIds);
  session.usedQuestionIds.push(session.currentQuestion.id);
  sessions.set(chatId, session);
  try {
    await sendQuestion(sock, session, message, '💡 هذه هي بداية المسابقة. لا توجد خيارات إلا إذا طلبت المساعدة.');
  } catch (error) {
    clearTimer(session); sessions.delete(chatId);
    await economy.refund(userId, cost, 'refund:game:trivia:question1');
    throw error;
  }
}
async function requestOptions(sock, chatId, userId, message, altUserId = null) {
  const session = sessions.get(chatId);
  if (!session) return sock.sendMessage(chatId, { text: '❌ لا توجد مسابقة قيد التشغيل.' }, { quoted: message });
  if (!ensurePlayerReply(session, userId, altUserId, message)) return false;
  if (session.awaitingDecision) return false;
  const stage = session.stage;
  const cost = competitionPrices.OPTION_COSTS[stage];
  if (!cost) return sock.sendMessage(chatId, { text: '🚫 لا تتوفر الخيارات في هذه المرحلة.' }, { quoted: message });
  if (session.optionsShown) return sock.sendMessage(chatId, { text: 'ℹ️ الخيارات مفتوحة بالفعل لهذا السؤال.' }, { quoted: message });
  clearTimer(session);
  const charged = await economy.charge(userId, cost, `game:trivia:options:${stage}`);
  if (!charged.ok) { armTimer(sock, session, 'question'); return sock.sendMessage(chatId, { text: `💸 لا تملك ما يكفي من ${currency.name} لاستخدام هذه المساعدة.` }, { quoted: message }); }
  try {
    session.displayedOptions = makeDisplayedOptions(session.currentQuestion, stage);
    await sendQuestion(sock, session, message, '🆘 تم تفعيل المساعدة الأساسية.');
  } catch (error) {
    session.displayedOptions = [];
    await economy.refund(userId, cost, `refund:game:trivia:options:${stage}`);
    armTimer(sock, session, 'question');
    throw error;
  }
  return true;
}
async function removeOption(sock, chatId, userId, message, altUserId = null) {
  const session = sessions.get(chatId);
  if (!session || !ensurePlayerReply(session, userId, altUserId, message)) return false;
  const cost = competitionPrices.REMOVE_OPTION_COSTS[session.stage];
  if (!cost) return sock.sendMessage(chatId, { text: '🚫 لا تتوفر هذه المساعدة في هذه المرحلة.' }, { quoted: message });
  if (!session.optionsShown) return sock.sendMessage(chatId, { text: '⚠️ يجب استخدام مساعدة الخيارات أولًا.' }, { quoted: message });
  if (session.removeUsed) return sock.sendMessage(chatId, { text: 'ℹ️ تم استخدام حذف خيار لهذا السؤال بالفعل.' }, { quoted: message });
  clearTimer(session);
  const charged = await economy.charge(userId, cost, `game:trivia:remove-option:${session.stage}`);
  if (!charged.ok) { armTimer(sock, session, 'question'); return sock.sendMessage(chatId, { text: `💸 لا تملك ما يكفي من ${currency.name} لاستخدام هذه المساعدة.` }, { quoted: message }); }
  const wrongIndexes = session.displayedOptions.map((v, i) => normalizeAnswer(v) === normalizeAnswer(session.currentQuestion.answer) ? -1 : i).filter(i => i >= 0);
  if (!wrongIndexes.length) {
    await economy.refund(userId, cost, `refund:game:trivia:remove-option:${session.stage}`);
    armTimer(sock, session, 'question');
    return sock.sendMessage(chatId, { text: '❌ تعذر تنفيذ الحذف بأمان، وتمت إعادة الرصيد.' }, { quoted: message });
  }
  const removeIndex = wrongIndexes[Math.floor(Math.random() * wrongIndexes.length)];
  session.displayedOptions = session.displayedOptions.filter((_, i) => i !== removeIndex);
  session.removeUsed = true;
  session.removeAvailable = false;
  await sendQuestion(sock, session, message, '🗑️ حُذف خيار خاطئ. الإجابة الصحيحة لم تُحذف.');
  return true;
}
async function continueTrivia(sock, chatId, userId, message, altUserId = null) {
  const session = sessions.get(chatId);
  if (!session || !sameUser(session.userId, userId, altUserId) || !session.awaitingDecision || !isReplyTo(message, session.decisionMessageId)) return false;
  clearTimer(session);
  const next = session.questionNumber + 1;
  if (next > config.TOTAL_QUESTIONS) return false;
  const cost = competitionPrices.QUESTION_COSTS[next];
  const charged = await economy.charge(userId, cost, `game:trivia:question${next}`);
  if (!charged.ok) {
    sessions.delete(chatId);
    await setCooldown(userId, config.NORMAL_COOLDOWN_MS);
    saveRecord(session, 'توقف لعدم كفاية الرصيد', session.bankedReward);
    return sock.sendMessage(chatId, { text: `💸 لا تملك ما يكفي من ${currency.name} لدخول السؤال التالي.\n\n🏦 آخر جائزة مضمونة محفوظة لك.\n⏰ مهلة إعادة اللعب: *5 دقائق*.` }, { quoted: message });
  }
  session.questionNumber = next;
  session.stage = stageFor(next);
  session.currentQuestion = pickQuestion(session.stage, session.usedQuestionIds);
  session.usedQuestionIds.push(session.currentQuestion.id);
  session.displayedOptions = [];
  session.optionsShown = false;
  session.removeAvailable = false;
  session.removeUsed = false;
  session.awaitingDecision = false;
  return sendQuestion(sock, session, message, '🔥 المخاطرة مستمرة. أجب بالرد على رسالة هذا السؤال.');
}
async function leaveTrivia(sock, chatId, userId, message, confirm = false, altUserId = null) {
  const session = sessions.get(chatId);
  if (!session || !sameUser(session.userId, userId, altUserId) || !isReplyTo(message, session.awaitingDecision ? session.decisionMessageId : session.questionMessageId)) return false;
  if (!confirm && !session.awaitingDecision) return sock.sendMessage(chatId, { text: '⚠️ *تأكيد المغادرة*\n\nستحصل على جائزة آخر سؤال تمت إجابته.\n\n↩️ أرسل *مغادرة نعم* بالرد على رسالة السؤال الحالية للتأكيد.' }, { quoted: message });
  clearTimer(session);
  sessions.delete(chatId);
  await setCooldown(userId, config.LEAVE_COOLDOWN_MS);
  const awarded = Math.max(Number(session.currentReward || 0), Number(session.bankedReward || 0));
  await creditUpTo(session, awarded);
  saveRecord(session, 'مغادرة اختيارية', awarded, { cooldownMs: config.LEAVE_COOLDOWN_MS });
  await sendPrizeCheque(sock, session, awarded, 'مغادرة اختيارية');
  return sock.sendMessage(chatId, { text: `🚪 *تمت المغادرة بنجاح.*\n\n💰 الجائزة المصروفة: *${awarded} ${currency.name}*\n🏆 آخر سؤال أجبت عنه: *${session.lastAnsweredQuestion}*\n⏰ مهلة إعادة اللعب: *15 دقيقة*\n\n📒 تم حفظ النتيجة في سجل المسابقات.` }, { quoted: message });
}
async function answerTrivia(sock, chatId, answer, userId, message, altUserId = null) {
  const session = sessions.get(chatId);
  if (!session || !sameUser(session.userId, userId, altUserId) || !isReplyTo(message, session.awaitingDecision ? session.decisionMessageId : session.questionMessageId)) return false;
  const cmd = parseCommand(answer);
  if (session.awaitingDecision) {
    if (cmd === 'استمرار' || cmd === 'متابعة') return continueTrivia(sock, chatId, userId, message, altUserId);
    if (cmd === 'مغادرة' || cmd === 'مغادره') return leaveTrivia(sock, chatId, userId, message, true, altUserId);
    if (cmd === 'مغادرة نعم' || cmd === 'مغادره نعم' || cmd === 'مغادرةنعم') return leaveTrivia(sock, chatId, userId, message, true, altUserId);
    return true;
  }
  if (cmd === 'خيارات' || cmd === 'خيارات_المسابقة' || cmd === 'خيارات المسابقة') return requestOptions(sock, chatId, userId, message, altUserId);
  if (cmd === 'حذف_خيار' || cmd === 'حذف خيار') return removeOption(sock, chatId, userId, message, altUserId);
  if (cmd === 'مغادرة' || cmd === 'مغادره') return leaveTrivia(sock, chatId, userId, message, false, altUserId);
  if (cmd === 'مغادرة نعم' || cmd === 'مغادره نعم' || cmd === 'مغادرةنعم') return leaveTrivia(sock, chatId, userId, message, true, altUserId);
  const value = normalizeAnswer(answer);
  if (!value) return true;
  clearTimer(session);
  let submitted = value;
  if (session.optionsShown) {
    let idx = optionLetterIndex(value, session.displayedOptions.length);
    if (idx < 0) idx = session.displayedOptions.findIndex(option => normalizeAnswer(option) === value);
    if (idx < 0) { armTimer(sock, session, 'question'); return true; }
    submitted = normalizeAnswer(session.displayedOptions[idx]);
  }
  const correct = normalizeAnswer(session.currentQuestion.answer);
  if (submitted !== correct) return finishLoss(sock, session, 'خسارة');

  session.lastAnsweredQuestion = session.questionNumber;
  session.currentReward = cumulativeReward(session.questionNumber);
  if (safeQuestion(session.questionNumber)) {
    session.bankedReward = session.currentReward;
    await creditUpTo(session, session.bankedReward);
    session.awaitingDecision = true;
    session.removeAvailable = false;
    armTimer(sock, session, 'decision');
    const q = session.questionNumber;
    const final = q === config.TOTAL_QUESTIONS;
    if (final) {
      clearTimer(session); sessions.delete(chatId);
      await setCooldown(userId, config.NORMAL_COOLDOWN_MS);
      saveRecord(session, 'فوز كامل', session.currentReward, { cooldownMs: config.NORMAL_COOLDOWN_MS });
      await sendPrizeCheque(sock, session, session.currentReward, 'فوز كامل');
      return sock.sendMessage(chatId, { text: `🏆 *مبروك! أكملت المسابقة.*\n\n💰 الجائزة النهائية: *${session.currentReward} ${currency.name}*\n📈 إجمالي تكاليف الأسئلة: *${cumulativeCost(q)} ${currency.name}*\n⏰ يمكنك بدء مسابقة جديدة بعد *5 دقائق*.\n\n📒 تم حفظ النتيجة في سجل المسابقات.` }, { quoted: message });
    }
    const next = q + 1;
    const decision = await sock.sendMessage(chatId, { text: `🎉 *إجابة صحيحة!*\n\n🛡️ *نقطة أمان ${q}*\n💰 الجائزة المضمونة الآن: *${session.bankedReward} ${currency.name}*\n\n🔥 هل تريد المخاطرة بالسؤال *${next}*؟\n\n⏱️ لديك *دقيقتان* لاتخاذ القرار. إذا لم ترد، يعتبرك النظام منسحبًا وتحصل على آخر جائزة مضمونة فقط.\n\n↩️ *استمرار* أو *مغادرة*\n📌 *يجب أن ترد على هذه الرسالة نفسها.*` }, { quoted: message });
    session.decisionMessageId = decision?.key?.id || null;
    return decision;
  }
  session.stage = stageFor(session.questionNumber);
  const next = session.questionNumber + 1;
  if (next > config.TOTAL_QUESTIONS) return false;
  const cost = competitionPrices.QUESTION_COSTS[next];
  const charged = await economy.charge(userId, cost, `game:trivia:question${next}`);
  if (!charged.ok) {
    sessions.delete(chatId);
    await setCooldown(userId, config.NORMAL_COOLDOWN_MS);
    saveRecord(session, 'توقف لعدم كفاية الرصيد', session.bankedReward);
    return sock.sendMessage(chatId, { text: `💸 إجابة صحيحة، لكن لا تملك ما يكفي من ${currency.name} لدخول السؤال التالي.\n\n🏦 آخر جائزة مضمونة محفوظة لك.\n⏰ مهلة إعادة اللعب: *5 دقائق*.` }, { quoted: message });
  }
  session.questionNumber = next;
  session.stage = stageFor(next);
  session.currentQuestion = pickQuestion(session.stage, session.usedQuestionIds);
  session.usedQuestionIds.push(session.currentQuestion.id);
  session.displayedOptions = [];
  session.optionsShown = false;
  session.removeAvailable = false;
  session.removeUsed = false;
  session.awaitingDecision = false;
  return sendQuestion(sock, session, message, '✅ إجابة صحيحة! انتقلت للسؤال التالي.');
}
function historyFor(userId) { return history.latest(userId); }
async function contestHistoryCommand(sock, chatId, userId, message) {
  const record = historyFor(userId);
  if (!record) return sock.sendMessage(chatId, { text: '📒 لا يوجد سجل مسابقات لهذا الحساب بعد.' }, { quoted: message });
  const text = `╭━━━〔 📒 سجل المسابقات 〕━━━╮\n┃ النتيجة: *${record.result}*\n┃ آخر سؤال تمت إجابته: *${record.lastAnsweredQuestion || 0}/${config.TOTAL_QUESTIONS}*\n┃ أعلى مرحلة: *${record.stageReached || 0}/4*\n┃ الجائزة المضمونة: *${record.bankedReward || 0} ${currency.name}*\n┃ الجائزة المصروفة: *${record.awarded || 0} ${currency.name}*\n┃ التكاليف حتى نهاية الجولة: *${record.totalQuestionCosts || 0} ${currency.name}*\n┃ التاريخ: *${new Date(record.endedAt).toLocaleString('ar-EG')}*\n╰━━━━━━━━━━━━━━━━━━━━━━╯`;
  return sock.sendMessage(chatId, { text }, { quoted: message });
}
function isTriviaActive(chatId) { return sessions.has(chatId); }
module.exports = { startTrivia, answerTrivia, requestOptions, removeOption, leaveTrivia, continueTrivia, isTriviaActive, contestHistoryCommand, getQuotedId, makePrizeCheque };
