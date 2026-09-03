const { t } = require('./i18n');

// Localizes user-facing static text without requiring a risky rewrite of every plugin.
// Non-text WhatsApp payloads and all other socket methods pass through untouched.
function localizeText(text) {
  if (typeof text !== 'string') return text;

  // First try an exact catalog match. This keeps plugins unchanged while
  // allowing us to migrate their messages gradually to real i18n keys.
  const exact = t(`messages.${text}`, null);
  if (exact !== null && exact !== undefined) return exact;

  // Dynamic messages used by the management plugins. These patterns preserve
  // mentions/numbers while translating the surrounding sentence.
  let m;
  if ((m = text.match(/^Successfully banned @([^!]+)!$/))) return `🚫 تم حظر @${m[1]} بنجاح.`;
  if ((m = text.match(/^Successfully unbanned ([^!]+)!$/))) return `✅ تم إلغاء حظر ${m[1]} بنجاح.`;
  if ((m = text.match(/^([^ ]+) is already banned!$/))) return `⚠️ @${m[1]} محظور أصلًا.`;
  if ((m = text.match(/^([^ ]+) is not banned!$/))) return `ℹ️ @${m[1]} غير محظور.`;
  if ((m = text.match(/^The group has been muted for (\d+) minutes\.$/))) return `🔇 تم كتم المجموعة لمدة ${m[1]} دقيقة.`;
  if ((m = text.match(/^Successfully kicked (.+)!$/))) return `👢 تم طرد ${m[1]} بنجاح.`;
  if ((m = text.match(/^(.+) has been kicked successfully!$/))) return `👢 تم طرد ${m[1]} بنجاح.`;
  if ((m = text.match(/^User has (\d+) warning\(s\)\.$/))) return `⚠️ لدى المستخدم ${m[1]} إنذار/إنذارات.`;
  if ((m = text.match(/^Warning! @([^,]+), posting links is not allowed\.$/))) return `⚠️ @${m[1]}، نشر الروابط غير مسموح به.`;
  if ((m = text.match(/^(.+) has been kicked for tagging all members\.$/))) return `🚫 تم طرد ${m[1]} بسبب منشن جميع الأعضاء.`;

  if (/^\s*Hello Everyone:/i.test(text)) return text.replace(/Hello Everyone:/i, 'يا جماعة:');
  if (/^\s*This command can only be used in groups!?/i.test(text)) return '❌ هذا الأمر متاح داخل المجموعات فقط.';
  if (/^\s*Please make the bot an admin/i.test(text)) return '❌ لازم يكون ليو مشرفًا لتنفيذ هذا الأمر.';
  if (/^\s*Only group admins can use/i.test(text)) return '❌ هذا الأمر للمشرفين فقط.';
  if (/^\s*Only admins can use/i.test(text)) return '❌ هذا الأمر للمشرفين فقط.';
  if (/^\s*Failed to get admin list/i.test(text)) return '❌ تعذر جلب قائمة المشرفين.';
  if (/^Current bot mode:/i.test(text)) {
    const m = text.match(/^Current bot mode: \*(.*?)\*\n\nUsage: (.*)$/s);
    if (m) return `وضع البوت الحالي: *${m[1] === 'public' ? 'عام' : 'خاص'}*\n\nالاستخدام: ${m[2].replace('public','عام').replace('private','خاص')}`;
  }
  if (/^Bot is now in /i.test(text)) {
    const m = text.match(/^Bot is now in \*(.*?)\* mode$/i);
    if (m) return `🤖 أصبح وضع البوت *${m[1] === 'public' ? 'عام' : 'خاص'}*`;
  }

  // Translate the most common inline English fragments in dynamic admin text.
  return text
    .replace(/Successfully promoted/gi, 'تمت ترقية')
    .replace(/Successfully demoted/gi, 'تم تخفيض رتبة')
    .replace(/Successfully kicked/gi, 'تم طرد')
    .replace(/has been promoted successfully/gi, 'تمت ترقيته بنجاح')
    .replace(/has been demoted successfully/gi, 'تم تخفيض رتبته بنجاح')
    .replace(/has been kicked successfully/gi, 'تم طرده بنجاح')
    .replace(/Failed to /gi, 'تعذر ');
}

function localizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = { ...payload };
  if (typeof copy.text === 'string') copy.text = localizeText(copy.text);
  if (typeof copy.caption === 'string') copy.caption = localizeText(copy.caption);
  return copy;
}

function createLocalizedSock(sock) {
  return new Proxy(sock, {
    get(target, property, receiver) {
      if (property !== 'sendMessage') {
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return async (jid, content, options) => target.sendMessage(jid, localizePayload(content), options);
    }
  });
}

module.exports = { createLocalizedSock, localizeText, localizePayload };
