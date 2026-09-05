const economySystem = require('../systems/economy');
const currency = require('../systems/economy/currency');
const economyMessages = require('../systems/economy/messages');
const interaction = require('../systems/interaction');
const xp = require('../systems/xp');
const subscriptions = require('../systems/subscriptions');
const economy = economySystem.createEconomy();
const COST = economy.cost('hangman');
const REWARD = economy.rewardAmount('hangman');
const MAX_WRONG = 6;
const GAME_TIMEOUT_MS = 2 * 60 * 1000;
const HINT_COSTS = [economy.cost('hangmanHint1'), economy.cost('hangmanHint2')];

// كلمات عربية شائعة، مع أدلة تدريجية: الدليل الأول مقصود أن يكون غير مباشر.
const WORDS = [
  ['مدرسة','مكان يجتمع فيه الناس للتعلم.','توجد فيها فصول.','يذهب إليها الطلاب.'],
  ['مكتبة','مكان يحتوي على أشياء كثيرة يمكن قراءتها.','تضم رفوفًا كثيرة.','توجد فيها الكتب.'],
  ['طائرة','وسيلة نقل لا تسير على الأرض.','تحتاج إلى الإقلاع.','تحلق في السماء.'],
  ['سيارة','وسيلة نقل شائعة لها عجلات.','تستخدم في التنقل.','تسير على الطرق.'],
  ['هاتف','جهاز صغير يستخدم للتواصل.','يحمل في اليد غالبًا.','يمكن إجراء المكالمات به.'],
  ['حاسوب','جهاز يستخدم للعمل والتعلم والترفيه.','له شاشة ولوحة مفاتيح غالبًا.','يستخدم لتشغيل البرامج.'],
  ['شمس','شيء نراه في السماء نهارًا.','مصدر مهم للضوء والحرارة.','تشرق من جهة الشرق.'],
  ['قمر','جسم نراه في السماء ليلًا.','يتغير شكله الظاهر خلال الشهر.','يدور حول الأرض.'],
  ['بحر','مسطح مائي واسع.','ماؤه مالح غالبًا.','تسبح فيه الأسماك والسفن.'],
  ['جبل','جزء مرتفع من سطح الأرض.','قد يكون صخريًا أو مغطى بالنبات.','له قمة مرتفعة.'],
  ['مطر','شيء يسقط من السماء.','يرتبط بالسحب.','الماء فيه ينزل على الأرض.'],
  ['نهر','مجرى مائي طبيعي.','يمتد لمسافات طويلة.','تجري فيه المياه نحو مكان آخر.'],
  ['كتاب','شيء يمكن قراءته.','قد يحتوي على فصول وصفحات.','يتكون عادة من صفحات.'],
  ['قلم','أداة صغيرة للكتابة.','يمكن حملها باليد.','تترك أثرًا على الورق.'],
  ['ساعة','شيء يساعد على معرفة شيء يتغير باستمرار.','قد تكون في اليد أو الحائط.','تخبرك بالوقت.'],
  ['مفتاح','شيء صغير قد يفتح شيئًا مغلقًا.','يوضع في مكان مخصص.','يستخدم لفتح القفل.'],
  ['باب','جزء من مبنى يمكن فتحه وإغلاقه.','يفصل بين مكانين غالبًا.','ندخل ونخرج من خلاله.'],
  ['نافذة','جزء من المبنى يسمح بمرور الضوء والهواء.','تكون في الجدار.','يمكن النظر من خلالها إلى الخارج.'],
  ['كرسي','شيء يستخدمه الإنسان للجلوس.','يوجد في المنازل والأماكن العامة.','له مقعد وقد تكون له مساند.'],
  ['طاولة','قطعة أثاث لها سطح مستوٍ.','توضع عليها الأشياء.','تستخدم للأكل أو العمل.'],
  ['مطبخ','مكان مرتبط بإعداد الطعام.','توجد فيه أدوات وأجهزة كثيرة.','يُطهى فيه الطعام.'],
  ['حديقة','مكان يحتوي عادة على نباتات وأشجار.','قد توجد فيه ممرات ومقاعد.','مكان مناسب للتنزه.'],
  ['زهرة','جزء جميل من بعض النباتات.','قد تكون لها ألوان وروائح مختلفة.','تظهر على النبات في مواسم معينة.'],
  ['شجرة','نبات كبير له جذع.','قد يعيش سنوات طويلة.','له أغصان وأوراق.'],
  ['تفاحة','نوع من الفاكهة.','قد تكون حمراء أو خضراء.','فاكهة مستديرة شائعة.'],
  ['برتقال','فاكهة ذات قشرة خارجية.','غنية بالعصير.','لونها الشائع برتقالي.'],
  ['موزة','فاكهة سهلة التقشير.','شكلها منحني.','لونها الأصفر شائع عند النضج.'],
  ['أسد','حيوان بري قوي.','يعيش في مجموعات أحيانًا.','يُعرف بلقب ملك الغابة.'],
  ['فيل','حيوان بري ضخم.','له أذنان كبيرتان.','له خرطوم طويل.'],
  ['حصان','حيوان يمكن ركوبه.','يستخدم في بعض السباقات.','له حوافر وذيل وشعر طويل في رقبته.'],
  ['سمكة','حيوان يعيش في الماء.','تتحرك باستخدام زعانف.','تتنفس في الماء بالخياشيم.'],
  ['فراشة','حشرة رقيقة الأجنحة.','تبدأ حياتها بشكل مختلف.','لها أجنحة ملونة غالبًا.'],
  ['نحلة','حشرة اجتماعية تعيش في جماعات.','تتنقل بين الأزهار.','تنتج العسل.'],
  ['ثلج','شيء أبيض قد يغطي الأرض في البرد الشديد.','مرتبط بانخفاض الحرارة.','هو ماء متجمد.'],
  ['نار','شيء يحتاج إلى الحذر منه.','تنتج حرارة وضوءًا.','تستخدم في الطهي والتدفئة.'],
  ['مطرقة','أداة تستخدم في الأعمال اليدوية.','لها مقبض ورأس صلب.','تستخدم للطرق.'],
  ['مرآة','شيء يعكس صورة ما أمامه.','توجد كثيرًا في المنازل.','يمكنك رؤية نفسك فيها.'],
  ['وسادة','شيء ناعم يستخدم للراحة.','توضع غالبًا على السرير.','تسند الرأس أثناء النوم.'],
  ['بطانية','شيء يستخدم للشعور بالدفء.','تستخدم كثيرًا في الليل.','تغطّي الجسم أثناء النوم.'],
  ['مظلة','أداة تحمي من شيء يسقط من السماء.','تفتح وتغلق.','تستخدم كثيرًا أثناء المطر.'],
];

