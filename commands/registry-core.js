const currency = require('../systems/economy/currency');
const economyMessages = require('../systems/economy/messages');
const { topMembers } = require('./topmembers');
const groupInfoCommand = require('./groupinfo');
/**
 * Phase 2 legacy command migration.
 * These handlers already existed in LeoBot; only their registration/routing
 * metadata moved out of main.js. The handler implementations are unchanged.
 */
const registry = require('../lib/command-registry');
const menuCommand = require('./menu');
const ownerCommand = require('./owner');
const quoteCommand = require('./quote');
const factCommand = require('./fact');
const newsCommand = require('./news');
const aliveCommand = require('./alive');
const { bankCommand, transferCommand, historyCommand } = require('./bank');
const workCommand = require('./work');
const levelCommand = require('./level');
const subscriptionCommand = require('./subscription');

function add(definition) {
  return registry.register(definition);
}

add({ hidden:true, name:'menu', aliases:['cmd','list'], localizedAliases:['الأوامر','القائمة','القائمه','الرئيسية','اوامر','أوامر','الاوامر','منيو'], localizedName:'الأوامر', category:'basic', usage:'.القائمة', description:'عرض قائمة أوامر LeoBot.', method:'أرسل `.القائمة` أو `.منيو`.', execute:menuCommand });
add({ name:'owner',aliases:[], localizedAliases:['المالك'], localizedName:'المالك', category:'utility', usage:'.المالك', description:'عرض معلومات مالك البوت.', method:'أرسل `.المالك`.', ownerOnly:false, execute:(sock, chatId) => ownerCommand(sock, chatId) });
add({ name:'quote',aliases:[], localizedAliases:['إقتباس','اقتباس'], localizedName:'إقتباس', category:'fun', usage:'.اقتباس', description:'إرسال اقتباس قصير.', method:'أرسل `.اقتباس`.', execute:quoteCommand });
add({ name:'fact',aliases:[], localizedAliases:['معلومة','معلومه'], localizedName:'معلومة', category:'fun', usage:'.معلومة', description:'إرسال معلومة مفيدة أو طريفة.', method:'أرسل `.معلومة`.', execute:factCommand });
add({ name:'news',aliases:[], localizedAliases:['أخبار','اخبار'], localizedName:'أخبار', category:'utility', usage:'.أخبار', description:'جلب آخر الأخبار المتاحة.', method:'أرسل `.أخبار`.', execute:newsCommand });
add({ name:'topmembers',aliases:[], localizedAliases:['التوب','توب الأعضاء'], localizedName:'التوب', category:'level', usage:'.توب_الأعضاء', description:'عرض ترتيب الأعضاء حسب النشاط المسجل.', method:'استخدم الأمر داخل المجموعة.', groupOnly:true, execute:(sock, chatId, message, args, ctx) => topMembers(sock, chatId, ctx.isGroup) });
add({ name:'alive', aliases:[], localizedAliases:['حالة'], localizedName:'حالة', category:'utility', usage:'.حالة', description:'عرض حالة LeoBot ومعلومات التشغيل الأساسية.', method:'أرسل `.حالة`.', execute:aliveCommand });
add({ name:'balance',aliases:[], localizedAliases:['رصيد','رصيدي'], localizedName:'رصيد', category:'economy', usage:'.رصيد [بالرد على عضو]', description:'عرض رصيد حسابك الحالي أو رصيد عضو بالرد على رسالته.', method:'أرسل `.رصيد`، أو رد على رسالة العضو بالأمر.', execute:async (sock, chatId, message, args, ctx) => {
  const inputSystem = require('../systems/input');
  const mentioned = inputSystem.mentions(message);
  const target = mentioned[0] || inputSystem.replySender(message);
  const userId = target || ctx.senderId;
  const balance = await ctx.systems.economy.balance(userId);
  if (target && ctx.systems.economy.normalizeId(target) !== ctx.systems.economy.normalizeId(ctx.senderId)) {
    let name = `@${String(target).split('@')[0]}`;
    try { name = await sock.getName(target, false) || name; } catch {}
    return ctx.systems.response.text(sock, chatId, `💰 *رصيد ${name}*\n\n💰 المبلغ: *${currency.balance(balance)}*`, message);
  }
  return ctx.systems.response.text(sock, chatId, `${economyMessages.balance(balance)}\n\n🪙 استخدم *.عمل* لكسب المزيد.\n🏦 استخدم *.بنك* لإدارة رصيدك.`, message);
} });
add({ name:'bank',aliases:[], localizedAliases:['بنك','بنكك'], localizedName:'بنك', category:'economy', usage:'.بنك', description:'عرض رصيد الحساب وآخر العمليات المالية.', method:'أرسل `.بنك`.', execute:(sock, chatId, message, args, ctx) => bankCommand(sock, chatId, ctx.senderId, message, ctx.systems.economy) });
add({ name:'transfer',aliases:[], localizedAliases:['تحويل'], localizedName:'تحويل', category:'economy', usage:'.تحويل @العضو المبلغ', description:'تحويل نيورونات إلى عضو آخر.', method:'اذكر العضو أو رد على رسالته ثم اكتب المبلغ.', execute:(sock, chatId, message, args, ctx) => transferCommand(sock, chatId, ctx.senderId, message, ctx.systems.economy) });
add({ name:'transactions', aliases:['history'], localizedAliases:['السجل','سجل'], localizedName:'السجل', category:'economy', usage:'.سجل', description:'عرض آخر العمليات المالية.', method:'أرسل `.سجل`.', execute:(sock, chatId, message, args, ctx) => historyCommand(sock, chatId, ctx.senderId, message, ctx.systems.economy) });
add({ name:'level',aliases:[], localizedAliases:['مستوى','مستواي','بروفايل','ملفي'], localizedName:'مستوى', category:'level', usage:'.مستوى', description:'عرض مستوى XP وبطاقة تقدم العضو.', method:'أرسل الأمر لعرض بطاقة مستواك.', execute:(sock,chatId,message,args,ctx)=>levelCommand(sock,chatId,ctx.senderId,message) });
add({ name:'subscription',aliases:[], localizedAliases:['اشتراك','الاشتراك'], localizedName:'اشتراك', category:'premium', usage:'.اشتراك [شراء|حالي]', description:'عرض اشتراكات Leo ومزاياها وحالة اشتراكك.', method:'أرسل `.اشتراك` لعرض الباقات.', execute:(sock,chatId,message,args,ctx)=>subscriptionCommand(sock,chatId,ctx.senderId,message,args) });
add({ name:'work',aliases:[], localizedAliases:['عمل','وظيفة'], localizedName:'عمل', category:'economy', usage:'.عمل', description:'تنفيذ وظيفة عشوائية لكسب الرصيد.', method:'أرسل `.عمل` وانتظر انتهاء فترة الانتظار قبل المحاولة التالية.', execute:(sock, chatId, message, args, ctx) => workCommand(sock, chatId, ctx.senderId, message, ctx.systems.economy) });

