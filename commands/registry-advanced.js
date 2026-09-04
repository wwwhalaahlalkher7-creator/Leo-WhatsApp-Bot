/**
 * Registry Phase 2D
 * Stateful/advanced commands migrated out of main.js routing.
 * Handlers remain in their original modules; this file owns routing metadata.
 */
const registry = require('../lib/command-registry');
const monitorCommand = require('./monitor');
const { tictactoeCommand } = require('./tictactoe');
const { startGuess, requestHint, guess } = require('./hangman');
const { startTrivia } = require('./trivia');
const { welcomeCommand } = require('./welcome');
const { goodbyeCommand } = require('./goodbye');
const antibadwordCommand = require('./antibadword');
const { handleChatbotCommand } = require('./chatbot');
const { autoStatusCommand } = require('./autostatus');
const { handleAntideleteCommand } = require('./antidelete');
const { setGroupDescription, setGroupName, setGroupPhoto } = require('./groupmanage');
const { autoreadCommand } = require('./autoread');
const botStateCommand = require('./botstate');
const { pmblockerCommand } = require('./pmblocker');
const simageCommand = require('./simage');
const { animeCommand } = require('./anime');
const bankManagerCommand = require('./bank-manager');

const text = args => (args || []).join(' ').trim();
const quoted = message => message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
const group = { groupOnly:true };
const owner = { ownerOnly:true };
const admin = { groupOnly:true, adminOnly:true, botAdminOnly:true };