const games = new Map();

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function maskWord(word, guessed) {
  return Array.from(word).map(ch => guessed.has(ch) ? ch : '＿').join(' ');
}

function drawing(wrong) {
  const stages = [
`  +---+
  |   |
      |
      |
      |
=========`,
`  +---+
  |   |
  O   |
      |
      |
=========`,
`  +---+
  |   |
  O   |
  |   |
      |
=========`,
`  +---+
  |   |
  O   |
 /|   |
      |
=========`,
`  +---+
  |   |
  O   |
 /|\  |
      |
=========`,
`  +---+
  |   |
  O   |
 /|\  |
 /    |
=========`,
`  +---+
  |   |
  O   |
 /|\  |
 / \  |
=========`,
  ];
  return stages[Math.min(wrong, MAX_WRONG)];
}

function samePlayer(game, userId) {
  return game && economy.normalizeId(game.userId) === economy.normalizeId(userId);
}

function clearGameTimer(game) {
  if (game?.timerHandle) clearTimeout(game.timerHandle);
  if (game) game.timerHandle = null;
}

function remainingSeconds(game) {
  return Math.max(0, Math.ceil((Number(game?.deadlineAt || Date.now()) - Date.now()) / 1000));
}

function armGameTimer(sock, chatId, game) {
  clearGameTimer(game);
  const remaining = Math.max(1, Number(game.deadlineAt || 0) - Date.now());
  game.timerHandle = setTimeout(async () => {
    if (games.get(chatId) !== game) return;
    games.delete(chatId);
    game.timerHandle = null;
    await sock.sendMessage(chatId, {
      text: `⏰ *انتهى وقت لعبة «خمن».*\n\n🔤 الكلمة كانت: *${game.word}*\n💸 رسوم البداية لم تُسترد.`
    });
  }, remaining);
}

