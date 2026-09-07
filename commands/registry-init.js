const registry = require('../lib/command-registry');
const add = require('./add');
const apk = require('./apk');
const mediaDownload = require('./media-download');
const snaptube = require('./snaptube');
const logo = require('./logo');
const { pdfCommand } = require('./pdf');

registry.register({ name:'تحميل', aliases:['download'], localizedAliases:['تنزيل'], localizedName:'تحميل', category:'download', usage:'.تحميل <رابط> أو .تنزيل <رابط>', descriptionKey:'registry.download.description', methodKey:'registry.download.method', execute:mediaDownload });
registry.register({ name:'snaptube', aliases:[], localizedAliases:['سنابتيوب'], localizedName:'سنابتيوب', category:'download', usage:'.سنابتيوب <رابط>', descriptionKey:'registry.snaptube.description', methodKey:'registry.snaptube.method', execute:snaptube });
registry.register({ name:'apk', aliases:[], localizedAliases:['تطبيق'], localizedName:'تطبيق', category:'download', usage:'.تطبيق <اسم التطبيق>', descriptionKey:'registry.apk.description', methodKey:'registry.apk.method', execute:apk });
registry.register({ name:'add', aliases:[], localizedAliases:['إضافة','اضافة','اضافه','إضافه'], localizedName:'إضافة', category:'group', usage:'.add <رقم>', descriptionKey:'registry.add.description', methodKey:'registry.add.method', groupOnly:true, adminOnly:true, botAdminOnly:true, execute:add });
registry.register({ name:'logo', aliases:[], localizedAliases:['لوجو','شعار'], localizedName:'لوجو', category:'image', usage:'.لوجو <النمط> <النص الإنجليزي>', descriptionKey:'registry.logo.description', methodKey:'registry.logo.method', execute:logo });
registry.register({ name:'pdf', aliases:[], localizedAliases:['مستند'], localizedName:'مستند', category:'utility', categoryKey:'utility', interaction:'media', usage:'.pdf', description:'تحويل ومعالجة ملفات PDF وWord وPowerPoint وExcel والصور.', method:'أرسل الملف مع `.pdf` أو رد بالأمر على الملف.', version:'1.35.6', developer:'Leonardo', execute:pdfCommand });
// Phase 2: migrate existing main.js-routed commands into the same registry.
require('./registry-core');

module.exports = registry;

require('./registry-advanced');

