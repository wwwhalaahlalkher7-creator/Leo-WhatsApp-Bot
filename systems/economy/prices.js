'use strict';

/**
 * General Leo economy price table.
 *
 * The competition economy is the benchmark for value. Its mechanics and
 * prices are intentionally untouched; this table only aligns the rest of Leo
 * with the same denomination/scale.
 */
const PRICES = Object.freeze({
  // Core AI/services: scaled from the competition's 5/10/20/25/50 ladder.
  ai: 25,
  imagine: 50,
  image: 5,
  searchImage: 5,
  sora: 100,
  song: 20,
  video: 50,
  download: 10,

  // Games: same economy scale; gameplay mechanics are unchanged.
  tictactoe: 25,
  hangman: 25,
  trivia: 0,
  hangmanHint1: 10,
  hangmanHint2: 20,

  // Work has no entry fee; its payout values are defined below.
  work: 0,
});

const REWARDS = Object.freeze({
  tictactoe: 50,
  hangman: 50,
});

/**
 * Income values only. Cooldowns, weighting and bonus logic remain unchanged.
 * Values use the same 5-neuron denomination as the competition economy.
 */
const EARNINGS = Object.freeze({
  jobs: Object.freeze([
    { title: 'عامل نظافة', min: 25, max: 50, weight: 18, text: 'نظفت شارعًا في الحي' },
    { title: 'مساعد متجر', min: 35, max: 60, weight: 17, text: 'رتبت البضاعة وساعدت الزبائن' },
    { title: 'سائق توصيل', min: 45, max: 75, weight: 15, text: 'أنجزت عدة طلبات توصيل' },
    { title: 'طباخ', min: 50, max: 80, weight: 13, text: 'جهزت وجبات لزبائن المطعم' },
    { title: 'مصمم', min: 60, max: 95, weight: 11, text: 'أنجزت تصميمًا لعميل' },
    { title: 'مصور', min: 65, max: 100, weight: 9, text: 'صورت جلسة قصيرة' },
    { title: 'مبرمج', min: 75, max: 125, weight: 7, text: 'أصلحت أخطاء في مشروع' },
    { title: 'مهندس', min: 85, max: 135, weight: 5, text: 'أنجزت مهمة هندسية' },
    { title: 'طبيب مناوب', min: 95, max: 150, weight: 3, text: 'أنهيت مناوبة شاقة' },
    { title: 'مستشار أعمال', min: 105, max: 175, weight: 2, text: 'قدمت استشارة ناجحة' },
  ]),
  performanceChance: 0.12,
  performanceMinBonus: 5,
  performanceRate: 0.2,
});

function getPrice(key) {
  return Number(PRICES[key] ?? 0);
}

function getReward(key) {
  return Number(REWARDS[key] ?? 0);
}

module.exports = Object.freeze({ PRICES, REWARDS, EARNINGS, getPrice, getReward });