function gameText(game) {
    const options = [];
  if (game.hints === 0) options.push(`🔎 الدليل الأول: ${currency.amount(HINT_COSTS[0])} — اكتب *دليل* بالرد على رسالة اللعبة`);
  else if (game.hints === 1) options.push(`🔎 الدليل الثاني: ${currency.amount(HINT_COSTS[1])} — اكتب *دليل* بالرد على رسالة اللعبة`);
  return `🎯 *لعبة «خمن»*\n\n🔤 الكلمة: ${maskWord(game.word, game.guessed)}\n\n💡 *الدليل الابتدائي:* ${game.initialHint}\n${game.hints >= 1 ? `💡 *الدليل الأول:* ${game.hint1}\n` : ''}${game.hints >= 2 ? `💡 *الدليل الثاني:* ${game.hint2}\n` : ''}\n❌ الأخطاء: *${game.wrong}/${MAX_WRONG}*
⏱️ الوقت المتبقي: *${remainingSeconds(game)} ثانية*\n💰 رسوم البداية: *${currency.amount(COST)}*\n🏆 الجائزة عند الفوز: *${currency.amount(REWARD)}*\n\n${options.join('\n') || '✍️ أرسل حرفًا أو الكلمة كاملة.'}`;
}

async function startGuess(sock, chatId, userId, message) {
  if (games.has(chatId)) {
    const active = games.get(chatId);
    return sock.sendMessage(chatId, { text: samePlayer(active, userId) ? '⚠️ لديك لعبة «خمن» قيد التشغيل بالفعل. أرسل تخمينك أو اطلب دليلًا.' : '⚠️ توجد لعبة «خمن» قيد التشغيل لعضو آخر، ويمكن لبقية الأعضاء استخدام أوامرهم بشكل طبيعي.' }, { quoted: message });
  }
  const charged = await economy.charge(userId, COST, 'game:guess');
  if (!charged.ok) return sock.sendMessage(chatId, { text: `💸 لا تملك ما يكفي من ${currency.name}. تحتاج *${currency.amount(COST)}* لبدء لعبة خمن.` }, { quoted: message });
  const [word, initialHint, hint1, hint2] = pickWord();
  const game = { word, initialHint, hint1, hint2, guessed: new Set(), wrong: 0, hints: 0, userId, activeMessageId: null, deadlineAt: Date.now() + GAME_TIMEOUT_MS, timerHandle: null };
  games.set(chatId, game);
  const sent = await sock.sendMessage(chatId, { text: gameText(game) + '\n\n✍️ أرسل حرفًا واحدًا أو الكلمة كاملة بالرد على رسالة اللعبة.' }, { quoted: message });
  game.activeMessageId = sent?.key?.id || null;
  armGameTimer(sock, chatId, game);
  return sent;
}

async function requestHint(sock, chatId, userId, message) {
  const game = games.get(chatId);
  if (!game) return sock.sendMessage(chatId, { text: '❌ لا توجد لعبة «خمن» قيد التشغيل.' }, { quoted: message });
  if (game.activeMessageId && !interaction.isReplyTo(message, game.activeMessageId)) return false;
  if (!samePlayer(game, userId)) return sock.sendMessage(chatId, { text: '❌ لا يمكنك طلب دليل في لعبة بدأها عضو آخر.' }, { quoted: message });
  if (game.hints >= 2) return sock.sendMessage(chatId, { text: 'ℹ️ استخدمت الدليلين المتاحين لهذه اللعبة.' }, { quoted: message });
  const index = game.hints;
  const cost = HINT_COSTS[index];
  const charged = await economy.charge(userId, cost, `game:guess:hint${index + 1}`);
  if (!charged.ok) return sock.sendMessage(chatId, { text: `💸 لا تملك ما يكفي من ${currency.name}. تحتاج *${currency.amount(cost)}* لطلب هذا الدليل.` }, { quoted: message });
  game.hints += 1;
  try {
    const sent = await sock.sendMessage(chatId, { text: `${gameText(game)}\n\n🔎 تم عرض الدليل بنجاح.\n⏱️ المتبقي: *${remainingSeconds(game)} ثانية*.\n\n✍️ أرسل تخمينك بالرد على رسالة اللعبة عندما تكون جاهزًا.` }, { quoted: message });
    game.activeMessageId = sent?.key?.id || game.activeMessageId;
    return sent;
  } catch (error) {
    await economy.refund(userId, cost, `refund:game:guess:hint${index + 1}`);
    game.hints -= 1;
    return sock.sendMessage(chatId, { text: '❌ تعذر إرسال الدليل، لذلك أعدنا الرصيد الذي دفعته.' }, { quoted: message });
  }
}

