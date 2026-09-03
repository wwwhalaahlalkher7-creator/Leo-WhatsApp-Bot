'use strict';

// Commands explicitly retired in the LeoBot command cleanup report.
// Keep both canonical names and public aliases here so a future migration
// cannot accidentally resurrect a deleted command.
const RETIRED_COMMANDS = new Set([
  'language', 'لغة',
  'github', 'جيت هاب',
  'vcard', 'contact', 'جهة اتصال',
  'groupid', 'معرف المجموعة',
  'sudo', 'سودو',
  'autoreact', 'areact', 'تفاعل تلقائي',
  'autotyping', 'الكتابة التلقائية',
  'clearstemp', 'cleartemp', 'مسح المؤقت',
  'admininfo', 'معلومات المشرفين',
  'fancy', 'زخرفة',
  'joke', 'نكتة',
  'meme', 'ميم',
  'stupid', 'غبي',
  'poke', 'وخزة',
  'cry', 'بكاء',
  'kiss', 'قبلة',
  'pat', 'ربت',
  'hug', 'حضن',
  'wink', 'غمزة',
  'facepalm', 'فيس بالم',
  // User-requested command removals in v1.35.4 PDF FINAL.
  'goodnight', 'lovenight', 'gn', 'ليلة سعيدة',
  'roseday', 'يوم الورد',
  'emojimix', 'emix', 'دمج ايموجي',
  'flirt', 'غزل',
  'anticall', 'المكالمة التلقائية',
  'mention', 'منشن تلقائي'
]);

function isRetired(value) {
  return RETIRED_COMMANDS.has(String(value || '').trim().toLowerCase());
}

module.exports = { RETIRED_COMMANDS, isRetired };
