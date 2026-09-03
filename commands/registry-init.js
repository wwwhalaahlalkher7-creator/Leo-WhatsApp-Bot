const registry = require('../lib/command-registry');
const add = require('./add');
const apk = require('./apk');
const mediaDownload = require('./media-download');
const logo = require('./logo');
const imageAI = require('./image-ai');
const { pdfCommand } = require('./pdf');

registry.register({ name:'تحميل', aliases:['download'], localizedAliases:['تنزيل'], localizedName:'تحميل', category:'download', usage:'.تحميل <رابط>', descriptionKey:'registry.download.description', methodKey:'registry.download.method', execute:mediaDownload });
registry.register({ name:'apk', aliases:[], localizedAliases:['تطبيق'], localizedName:'تطبيق', category:'download', usage:'.تطبيق <اسم التطبيق>', descriptionKey:'registry.apk.description', methodKey:'registry.apk.method', execute:apk });
registry.register({ name:'add', aliases:[], localizedAliases:['إضافة','اضافة','اضافه','إضافه'], localizedName:'إضافة', category:'group', usage:'.add <رقم>', descriptionKey:'registry.add.description', methodKey:'registry.add.method', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:add });
registry.register({ name:'image-ai', aliases:['vision'], localizedAliases:['حلل صورة','تحليل صورة','وصف صورة','برومبت صورة'], localizedName:'تحليل صورة', category:'image', interaction:'media', usage:'.حلل صورة <اختياري: طلب>', description:'تحليل الصور واستخراج النص منها أو إنشاء Prompt احترافي انطلاقًا منها.', method:'أرسل صورة مع الأمر أو رد بالأمر على صورة.', execute:imageAI });
registry.register({ name:'logo', aliases:[], localizedAliases:['لوجو','شعار'], localizedName:'لوجو', category:'image', usage:'.لوجو <النمط> <النص>', descriptionKey:'registry.logo.description', methodKey:'registry.logo.method', execute:logo });
registry.register({ name:'pdf', aliases:[], localizedAliases:['مستند'], localizedName:'مستند', category:'utility', categoryKey:'utility', interaction:'media', usage:'.pdf', description:'تحويل ومعالجة ملفات PDF وWord وPowerPoint وExcel والصور.', method:'أرسل الملف مع `.pdf` أو رد بالأمر على الملف.', version:'1.35.6', developer:'Leonardo', execute:pdfCommand });
// Phase 2: migrate existing main.js-routed commands into the same registry.
require('./legacy-registry');

module.exports = registry;

require('./registry-phase2d');