async function guess(sock, chatId, input, userId, message) {
  const game = games.get(chatId);
  if (!game) return sock.sendMessage(chatId, { text: '❌ لا توجد لعبة خمن قيد التشغيل. ابدأ بـ *.خمن*.' }, { quoted: message });
  if (game.activeMessageId && !interaction.isReplyTo(message, game.activeMessageId)) return false;
  if (!samePlayer(game, userId)) return sock.sendMessage(chatId, { text: '❌ هذه اللعبة مخصصة للشخص الذي بدأها.' }, { quoted: message });
  const value = String(input || '').trim().toLowerCase();
  if (value === 'دليل' || value === 'hint') return requestHint(sock, chatId, userId, message);
  if (!value) return sock.sendMessage(chatId, { text: '✍️ أرسل حرفًا واحدًا أو الكلمة كاملة.' }, { quoted: message });
  if (value.length > 1) {
    if (value === game.word) {
      games.delete(chatId);
      clearGameTimer(game);
      const balance = await economy.reward(userId, REWARD, 'game:reward:guess');
      await xp.add(userId, Math.max(15, Math.round(25 * Number(subscriptions.get(userId)?.details?.xpBoost || 1))), 'game:win:guess');
      return sock.sendMessage(chatId, { text: `🎉 *مبروك! تخمين صحيح.*\n\n🔤 الكلمة: *${game.word}*\n🏆 الجائزة: *+${currency.amount(REWARD)}*\n💰 رصيدك الآن: *${currency.balance(balance)}*` }, { quoted: message });
    }
    game.wrong += 1;
  } else {
    if (!/^[ء-ي]$/.test(value)) return sock.sendMessage(chatId, { text: '✍️ في لعبة خمن أرسل حرفًا عربيًا واحدًا.' }, { quoted: message });
    if (game.guessed.has(value)) return sock.sendMessage(chatId, { text: `🔤 سبق أن جربت الحرف *${value}*.` }, { quoted: message });
    game.guessed.add(value);
    if (game.word.includes(value)) {
      if (!maskWord(game.word, game.guessed).includes('＿')) {
        games.delete(chatId);
        clearGameTimer(game);
        const balance = await economy.reward(userId, REWARD, 'game:reward:guess');
      await xp.add(userId, Math.max(15, Math.round(25 * Number(subscriptions.get(userId)?.details?.xpBoost || 1))), 'game:win:guess');
        return sock.sendMessage(chatId, { text: `🎉 *مبروك! خمنت الكلمة كاملة.*\n\n🔤 الكلمة: *${game.word}*\n🏆 الجائزة: *+${currency.amount(REWARD)}*\n💰 رصيدك الآن: *${currency.balance(balance)}*` }, { quoted: message });
      }
      const sent = await sock.sendMessage(chatId, { text: `${gameText(game)}\n\n✅ تخمين صحيح!` }, { quoted: message });
      game.activeMessageId = sent?.key?.id || game.activeMessageId;
      return sent;
    }
    game.wrong += 1;
  }
  if (game.wrong >= MAX_WRONG) {
    games.delete(chatId);
    clearGameTimer(game);
    return sock.sendMessage(chatId, { text: `💀 *انتهت اللعبة!*\n\n${drawing(MAX_WRONG)}\n\n🔤 الكلمة كانت: *${game.word}*\n❌ انتهت جميع المحاولات.\n💸 رسوم البداية لم تُسترد.` }, { quoted: message });
  }
  const sent = await sock.sendMessage(chatId, { text: `${gameText(game)}\n\n❌ تخمين خاطئ. بقيت *${MAX_WRONG - game.wrong}* محاولات.` }, { quoted: message });
  game.activeMessageId = sent?.key?.id || game.activeMessageId;
  return sent;
}

function isGuessActive(chatId) { return games.has(chatId); }

module.exports = { startGuess, requestHint, guess, isGuessActive };
