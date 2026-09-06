'use strict';

const observability = require('../systems/observability');
const providerHealth = require('../lib/providers/core/health');
const retry = require('../lib/providers/core/retry');
const providerTelemetry = require('../lib/providers/core/telemetry');
const registry = require('../lib/command-registry');
const isOwnerOrSudo = require('../lib/isOwner');
const { createLeoFrame } = require('../systems/ui/frame');
const { isBotEnabled, getGroupStats } = require('../lib/access-control');
const bankManagerCommand = require('../lib/internal/bank-manager');

function fmtDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('ar', { hour12: false }); } catch { return String(value); }
}

function formatDuration(ms) {
  let seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const d = Math.floor(seconds / 86400); seconds %= 86400;
  const h = Math.floor(seconds / 3600); seconds %= 3600;
  const m = Math.floor(seconds / 60); seconds %= 60;
  const parts = [];
  if (d) parts.push(`${d} يوم`);
  if (h) parts.push(`${h} ساعة`);
  if (m) parts.push(`${m} دقيقة`);
  if (!parts.length || seconds) parts.push(`${seconds} ثانية`);
  return parts.join(' و ');
}

function statusText(entry) {
  if (!entry) return 'لم يُستعمل بعد ⏺️';
  if (entry.status === 'success') return `نجاح ✅ — ${fmtDate(entry.usedAt)}${entry.durationMs != null ? ` — ${entry.durationMs}ms` : ''}`;
  return `فشل ❌ — ${fmtDate(entry.usedAt)}${entry.durationMs != null ? ` — ${entry.durationMs}ms` : ''}\n   السبب: ${entry.reason || 'غير محدد'}`;
}

function providerStatusText(item) {
  if (item.status === 'open') return `مفتوح 🔴${item.cooldownRemainingMs ? ` (${Math.ceil(item.cooldownRemainingMs / 1000)}ث)` : ''}`;
  if (item.status === 'half-open') return 'اختبار 🟡';
  if (item.status === 'degraded') return 'متدهور 🟠';
  return 'سليم 🟢';
}