registry.register({name:'anime',aliases:[],localizedAliases:['أنمي','انمي'],localizedName:'أنمي',category:'anime',usage:'.أنمي <اسم الأنمي>',description:'البحث عن أنمي وعرض معلوماته الأساسية والإضافية.',method:'استخدم `.أنمي <اسم الأنمي>`. إذا ظهرت عدة نتائج، اختر رقم النتيجة بالرد على قائمة البحث.',execute:animeCommand});
registry.register({name:'simage',aliases:[],localizedAliases:['صورة الملصق','صوره الملصق'],localizedName:'صورة الملصق',category:'image',interaction:'reply-media',usage:'.صورة الملصق',description:'تحويل الملصق المقتبس إلى صورة.',method:'رد على ملصق.',execute:async(sock,chatId,message)=>{const q=quoted(message);if(q?.stickerMessage)return simageCommand(sock,q,chatId);return sock.sendMessage(chatId,{text:'🖼️ رد على ملصق باستخدام `.صورة الملصق` لتحويله إلى صورة.'},{quoted:message});}});
registry.register({name:'bot',aliases:[],localizedAliases:['البوت'],localizedName:'البوت',category:'owner',usage:'.البوت <تشغيل|إيقاف>',description:'تشغيل أو إيقاف LeoBot.',method:'للمالك.',...owner,execute:(s,c,m,a)=>botStateCommand(s,c,m,text(a))});
registry.register({name:'pmblocker',aliases:[],localizedAliases:['حظر الإتصالات'],localizedName:'حظر الإتصالات',category:'owner',usage:'.حظر الاتصالات <تشغيل|إيقاف|حالة>',description:'إدارة حظر الرسائل الخاصة.',method:'للمالك.',...owner,execute:(s,c,m,a)=>pmblockerCommand(s,c,m,text(a))});
registry.register({name:'ttt',aliases:['X O'],localizedAliases:['اكس او'],localizedName:'اكس او',category:'game',usage:'.اكس او',description:'بدء لعبة إكس-أو.',method:'ابدأ اللعبة، ثم أرسل رقم الخانة بالرد على رسالة اللعبة.',execute:(s,c,m,a,ctx)=>tictactoeCommand(s,c,ctx.senderId,text(a))});
registry.register({name:'guess',aliases:[],localizedAliases:['خمن'],localizedName:'خمن',category:'game',usage:'.خمن',description:'بدء لعبة التخمين. أثناء اللعبة أرسل التخمين أو كلمة دليل بالرد على رسالة اللعبة.',method:'ابدأ بـ `.خمن`، ثم أرسل التخمين أو `دليل` بالرد على رسالة اللعبة.',execute:(s,c,m,a,ctx)=>{if((a||[]).length)return s.sendMessage(c,{text:'🎯 ابدأ اللعبة باستخدام `.خمن` فقط، ثم أرسل التخمين بالرد على رسالة اللعبة.'},{quoted:m});return startGuess(s,c,ctx.senderId,m)}});
registry.register({name:'trivia',aliases:[],localizedAliases:['مسابقة','مسابقه'],localizedName:'مسابقة',category:'game',usage:'.مسابقة',description:'بدء المسابقة.',method:'أرسل الأمر.',execute:(s,c,m,a,ctx)=>startTrivia(s,c,ctx.senderId,m,ctx.senderIdAlt)});
registry.register({name:'contest-history',aliases:[],localizedAliases:['سجل المسابقة','سجل المسابقه'],localizedName:'سجل المسابقة',category:'game',usage:'.سجل المسابقة',description:'عرض سجل نتائج المسابقات.',method:'أرسل الأمر لعرض السجل.',execute:(s,c,m,a,ctx)=>require('./trivia').contestHistoryCommand(s,c,ctx.senderId,m,ctx.senderIdAlt)});
// The former interaction/reaction command family was retired per the command cleanup report.
// Do not register poke/cry/kiss/pat/hug/wink/facepalm here.
registry.register({name:'welcome',localizedAliases:['ترحيب'],localizedName:'ترحيب',category:'group',usage:'.ترحيب',description:'إدارة رسالة الترحيب.',method:'للمشرفين.',...admin,execute:(s,c,m)=>welcomeCommand(s,c,m)});
registry.register({name:'goodbye',aliases:[],localizedAliases:['وداع'],localizedName:'وداع',category:'group',usage:'.وداع',description:'إدارة رسالة المغادرة.',method:'للمشرفين.',...admin,execute:(s,c,m)=>goodbyeCommand(s,c,m)});
registry.register({name:'antibadword',aliases:[],localizedAliases:['منع الإساءة'],localizedName:'منع الإساءة',category:'group',usage:'.منع الكلمات <تشغيل|إيقاف>',description:'إدارة فلتر الكلمات المسيئة.',method:'للمشرفين.',...admin,execute:(s,c,m,a,ctx)=>antibadwordCommand(s,c,m,ctx.senderId,ctx.isSenderAdmin)});
registry.register({name:'chatbot',aliases:[],localizedAliases:['الرد','شات بوت'],localizedName:'الرد',category:'group',usage:'.شات بوت <تشغيل|إيقاف>',description:'إدارة Chatbot للمجموعة.',method:'للمشرفين.',...admin,execute:(s,c,m,a)=>handleChatbotCommand(s,c,m,text(a))});
registry.register({name:'autostatus',aliases:[],localizedAliases:['الحالة التلقائية'],localizedName:'الحالة التلقائية',category:'owner',usage:'.الحالة التلقائية <تشغيل|إيقاف>',description:'إدارة الحالة التلقائية.',method:'للمالك.',...owner,execute:(s,c,m,a)=>autoStatusCommand(s,c,m,a)});
registry.register({name:'antidelete',aliases:[],localizedAliases:['منع الحذف'],localizedName:'منع الحذف',category:'owner',usage:'.منع الحذف <تشغيل|إيقاف>',description:'إدارة منع حذف الرسائل.',method:'للمالك.',...owner,execute:(s,c,m,a)=>handleAntideleteCommand(s,c,m,text(a))});
registry.register({name:'setgdesc',aliases:[],localizedAliases:['وصف','وصف المجموعة'],localizedName:'وصف',category:'group',usage:'.وصف <النص>',description:'تغيير وصف المجموعة.',method:'للمشرفين.',...admin,requireSenderAdmin:true,execute:(s,c,m,a,ctx)=>setGroupDescription(s,c,ctx.senderId,text(a),m,ctx.systems)});
registry.register({name:'setgname',aliases:[],localizedAliases:['اسم','اسم المجموعة'],localizedName:'اسم',category:'group',usage:'.اسم <الاسم>',description:'تغيير اسم المجموعة.',method:'للمشرفين.',...admin,requireSenderAdmin:true,execute:(s,c,m,a,ctx)=>setGroupName(s,c,ctx.senderId,text(a),m,ctx.systems)});
registry.register({name:'setgpp',aliases:[],localizedAliases:['صورة المجموعة'],localizedName:'صورة المجموعة',category:'group',usage:'.صورة المجموعة',description:'تغيير صورة المجموعة.',method:'رد على صورة.',...admin,requireSenderAdmin:true,execute:(s,c,m, a,ctx)=>setGroupPhoto(s,c,ctx.senderId,m,ctx.systems)});
registry.register({name:'autoread',aliases:[],localizedAliases:['القراءة التلقائية'],localizedName:'القراءة التلقائية',category:'owner',usage:'.القراءة التلقائية <تشغيل|إيقاف>',description:'إدارة القراءة التلقائية.',method:'للمالك.',...owner,execute:(s,c,m,a)=>autoreadCommand(s,c,m,text(a))});

// Owner observability dashboard.
registry.register({name:'bank-manager',aliases:['bankadmin'],localizedAliases:['مراقبة بنك','مدير البنك'],localizedName:'مراقبة بنك',category:'owner',usage:'.مراقبة بنك [إضافة|خصم|اشتراك|سعر]',description:'إدارة وتحليل اقتصاد Leo والاشتراكات.',method:'للمالك فقط.',ownerOnly:true,execute:(s,c,m,a,ctx)=>bankManagerCommand(s,c,ctx.senderId,m,a)});
registry.register({name:'monitor',aliases:['monitoring'],localizedAliases:['مراقبة','مراقبه','مراقبة البوت','مراقبه البوت'],localizedName:'مراقبة',category:'owner',usage:'.مراقبة [الأوامر|المزودات]',description:'لوحة مراقبة المالك: نشاط الأوامر وحالة الخدمات وتشخيص التشغيل.',method:'للمالك فقط. استخدم `.مراقبة الأوامر` أو `.مراقبة المزودات` أو `.مراقبة النظام` للتفاصيل.',ownerOnly:true,execute:monitorCommand});