// Phase 2B: group administration and moderation commands.
const kickCommand = require('./kick');
const muteCommand = require('./mute');
const banCommand = require('./ban');
const unbanCommand = require('./unban');
const warnCommand = require('./warn');
const warningsCommand = require('./warnings');
const { promoteCommand } = require('./promote');
const { demoteCommand } = require('./demote');
const tagAllCommand = require('./tagall');
const tagNotAdminCommand = require('./tagnotadmin');
const tagCommand = require('./tag');
const { handleAntilinkCommand } = require('./antilink');
const { handleAntitagCommand } = require('./antitag');

function mentioned(message) {
  return message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
function quoted(message) {
  return message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}
function rawText(args) { return Array.isArray(args) ? args.join(' ') : ''; }

add({ name:'kick',aliases:[], localizedAliases:['طرد','اطرد'], localizedName:'طرد', category:'group', usage:'.طرد @عضو', description:'طرد عضو من المجموعة.', method:'اذكر العضو أو رد على رسالته.', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:(sock, chatId, message) => kickCommand(sock, chatId, message.key.participant || message.key.remoteJid, mentioned(message), message) });
add({ name:'mute',aliases:[], localizedAliases:['كتم'], localizedName:'كتم', category:'group', usage:'.كتم <تشغيل|إيقاف|الدقائق>', description:'كتم المجموعة مؤقتًا أو بشكل مستمر وإعادة فتحها.', method:'استخدم `.كتم تشغيل` أو `.كتم إيقاف`، ويمكن تحديد مدة بالدقائق.', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:(sock, chatId, message, args, ctx) => { const value = rawText(args).trim().toLowerCase(); if (value === 'إيقاف' || value === 'ايقاف' || value === 'off' || value === 'وقف') return muteCommand(sock, chatId, ctx.senderId, message, 0, 'off'); if (value === 'تشغيل' || value === 'شغل' || value === 'on') return muteCommand(sock, chatId, ctx.senderId, message, undefined, 'on'); const minutes = Number(args?.[0]); return muteCommand(sock, chatId, ctx.senderId, message, Number.isFinite(minutes) && minutes > 0 ? minutes : undefined, 'on'); } });
add({ name:'ban',aliases:[], localizedAliases:['حظر','احظر'], localizedName:'حظر', category:'group', usage:'.حظر @عضو', description:'حظر عضو وفق نظام LeoBot للمحظورين.', method:'اذكر العضو أو رد على رسالته.', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:(sock, chatId, message) => banCommand(sock, chatId, message) });
add({ name:'unban',aliases:[], localizedAliases:['رفع الحظر','فك الحظر'], localizedName:'رفع الحظر', category:'group', usage:'.رفع الحظر @عضو', description:'إلغاء حظر عضو.', method:'اذكر العضو أو رد على رسالته.', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:(sock, chatId, message) => unbanCommand(sock, chatId, message) });
add({ name:'warn',aliases:[], localizedAliases:['تحذير','إنذار'], localizedName:'تحذير', category:'group', usage:'.تحذير @عضو [السبب]', description:'إضافة تحذير لعضو في المجموعة.', method:'اذكر العضو ويمكنك إضافة السبب.', groupOnly:true, adminOnly:true, execute:(sock, chatId, message, args, ctx) => warnCommand(sock, chatId, ctx.senderId, mentioned(message), message) });
add({ name:'warnings',aliases:[], localizedAliases:['تحذيرات','التحذيرات'], localizedName:'تحذيرات', category:'group', usage:'.تحذيرات @عضو', description:'عرض تحذيرات عضو.', method:'اذكر العضو أو استخدمه بحسب نظام التحذيرات.', groupOnly:true, execute:(sock, chatId, message) => warningsCommand(sock, chatId, mentioned(message)) });
add({ name:'promote',aliases:[], localizedAliases:['ترقية','ترقيه'], localizedName:'ترقية', category:'group', usage:'.ترقية @عضو', description:'ترقية عضو إلى مشرف.', method:'اذكر العضو.', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:(sock, chatId, message) => promoteCommand(sock, chatId, mentioned(message), message) });
add({ name:'demote',aliases:[], localizedAliases:['خفض'], localizedName:'خفض', category:'group', usage:'.خفض @مشرف', description:'إزالة صلاحية الإشراف من عضو.', method:'اذكر المشرف.', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:(sock, chatId, message) => demoteCommand(sock, chatId, mentioned(message), message) });
add({ name:'tag',aliases:[], localizedAliases:['منشن'], localizedName:'منشن', category:'group', usage:'.منشن [الكل|غير المشرفين|النص]', description:'منشن أعضاء المجموعة، أو جميع الأعضاء، أو غير المشرفين فقط.', method:'استخدم `.منشن` للمنشن العادي، أو أضف `الكل` أو `غير المشرفين` لتحديد النطاق.', groupOnly:true, adminOnly:true, execute:(sock, chatId, message, args, ctx) => { const mode = rawText(args).trim().toLowerCase(); if (mode === 'الكل' || mode === 'all') return tagAllCommand(sock, chatId, ctx.senderId, message); if (mode === 'غير المشرفين' || mode === 'غير_المشرفين' || mode === 'nonadmins' || mode === 'غير الادمن' || mode === 'غير_الأدمن') return tagNotAdminCommand(sock, chatId, ctx.senderId, message); return tagCommand(sock, chatId, ctx.senderId, rawText(args), quoted(message), message); } });
add({ name:'antilink',aliases:[], localizedAliases:['منع الروابط','مكافحة الروابط'], localizedName:'منع الروابط', category:'group', usage:'.منع الروابط on|off|get|warn|kick|delete', description:'إدارة حماية المجموعة من الروابط.', method:'استخدم `on` أو `off` أو `get` أو حدد إجراء الحماية.', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:(sock, chatId, message, args, ctx) => handleAntilinkCommand(sock, chatId, `.${args?.length ? 'antilink ' + rawText(args) : 'antilink'}`, ctx.senderId, ctx.isSenderAdmin, message, ctx.senderIdAlt) });
add({ name:'antitag',aliases:[], localizedAliases:['منع التاق','مكافحة التاق','منع المنشن'], localizedName:'منع التاق', category:'group', usage:'.منع التاق on|off|get', description:'إدارة حماية المجموعة من المنشن الجماعي.', method:'استخدم `on` أو `off` أو `get`.', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:(sock, chatId, message, args, ctx) => handleAntitagCommand(sock, chatId, `.${args?.length ? 'antitag ' + rawText(args) : 'antitag'}`, ctx.senderId, ctx.isSenderAdmin, message) });
add({ name:'groupinfo', aliases:['infogp','infogrupo'], localizedAliases:['معلومات المجموعة','معلومات المجموعه','المجموعة'], localizedName:'معلومات المجموعة', category:'group', usage:'.معلومات المجموعة', description:'عرض معلومات المجموعة الأساسية.', method:'استخدم الأمر داخل المجموعة.', groupOnly:true, execute:(sock, chatId, message) => groupInfoCommand(sock, chatId, message) });


// Phase 3: migrate utility, media, AI and image commands from main.js.

const stickerCommandP3 = require('./sticker');
const ttsCommandP3 = require('./tts');
const deleteCommandP3 = require('./delete');
const settingsCommandP3 = require('./settings');
const weatherCommandP3 = require('./weather');
const lyricsCommandP3 = require('./lyrics').lyricsCommand;
const blurCommandP3 = require('./img-blur');
const songCommandP3 = require('./song');
const videoCommandP3 = require('./video');
const aiCommandP3 = require('./ai');
const translateCommandP3 = require('./translate').handleTranslateCommand;
const ssCommandP3 = require('./ss').handleSsCommand;
const shayariCommandP3 = require('./shayari').shayariCommand;
const imagineCommandP3 = require('./imagine');
const imageSearchCommandP3 = require('./image-search');
const { removebgCommand: removebgCommandP3 } = require('./removebg');
const reminiCommandP3 = require('./remini').reminiCommand;
const soraCommandP3 = require('./sora');
const viewOnceCommandP3 = require('./viewonce');
const clearSessionCommandP3 = require('./clearsession');
const setProfilePictureP3 = require('./setpp');
const characterCommandP3 = require('./character');
const wantedCommandP3 = require('./wanted');
const shipCommandP3 = require('./ship');

function textFrom(args) { return Array.isArray(args) ? args.join(' ') : ''; }

add({name:'sticker',aliases:[],localizedAliases:['ملصق','ستيكر'],localizedName:'ملصق',category:'sticker',interaction:'media',usage:'.ملصق',description:'تحويل صورة أو فيديو إلى ملصق WhatsApp.',method:'أرسل الوسائط مع الأمر أو رد على الوسائط.',execute:stickerCommandP3});
add({name:'tts',aliases:[],localizedAliases:['قولي'],localizedName:'قولي',category:'audio',usage:'.قولي <النص>',description:'تحويل النص إلى صوت.',method:'أرسل النص بعد الأمر.',execute:(sock,chatId,message,args)=>ttsCommandP3(sock,chatId,textFrom(args),message,{gender:'female'})});
add({name:'ttsmale',aliases:[],localizedAliases:['قول'],localizedName:'قول',category:'audio',usage:'.قول <النص>',description:'تحويل النص إلى صوت ذكر.',method:'أرسل النص بعد الأمر.',execute:(sock,chatId,message,args)=>ttsCommandP3(sock,chatId,textFrom(args),message,{gender:'male'})});
add({name:'delete',aliases:['del'],localizedAliases:['حذف'],localizedName:'حذف',category:'group',interaction:'reply-required',usage:'.حذف',description:'حذف الرسالة أو المحتوى المستهدف وفق صلاحيات WhatsApp.',method:'استخدم الأمر بالرد على الرسالة.',execute:(sock,chatId,message,args,ctx)=>deleteCommandP3(sock,chatId,message,ctx.senderId)});
add({name:'settings',aliases:[],localizedAliases:['الإعدادات','الاعدادات','إعدادات','اعدادات'],localizedName:'الإعدادات',category:'owner',usage:'.إعدادات',description:'عرض إعدادات البوت.',method:'للمالك.',ownerOnly:true,execute:settingsCommandP3});
add({name:'weather',aliases:[],localizedAliases:['طقس','الطقس'],localizedName:'طقس',category:'utility',usage:'.طقس <المدينة>',description:'عرض حالة الطقس.',method:'أرسل اسم المدينة.',execute:(sock,chatId,message,args)=>weatherCommandP3(sock,chatId,message,textFrom(args))});
add({name:'lyrics',aliases:[],localizedAliases:['كلمات أغنية','كلمات','كلمات اغنيه','كلمات أغنية'],localizedName:'كلمات أغنية',category:'audio',usage:'.كلمات الأغاني <الأغنية>',description:'البحث عن كلمات أغنية.',method:'أرسل اسم الأغنية.',execute:(sock,chatId,message,args)=>lyricsCommandP3(sock,chatId,textFrom(args),message)});
add({name:'blur',aliases:[],localizedAliases:['تمويه','تشويش'],localizedName:'تمويه',category:'image',interaction:'media',usage:'.تمويه',description:'تمويه صورة.',method:'أرسل صورة أو رد على صورة.',execute:(sock,chatId,message)=>blurCommandP3(sock,chatId,message,quoted(message))});
add({name:'play',aliases:['mp3','song'],localizedAliases:['أغنية','اغنية','أغنيه','اغنيه'],localizedName:'أغنية',category:'download',usage:'.أغنية <البحث أو الرابط>',description:'تحميل صوت من YouTube.',method:'أرسل اسم الأغنية أو الرابط.',execute:(sock,chatId,message,args,ctx)=>songCommandP3(sock,chatId,message,ctx.senderId,ctx.systems.economy)});
add({name:'video',aliases:['mp4'],localizedAliases:['فيديو'],localizedName:'فيديو',category:'download',usage:'.فيديو <البحث أو الرابط>',description:'تحميل فيديو.',method:'أرسل البحث أو الرابط.',execute:(sock,chatId,message,args,ctx)=>videoCommandP3(sock,chatId,message,ctx.senderId,ctx.systems.economy)});
add({name:'ai',aliases:[],localizedAliases:['ليو'],localizedName:'ليو',category:'ai',usage:'.ليو <السؤال>',description:'محادثة مع ليو باستخدام أفضل مزود متاح ثم الانتقال تلقائيًا إلى البدائل عند الفشل.',method:'أرسل سؤالك بعد الأمر.',execute:(sock,chatId,message,args,ctx)=>aiCommandP3(sock,chatId,message,ctx.senderId,'ai',ctx.systems.economy)});
add({name:'translate',aliases:[],localizedAliases:['ترجمة','ترجمه','ترجم'],localizedName:'ترجمة',category:'utility',usage:'.ترجمة <النص>',description:'ترجمة النص.',method:'أرسل النص واللغة المطلوبة.',execute:(sock,chatId,message,args)=>translateCommandP3(sock,chatId,message,textFrom(args))});
add({name:'ss',aliases:['screenshot','ssweb'],localizedAliases:['سكرين','لقطة'],localizedName:'سكرين',category:'image',usage:'.لقطة <الرابط>',description:'التقاط لقطة شاشة لصفحة ويب.',method:'أرسل الرابط.',execute:(sock,chatId,message,args)=>ssCommandP3(sock,chatId,message,textFrom(args).trim())});
add({name:'shayari',aliases:['shayri'],localizedAliases:['شعر'],localizedName:'شعر',category:'fun',usage:'.شعر',description:'إرسال شعر/عبارة شعرية.',method:'أرسل الأمر.',execute:shayariCommandP3});
add({name:'imagine',aliases:['flux'],localizedAliases:['تخيل'],localizedName:'تخيل',category:'image',usage:'.تخيل <الوصف>',description:'توليد صورة بالذكاء الاصطناعي.',method:'أرسل وصف الصورة.',execute:(sock,chatId,message,args,ctx)=>imagineCommandP3(sock,chatId,message,ctx.senderId,ctx.systems.economy)});
add({name:'image',aliases:['picture','img'],localizedAliases:['صورة','صوره'],localizedName:'صورة',category:'image',usage:'.صورة <البحث>',description:'البحث عن صورة وإرسالها.',method:'أرسل عبارة البحث.',execute:(sock,chatId,message,args,ctx)=>imageSearchCommandP3(sock,chatId,message,ctx.senderId,ctx.systems.economy)});
add({name:'removebg',aliases:['rmbg'],localizedAliases:['إزالة الخلفية','ازالة الخلفية','إزاله الخلفيه','ازاله الخلفية'],localizedName:'إزالة الخلفية',category:'image',interaction:'media',usage:'.إزالة الخلفية',description:'إزالة خلفية الصورة.',method:'أرسل صورة أو رد عليها.',execute:(sock,chatId,message,args)=>removebgCommandP3(sock,chatId,message,args)});
add({name:'remini',aliases:[],localizedAliases:['تحسين'],localizedName:'تحسين',category:'image',interaction:'media',usage:'.تحسين',description:'تحسين جودة الصورة.',method:'أرسل صورة أو رد عليها.',execute:(sock,chatId,message,args)=>reminiCommandP3(sock,chatId,message,args)});
add({name:'sora',aliases:[],localizedAliases:['سورا'],localizedName:'سورا',category:'ai',usage:'.سورا <الوصف>',description:'توليد فيديو بالذكاء الاصطناعي عند توفر المزود.',method:'أرسل الوصف.',execute:(sock,chatId,message,args,ctx)=>soraCommandP3(sock,chatId,message,ctx.senderId,ctx.systems.economy)});
add({name:'vv',aliases:[],localizedAliases:['عرض','أفضحه'],localizedName:'عرض',category:'utility',interaction:'reply-required',usage:'.عرض',description:'عرض محتوى View Once وفق ما تسمح به الرسالة.',method:'رد على View Once ثم أرسل الأمر.',execute:viewOnceCommandP3});
add({name:'clearsession',aliases:[],localizedAliases:['مسح الجلسة'],localizedName:'مسح الجلسة',category:'owner',usage:'.مسح الجلسة',description:'مسح جلسة اعتماد WhatsApp.',method:'للمالك.',ownerOnly:true,execute:clearSessionCommandP3});
add({name:'setpp',aliases:[],localizedAliases:['صورة البروفايل'],localizedName:'صورة البروفايل',category:'owner',interaction:'reply-media',usage:'.صورة البروفايل',description:'تغيير صورة بروفايل البوت.',method:'أرسل صورة مع الأمر.',ownerOnly:true,execute:setProfilePictureP3});
add({name:'character',aliases:[],localizedAliases:['شخصية','شخصيه'],localizedName:'شخصية',category:'fun',usage:'.شخصية',description:'عرض شخصية ترفيهية.',method:'أرسل الأمر.',execute:characterCommandP3});
add({name:'wanted',aliases:[],localizedAliases:['مطلوب'],localizedName:'مطلوب',category:'fun',interaction:'mention-or-reply',usage:'.مطلوب @عضو',description:'إنشاء صورة مطلوب.',method:'اذكر العضو أو رد على رسالته.',execute:wantedCommandP3});
add({name:'ship',aliases:[],localizedAliases:['توافق'],localizedName:'توافق',category:'fun',interaction:'mention',usage:'.توافق @عضو',description:'حساب نسبة توافق ترفيهية.',method:'اذكر العضو.',execute:shipCommandP3});


// Phase 4B: commands that were still special-cased/imported by main.js.
// Lazy-load Help to avoid a circular dependency:
// registry-init -> registry-core -> help (lazy loader).
// The old eager require captured the partial registry export and made `.مساعدة` fail.
const helpCommandP4 = (...args) => require('./help')(...args);
const approveCommandP4 = require('./approve');
const leaveCommandP4 = require('./leave');
const updateCommandP4 = require('./update');

add({hidden:true,name:'help',aliases:[],localizedAliases:['مساعدة','المساعدة','مساعده'],localizedName:'مساعدة',category:'basic',usage:'.مساعدة',description:'فتح دليل أوامر LeoBot.',method:'أرسل `.مساعدة` ثم اختر الفئة والأمر.',execute:helpCommandP4});
add({name:'approve',aliases:[],localizedAliases:['موافقة'],localizedName:'موافقة',category:'owner',usage:'.موافقة [معرّف المجموعة]',description:'الموافقة على تشغيل LeoBot في مجموعة.',method:'للمالك فقط.',ownerOnly:true,execute:(sock,chatId,message,args)=>approveCommandP4(sock,chatId,message,(args||[]).join(' '))});
add({name:'leave',aliases:[],localizedAliases:['مغادرة'],localizedName:'مغادرة',category:'owner',usage:'.مغادرة [معرّف المجموعة]',description:'إخراج LeoBot من مجموعة.',method:'للمالك فقط.',ownerOnly:true,execute:(sock,chatId,message,args)=>leaveCommandP4(sock,chatId,message,(args||[]).join(' '))});
add({name:'update',aliases:[],localizedAliases:['تحديث'],localizedName:'تحديث',category:'owner',usage:'.تحديث',description:'تحديث LeoBot من المصدر المتاح.',method:'للمالك فقط وبعد مراجعة التحديث.',ownerOnly:true,execute:(sock,chatId,message,args)=>updateCommandP4(sock,chatId,message,(args||[]).join(' '))});

module.exports = registry;

const modeCommandP5 = require('./mode');
add({name:'mode',aliases:[],localizedAliases:['وضع'],localizedName:'وضع',category:'owner',usage:'.وضع عام|خاص',description:'تغيير وضع وصول LeoBot.',method:'للمالك فقط.',ownerOnly:true,execute:(sock,chatId,message,args)=>modeCommandP5(sock,chatId,message,args)});