async function monitorCommand(sock, chatId, message, args = []) {
  const senderId = message?.key?.participant || message?.key?.remoteJid;
  const alt = message?.key?.participantAlt || message?.key?.remoteJidAlt || null;
  const allowed = message?.key?.fromMe || await isOwnerOrSudo(senderId, sock, chatId, alt);
  if (!allowed) return sock.sendMessage(chatId, { text: '❌ هذا الأمر للمالك فقط.' }, { quoted: message });

  const sub = String(args[0] || '').trim().toLowerCase();
  const normalizedSub = sub.replace(/^ال/, '');

  // Bank administration is now a sub-area of the owner monitoring dashboard.
  if (['بنك', 'bank', 'bank-manager', 'bankadmin'].includes(sub)) {
    return bankManagerCommand(sock, chatId, senderId, message, args.slice(1));
  }

  if (['اوامر', 'الأوامر', 'الاوامر', 'commands', 'command'].includes(sub)) {
    const commands = registry.all().filter(c => c.helpVisible !== false).sort((a, b) => String(a.localizedName || a.name).localeCompare(String(b.localizedName || b.name), 'ar'));
    const tracked = observability.all();
    const lines = ['📋 آخر حالة مسجلة للأوامر', `إجمالي الأوامر: ${commands.length}`, ''];
    for (const command of commands) {
      const entry = tracked[command.name];
      const label = command.localizedName || command.name;
      if (!entry) lines.push(`• ${label} — لم يُستعمل بعد ⏺️`);
      else if (entry.status === 'success') lines.push(`• ${label} — نجاح ✅ | ${fmtDate(entry.usedAt)}${entry.durationMs != null ? ` | ${entry.durationMs} مللي ثانية` : ''}`);
      else lines.push(`• ${label} — فشل ❌ | ${fmtDate(entry.usedAt)}${entry.reason ? ` | ${entry.reason}` : ''}`);
    }
    await sock.sendMessage(chatId, { text: createLeoFrame('مراقبة الأوامر', lines.join('\n')) }, { quoted: message });
    return;
  }

  if (['providers', 'provider', 'مزود', 'مزودات', 'المزودات', 'المزود'].includes(sub) || ['مزودات'].includes(normalizedSub)) {
    const snapshot = providerHealth.snapshot();
    const telemetry = providerTelemetry.snapshot();
    const lines = [
      '🛰️ حالة الخدمات الداخلية',
      `• إعادة المحاولة: حتى ${retry.DEFAULTS.maxRetries} مرات`,
      `• التأخير التدريجي: ${retry.DEFAULTS.baseDelayMs}ms → ${retry.DEFAULTS.maxDelayMs}ms`,
      `• حد انتظار إعادة المحاولة: ${retry.DEFAULTS.retryAfterMaxMs}ms`,
      `• عمليات إعادة المحاولة المسجلة: ${telemetry.retries.length}`,
      `• عمليات الانتقال البديل المسجلة: ${telemetry.fallbacks.length}`,
      '• تصنيف الأخطاء: مؤقت / دائم / غير محدد',
      '• توحيد النتائج: مفعّل',
      '• الانتقال التلقائي للبديل: مفعّل',
      '',
    ];
    if (telemetry.retries.length) {
      const r = telemetry.retries[telemetry.retries.length - 1];
      lines.push(`• آخر إعادة محاولة: ${r.provider || 'غير معروف'} | المحاولة ${r.attempt} | الانتظار ${r.delayMs}ms | ${r.classification || 'غير محدد'}${r.code ? ` | ${r.code}` : ''}`);
    }
    if (telemetry.fallbacks.length) {
      const f = telemetry.fallbacks[telemetry.fallbacks.length - 1];
      lines.push(`• آخر انتقال بديل: ${f.label || 'عملية'} → ${f.provider || 'غير معروف'} | ${f.outcome}${f.reason ? ` | ${f.reason}` : ''}`);
    }
    if (!snapshot.length) lines.push('لا توجد حالة خدمات مسجلة في هذه الجلسة حاليًا.');
    else for (const item of snapshot) {
      lines.push(`• ${item.name}: ${providerStatusText(item)} | نجاح ${item.successes} | إخفاق ${item.failures}`);
      if (item.lastErrorClass) lines.push(`  ↳ التصنيف: ${item.lastErrorClass}`);
      if (item.latencyMs != null) lines.push(`  ↳ آخر استجابة: ${item.latencyMs}ms`);
    }
    await sock.sendMessage(chatId, { text: createLeoFrame('مراقبة الخدمات', lines.join('\n')) }, { quoted: message });
    return;
  }

  if (['نظام', 'النظام', 'system', 'status', 'حالة'].includes(sub)) {
    const mem = process.memoryUsage();
    const snapshot = providerHealth.snapshot();
    const groups = getGroupStats();
    const summary = observability.summarize();
    const open = snapshot.filter(x => x.status === 'open').length;
    const degraded = snapshot.filter(x => x.status === 'degraded').length;
    const mb = n => `${Math.round(n / 1024 / 1024)} MB`;
    const lines = [
      '🖥️ حالة تشغيل البوت',
      `• الإصدار: ${require('../package.json').version}`,
      `• الحالة: ${isBotEnabled() ? 'يعمل 🟢' : 'متوقف ⏸️'}`,
      `• مدة التشغيل: ${formatDuration(process.uptime() * 1000)}`,
      `• الذاكرة المستخدمة: ${mb(mem.rss)}`,
      `• ذاكرة JavaScript: ${mb(mem.heapUsed)} / ${mb(mem.heapTotal)}`,
      '',
      '👥 المجموعات',
      `• المسجلة: ${groups.total}`,
      `• المعتمدة: ${groups.approved}`,
      `• بانتظار الموافقة: ${groups.pending.length}`,
      '',
      '📊 النشاط',
      `• أوامر لها سجل: ${summary.totalTracked}`,
      `• آخرها ناجح: ${summary.success}`,
      `• آخرها فاشل: ${summary.failure}`,
      '',
      '🛰️ الخدمات',
      `• مفتوحة مؤقتًا: ${open}`,
      `• متدهورة: ${degraded}`,
      `• إعادة المحاولة والبدائل: مفعّلة`,
    ];
    await sock.sendMessage(chatId, { text: createLeoFrame('حالة النظام', lines.join('\n')) }, { quoted: message });
    return;
  }

  const summary = observability.summarize();
  const total = registry.all().filter(c => c.helpVisible !== false).length;
  const snapshot = providerHealth.snapshot();
  const groups = getGroupStats();
  const open = snapshot.filter(x => x.status === 'open').length;
  const degraded = snapshot.filter(x => x.status === 'degraded').length;
  const lines = [
    `الإصدار: ${require('../package.json').version}`,
    `حالة البوت: ${isBotEnabled() ? 'يعمل 🟢' : 'متوقف ⏸️'}`,
    '',
    '📊 النشاط',
    `• الأوامر المسجلة: ${total}`,
    `• لها استعمال مسجل: ${summary.totalTracked}`,
    `• آخر استعمال ناجح: ${summary.success}`,
    `• آخر استعمال فاشل: ${summary.failure}`,
    '',
    '👥 المجموعات',
    `• المسجلة: ${groups.total}`,
    `• المعتمدة: ${groups.approved}`,
    `• بانتظار الموافقة: ${groups.pending.length}`,
    '',
    '🛰️ الخدمات الداخلية',
    `• مفتوحة: ${open}`,
    `• متدهورة: ${degraded}`,
    `• إعادة المحاولة + البدائل: مفعّلة`,
    '',
    '📌 التفاصيل:',
    '• `.مراقبة الأوامر` — حالة كل أمر',
    '• `.مراقبة المزودات` — حالة الخدمات وإعادة المحاولة',
    '• `.مراقبة النظام` — التشغيل والذاكرة والمجموعات',
    '• `.مراقبة بنك` — اقتصاد البنك والاشتراكات وإدارة الرصيد',
  ];
  await sock.sendMessage(chatId, { text: createLeoFrame('لوحة مراقبة ليو', lines.join('\n')) }, { quoted: message });
}

module.exports = monitorCommand;
