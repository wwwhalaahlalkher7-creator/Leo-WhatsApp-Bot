const { addWelcome, delWelcome, isWelcomeOn, addGoodbye, delGoodBye, isGoodByeOn } = require('../lib/index');

function normalizeAction(value) {
  const x = String(value || '').trim().toLowerCase();
  if (['تشغيل','شغل','تفعيل','on'].includes(x)) return 'on';
  if (['إيقاف','ايقاف','وقف','تعطيل','off'].includes(x)) return 'off';
  return x;
}

const WELCOME_DEFAULT = 'أهلًا وسهلًا {العضو} 🌷\nنورت مجموعة {المجموعة}!\n👥 عدد الأعضاء: {الأعضاء}';
const GOODBYE_DEFAULT = 'مع السلامة يا {العضو} 🌷\nسنفتقدك في {المجموعة}.';

const GUIDE = {
  welcome: '👋 *إعداد الترحيب*\n\n`.ترحيب تشغيل` — تشغيل الترحيب\n`.ترحيب تعيين <الرسالة>` — تعيين رسالة مخصصة\n`.ترحيب إيقاف` — إيقاف الترحيب\n\n*المتغيرات السهلة:* `{العضو}` العضو، `{المجموعة}` اسم المجموعة، `{الوصف}` وصف المجموعة، `{الأعضاء}` عدد الأعضاء، `{المشرفين}` عدد المشرفين، `{التاريخ}` التاريخ، `{الوقت}` الوقت.\nويمكنك أيضًا استخدام `{user}` و`{group}` و`{description}` و`{members}` و`{admins}` و`{date}` و`{time}`.',
  goodbye: '👋 *إعداد الوداع*\n\n`.وداع تشغيل` — تشغيل الوداع\n`.وداع تعيين <الرسالة>` — تعيين رسالة مخصصة\n`.وداع إيقاف` — إيقاف الوداع\n\n*المتغيرات السهلة:* `{العضو}` العضو، `{المجموعة}` اسم المجموعة، `{الوصف}` وصف المجموعة، `{الأعضاء}` عدد الأعضاء، `{المشرفين}` عدد المشرفين، `{التاريخ}` التاريخ، `{الوقت}` الوقت.'
};

async function handleWelcome(sock, chatId, message, match) {
  if (!match) return sock.sendMessage(chatId, { text: GUIDE.welcome }, { quoted: message });
  const [raw, ...args] = match.trim().split(/\s+/);
  const action = normalizeAction(raw);
  const custom = args.join(' ').trim();
  if (action === 'on') {
    if (await isWelcomeOn(chatId)) return sock.sendMessage(chatId, { text: '⚠️ الترحيب مفعّل أصلًا.' }, { quoted: message });
    await addWelcome(chatId, true, WELCOME_DEFAULT);
    return sock.sendMessage(chatId, { text: '✅ تم تشغيل الترحيب. استخدم `.ترحيب تعيين <الرسالة>` لتخصيصه.' }, { quoted: message });
  }
  if (action === 'off') {
    if (!(await isWelcomeOn(chatId))) return sock.sendMessage(chatId, { text: '⚠️ الترحيب متوقف أصلًا.' }, { quoted: message });
    await delWelcome(chatId);
    return sock.sendMessage(chatId, { text: '✅ تم إيقاف الترحيب.' }, { quoted: message });
  }
  if (action === 'set' || action === 'تعيين') {
    if (!custom) return sock.sendMessage(chatId, { text: '📌 اكتب رسالة الترحيب بعد الأمر.' }, { quoted: message });
    await addWelcome(chatId, true, custom);
    return sock.sendMessage(chatId, { text: '✅ تم حفظ رسالة الترحيب. ستظهر داخل إطار مزخرف عند انضمام عضو جديد.' }, { quoted: message });
  }
  return sock.sendMessage(chatId, { text: '❌ الأمر غير صحيح. استخدم `.ترحيب تشغيل` أو `.ترحيب تعيين <الرسالة>` أو `.ترحيب إيقاف`.' }, { quoted: message });
}

async function handleGoodbye(sock, chatId, message, match) {
  if (!match) return sock.sendMessage(chatId, { text: GUIDE.goodbye }, { quoted: message });
  const parts = match.trim().split(/\s+/);
  const action = normalizeAction(parts.shift());
  const custom = parts.join(' ').trim();
  if (action === 'on') {
    if (await isGoodByeOn(chatId)) return sock.sendMessage(chatId, { text: '⚠️ الوداع مفعّل أصلًا.' }, { quoted: message });
    await addGoodbye(chatId, true, GOODBYE_DEFAULT);
    return sock.sendMessage(chatId, { text: '✅ تم تشغيل الوداع. استخدم `.وداع تعيين <الرسالة>` لتخصيصه.' }, { quoted: message });
  }
  if (action === 'off') {
    if (!(await isGoodByeOn(chatId))) return sock.sendMessage(chatId, { text: '⚠️ الوداع متوقف أصلًا.' }, { quoted: message });
    await delGoodBye(chatId);
    return sock.sendMessage(chatId, { text: '✅ تم إيقاف الوداع.' }, { quoted: message });
  }
  if (action === 'set' || action === 'تعيين') {
    if (!custom) return sock.sendMessage(chatId, { text: '📌 اكتب رسالة الوداع بعد الأمر.' }, { quoted: message });
    await addGoodbye(chatId, true, custom);
    return sock.sendMessage(chatId, { text: '✅ تم حفظ رسالة الوداع. ستظهر داخل إطار مزخرف عند مغادرة عضو.' }, { quoted: message });
  }
  return sock.sendMessage(chatId, { text: '❌ الأمر غير صحيح. استخدم `.وداع تشغيل` أو `.وداع تعيين <الرسالة>` أو `.وداع إيقاف`.' }, { quoted: message });
}

module.exports = { handleWelcome, handleGoodbye };
