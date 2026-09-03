'use strict';

const observability = require('../systems/observability');
const providerHealth = require('../lib/providers/core/health');
const retry = require('../lib/providers/core/retry');
const providerTelemetry = require('../lib/providers/core/telemetry');
const registry = require('../lib/command-registry');
const isOwnerOrSudo = require('../lib/isOwner');

function fmtDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('ar', { hour12: false }); } catch { return String(value); }
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
  if (['اوامر', 'الأوامر', 'الاوامر', 'commands', 'command'].includes(sub)) {
    const commands = registry.all().filter(c => c.helpVisible !== false).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const tracked = observability.all();
    const lines = ['📋 *آخر استعمال لكل أمر*', `إجمالي الأوامر: ${commands.length}`, ''];
    for (const command of commands) {
      const entry = tracked[command.name];
      const label = command.localizedName || command.name;
      if (!entry) lines.push(`• ${label} — لم يُستعمل بعد ⏺️`);
      else if (entry.status === 'success') lines.push(`• ${label} — نجاح ✅ | ${fmtDate(entry.usedAt)}${entry.durationMs != null ? ` | ${entry.durationMs}ms` : ''}`);
      else lines.push(`• ${label} — فشل ❌ | ${fmtDate(entry.usedAt)} | السبب: ${entry.reason || 'غير محدد'}`);
    }
    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    return;
  }

  if (['providers', 'provider', 'مزود', 'مزودات', 'المزودات', 'المزود'].includes(sub)) {
    const snapshot = providerHealth.snapshot();
    const telemetry = providerTelemetry.snapshot();
    const lines = [
      '🛰️ *مراقبة Providers*',
      `• Retry: حتى ${retry.DEFAULTS.maxRetries} إعادة`,
      `• Backoff: ${retry.DEFAULTS.baseDelayMs}ms → ${retry.DEFAULTS.maxDelayMs}ms`,
      `• Retry-After: حد ${retry.DEFAULTS.retryAfterMaxMs}ms`,
      `• عمليات Retry المسجلة: ${telemetry.retries.length}`,
      `• عمليات Fallback المسجلة: ${telemetry.fallbacks.length}`,
      '• Error classification: transient / permanent / unknown',
      '• Result normalization: مفعّل قبل قبول نتيجة Media/Anime',
      '• Fallback: مفعّل عند فشل/نتيجة غير صالحة',
      '',
    ];
    if (telemetry.retries.length) {
      const r = telemetry.retries[telemetry.retries.length - 1];
      lines.push(`• آخر Retry: ${r.provider || 'غير معروف'} | محاولة ${r.attempt} | انتظار ${r.delayMs}ms | ${r.classification || 'unknown'}${r.code ? ` | ${r.code}` : ''}`);
    }
    if (telemetry.fallbacks.length) {
      const f = telemetry.fallbacks[telemetry.fallbacks.length - 1];
      lines.push(`• آخر Fallback: ${f.label || 'operation'} → ${f.provider || 'غير معروف'} | ${f.outcome}${f.reason ? ` | ${f.reason}` : ''}`);
    }
    if (!snapshot.length) lines.push('لا توجد حالة Provider مسجلة في هذه الجلسة حاليًا.');
    else for (const item of snapshot) {
      lines.push(`• ${item.name}: ${providerStatusText(item)} | نجاحات ${item.successes} | إخفاقات ${item.failures}`);
      if (item.lastError) lines.push(`  ↳ ${item.lastErrorClass || 'unknown'}: ${String(item.lastError).slice(0, 180)}`);
      if (item.latencyMs != null) lines.push(`  ↳ آخر زمن استجابة: ${item.latencyMs}ms`);
    }
    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    return;
  }

  const summary = observability.summarize();
  const total = registry.all().filter(c => c.helpVisible !== false).length;
  const snapshot = providerHealth.snapshot();
  const open = snapshot.filter(x => x.status === 'open').length;
  const degraded = snapshot.filter(x => x.status === 'degraded').length;
  const lines = [
    '🛡️ *LeoBot — لوحة المراقبة*',
    '',
    `• الإصدار: ${require('../package.json').version}`,
    `• الأوامر المسجلة: ${total}`,
    `• أوامر لها استعمال مسجل: ${summary.totalTracked}`,
    `• آخر استعمال ناجح: ${summary.success}`,
    `• آخر استعمال فاشل: ${summary.failure}`,
    `• لم تُستعمل بعد: ${Math.max(0, total - summary.totalTracked)}`,
    '',
    '🛰️ *Provider Lifecycle*',
    `• Providers المفتوحة: ${open}`,
    `• Providers المتدهورة: ${degraded}`,
    `• Retry: حتى ${retry.DEFAULTS.maxRetries} مرة`,
    `• تصنيف الأخطاء: transient / permanent / unknown`,
    '• Fallback + normalization: مفعّلان',
    '',
    '📌 الأوامر الفرعية:',
    '• `.مراقبة الأوامر` — آخر استعمال لكل أمر',
    '• `.مراقبة المزودات` — حالة الـ Providers والـ Retry',
  ];
  await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
}

module.exports = monitorCommand;
