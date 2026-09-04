'use strict';

function pluralize(number, singular, dual, plural) {
  const n = Math.abs(Number(number) || 0);
  if (n === 1) return singular;
  if (n === 2) return dual;
  if (n >= 3 && n <= 10) return plural;
  return singular;
}

function formatDuration(ms) {
  let remaining = Math.max(0, Math.ceil(Number(ms) || 0));
  const totalSeconds = Math.ceil(remaining / 1000);
  if (totalSeconds < 60) return `${totalSeconds} ${pluralize(totalSeconds, 'ثانية', 'ثانيتين', 'ثوانٍ')}`;

  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} ${pluralize(totalMinutes, 'دقيقة', 'دقيقتين', 'دقائق')}`;

  const totalHours = Math.ceil(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours} ${pluralize(totalHours, 'ساعة', 'ساعتين', 'ساعات')}`;

  const totalDays = Math.ceil(totalHours / 24);
  return `${totalDays} ${pluralize(totalDays, 'يوم', 'يومين', 'أيام')}`;
}

function waitMessage(remainingMs) {
  return `⏳ تم استخدام الأمر مؤخرًا.\n\n🕐 حاول مرة أخرى بعد: *${formatDuration(remainingMs)}*`;
}

module.exports = { formatDuration, waitMessage };
