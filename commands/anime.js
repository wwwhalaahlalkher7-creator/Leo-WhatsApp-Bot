const response = require('../systems/response');
const { SessionManager } = require('../systems/session');
const animeProvider = require('../lib/providers/anime');

const sessionManager = new SessionManager({ defaultTtl: 10 * 60 * 1000 });
const MAX_RESULTS = 6;

function text(args) { return Array.isArray(args) ? args.join(' ').trim() : String(args || '').trim(); }
function normalizeNumber(value) { return String(value || '').trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))); }
function truncate(value, max) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s;
}
function dateText(value) {
  if (!value) return 'غير معروف';
  const m = String(value).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return value;
  return m[3] ? `${m[1]}/${m[2]}/${m[3]}` : m[2] ? `${m[1]}/${m[2]}` : m[1];
}
function statusText(value) {
  return ({ FINISHED:'مكتمل', RELEASING:'مستمر', NOT_YET_RELEASED:'لم يصدر', CANCELLED:'ملغى', HIATUS:'متوقف مؤقتًا', AIRING:'مستمر', FINISHED_AIRING:'مكتمل' })[String(value || '').toUpperCase()] || (value ? String(value) : 'غير معروف');
}
function formatText(value) {
  return ({ TV:'مسلسل', MOVIE:'فيلم', OVA:'OVA', ONA:'ONA', SPECIAL:'خاص', MUSIC:'موسيقى', TV_SPECIAL:'خاص تلفزيوني' })[String(value || '').toUpperCase()] || (value ? String(value) : 'غير معروف');
}
function seasonText(value, year) {
  const s = ({ WINTER:'الشتاء', SPRING:'الربيع', SUMMER:'الصيف', FALL:'الخريف' })[String(value || '').toUpperCase()];
  return s ? `${s}${year ? ` ${year}` : ''}` : (year ? String(year) : 'غير معروف');
}
function sourceText(value) {
  return ({ MANGA:'مانغا', LIGHT_NOVEL:'رواية خفيفة', NOVEL:'رواية', ORIGINAL:'أصلي', VIDEO_GAME:'لعبة فيديو', WEB_MANGA:'مانغا ويب', OTHER:'أخرى', BOOK:'كتاب' })[String(value || '').toUpperCase()] || (value ? String(value) : 'غير معروف');
}
function countryText(value) { return ({ JP:'اليابان', CN:'الصين', KR:'كوريا الجنوبية', TW:'تايوان' })[String(value || '').toUpperCase()] || value || null; }
function relationText(value) { return ({ PREQUEL:'سابق', SEQUEL:'لاحق', SIDE_STORY:'قصة جانبية', PARENT:'العمل الأصلي', ALTERNATIVE:'بديل', SUMMARY:'ملخص', SPIN_OFF:'فرعي', OTHER:'أخرى' })[String(value || '').toUpperCase()] || value; }

