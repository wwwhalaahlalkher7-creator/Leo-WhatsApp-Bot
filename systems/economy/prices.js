'use strict';

// Ordinary command costs are intentionally zero during the economy redesign.
// Competition is excluded and owns its immutable table under competition/economy.
const PRICES = Object.freeze({
  ai: 0,
  imagine: 0,
  image: 0,
  searchImage: 0,
  sora: 0,
  song: 0,
  video: 0,
  download: 0,
  tictactoe: 0,
  hangman: 0,
  trivia: 0,
  hangmanHint1: 0,
  hangmanHint2: 0,
  work: 0,
});

// Fixed game rewards remain centralized here until the final economy rebalance.
// They are intentionally not zeroed because they are rewards, not usage costs.
const REWARDS = Object.freeze({
  tictactoe: 12,
  hangman: 10,
});

// Work earnings are kept here so the command contains behavior, not economy values.
const EARNINGS = Object.freeze({
  jobs: Object.freeze([
    { title: 'عامل نظافة', min: 10, max: 22, weight: 18, text: 'نظفت شارعًا في الحي' },
    { title: 'مساعد متجر', min: 14, max: 28, weight: 17, text: 'رتبت البضاعة وساعدت الزبائن' },
    { title: 'سائق توصيل', min: 18, max: 36, weight: 15, text: 'أنجزت عدة طلبات توصيل' },
    { title: 'طباخ', min: 20, max: 40, weight: 13, text: 'جهزت وجبات لزبائن المطعم' },
    { title: 'مصمم', min: 24, max: 48, weight: 11, text: 'أنجزت تصميمًا لعميل' },
    { title: 'مصور', min: 26, max: 52, weight: 9, text: 'صورت جلسة قصيرة' },
    { title: 'مبرمج', min: 30, max: 60, weight: 7, text: 'أصلحت أخطاء في مشروع' },
    { title: 'مهندس', min: 34, max: 68, weight: 5, text: 'أنجزت مهمة هندسية' },
    { title: 'طبيب مناوب', min: 38, max: 76, weight: 3, text: 'أنهيت مناوبة شاقة' },
    { title: 'مستشار أعمال', min: 42, max: 84, weight: 2, text: 'قدمت استشارة ناجحة' },
  ]),
  performanceChance: 0.12,
  performanceMinBonus: 2,
  performanceRate: 0.2,
});

function getPrice(key) {
  return Number(PRICES[key] ?? 0);
}

function getReward(key) {
  return Number(REWARDS[key] ?? 0);
}

module.exports = Object.freeze({ PRICES, REWARDS, EARNINGS, getPrice, getReward });