function baseFields(a) {
  return [
    `📺 *الحالة:* ${statusText(a.status)}`,
    `🎞️ *الحلقات:* ${a.episodes ?? 'غير معروف'}`,
    `📅 *البداية:* ${dateText(a.startDate)}`,
    `🏁 *النهاية:* ${dateText(a.endDate)}`,
    `⭐ *التقييم:* ${a.score != null ? `${a.score}/100` : 'غير معروف'}`,
    `🎭 *النوع:* ${a.genres?.length ? a.genres.join(' • ') : 'غير معروف'}`,
  ];
}
function extraFields(a) {
  const fields = [];
  if (a.format) fields.push(`🎬 *الصيغة:* ${formatText(a.format)}`);
  if (a.duration) fields.push(`⏱️ *مدة الحلقة:* ${a.duration} دقيقة`);
  if (a.season || a.seasonYear) fields.push(`🗓️ *الموسم:* ${seasonText(a.season, a.seasonYear)}`);
  if (a.source) fields.push(`📚 *المصدر:* ${sourceText(a.source)}`);
  if (countryText(a.country)) fields.push(`🌍 *بلد الإنتاج:* ${countryText(a.country)}`);
  if (a.studios?.length) fields.push(`🏢 *الاستوديو:* ${a.studios.join(' • ')}`);
  if (a.directors?.length) fields.push(`🎬 *المخرج:* ${a.directors.join(' • ')}`);
  if (a.writers?.length) fields.push(`✍️ *الكتابة:* ${a.writers.join(' • ')}`);
  if (a.creators?.length) fields.push(`🧑‍🎨 *المؤلف:* ${a.creators.join(' • ')}`);
  if (a.titles?.synonyms?.length) fields.push(`🔤 *أسماء بديلة:* ${a.titles.synonyms.join(' • ')}`);
  if (a.popularity) fields.push(`👥 *الشعبية:* ${a.popularity.toLocaleString('en-US')}`);
  if (a.siteUrl) fields.push(`🌐 *صفحة الأنمي:* ${a.siteUrl}`);
  const rels = (a.relations || []).filter(r => ['PREQUEL','SEQUEL','SIDE_STORY','PARENT','SPIN_OFF'].includes(String(r.type).toUpperCase())).slice(0, 5);
  if (rels.length) fields.push(`🔗 *أعمال مرتبطة:*\n${rels.map(r => `• ${relationText(r.type)}: ${r.title}`).join('\n')}`);
  return fields;
}
function formatCard(a) {
  const preferred = a.titles?.english || a.titles?.romaji || a.title || 'غير معروف';
  const native = a.titles?.native && a.titles.native !== preferred ? `\n🇯🇵 *الاسم الأصلي:* ${a.titles.native}` : '';
  const description = a.description ? `\n\n📝 *القصة:*\n${truncate(a.description, 700)}` : '\n\n📝 *القصة:*\nغير معروف';
  const aBlock = baseFields(a).join('\n');
  const bBlock = extraFields(a);
  let text = `╭━━━〔 🎌 ${truncate(preferred, 70)} 〕━━━╮\n${native ? native.slice(1) : ''}\n${aBlock}${description}`;
  if (bBlock.length) text += `\n\n━━━━━━━━━━━━━━━━━━━━\n📚 *معلومات إضافية*\n${bBlock.join('\n')}`;
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
function resultLine(item, index) {
  const score = item.score != null ? ` ⭐${item.score}` : '';
  const year = item.startDate ? ` • ${String(item.startDate).slice(0, 4)}` : '';
  return `〔 ${index + 1} 〕 ${truncate(item.title, 55)}${year}${score}`;
}

async function sendDetails(sock, chatId, message, result) {
  const details = await animeProvider.getDetails(result);
  if (!details) throw new Error('ANIME_DETAILS_FAILED');
  const caption = formatCard(details);
  const sent = details.image
    ? await response.media(sock, chatId, { image: { url: details.image }, caption }, message)
    : await response.text(sock, chatId, caption, message);
  return sent;
}

async function animeCommand(sock, chatId, message, args, ctx) {
  const query = text(args);
  if (!query) {
    return response.text(sock, chatId, '🎌 *ابحث عن أنمي*\n\n📌 مثال:\n`.أنمي One Piece`\n`.أنمي هجوم العمالقة`', message);
  }
  try {
    await response.react(sock, chatId, message, '🎌');
    const results = await animeProvider.search(query);
    if (results.length === 1) return sendDetails(sock, chatId, message, results[0]);
    const list = results.slice(0, MAX_RESULTS).map(resultLine).join('\n');
    const sent = await response.text(sock, chatId, `╭━━━〔 🎌 نتائج البحث 〕━━━╮\n┃ *${truncate(query, 60)}*\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n${list}\n\n↩️ *أرسل رقم النتيجة بالرد على هذه الرسالة.*`, message);
    if (ctx.senderId && sent?.key?.id) {
      sessionManager.create({ type: 'anime-search', chatId, ownerId: ctx.senderId, activeMessageId: sent.key.id, data: { results: results.slice(0, MAX_RESULTS) } });
    }
    return sent;
  } catch (error) {
    console.error('[Anime]', error.message);
    const msg = error.message === 'ANIME_NOT_FOUND' ? '❌ لم أجد أنمي مطابقًا لبحثك. جرّب اسمًا آخر.' : '❌ تعذر جلب معلومات الأنمي حاليًا. حاول مرة أخرى لاحقًا.';
    return response.text(sock, chatId, msg, message);
  }
}

async function handleAnimeReply(sock, chatId, message, value, senderId) {
  if (!senderId) return false;
  const session = sessionManager.get('anime-search', chatId, senderId);
  if (!session) return false;
  const interaction = require('../systems/interaction').replyNumber(message, session.activeMessageId, { min: 1, max: session.data.results.length });
  if (!interaction.ok) return false;
  sessionManager.close(session, 'selected');
  try {
    await response.react(sock, chatId, message, '🎌');
    await sendDetails(sock, chatId, message, session.data.results[interaction.value - 1]);
  } catch (error) {
    console.error('[Anime selection]', error.message);
    await response.text(sock, chatId, '❌ تعذر جلب تفاصيل النتيجة المختارة. حاول البحث عنها مرة أخرى.', message);
  }
  return true;
}

module.exports = { animeCommand, handleAnimeReply };
