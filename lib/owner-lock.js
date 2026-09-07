/**
 * LeoBot Owner Lock
 *
 * This is the machine-readable counterpart of OWNER-NOTICE.md.
 * Locked commands must not be functionally modified without explicit owner approval.
 * The lock is intentionally an audit/metadata guard; it does not prevent the owner
 * from changing source files deliberately.
 */
const LOCKED_COMMANDS = Object.freeze([
  'مساعدة', 'بنك', 'رصيد', 'تحويل', 'سجل', 'عمل', 'خمن', 'اغنية', 'فيديو',
  'المالك', 'مسابقة', 'طرد', 'مغادرة', 'موافقة', 'تحذير', 'تحذيرات', 'وداع',
  'ترحيب', 'ترقية', 'خفض', 'كتم', 'حظر', 'تمويه', 'تخيل', 'طقس', 'ترجمة',
  'عرض', 'سكرين', 'معلومة', 'مستوى', 'أنمي', 'إعدادات', 'اكس او', 'اقتباس', 'أخبار', 'التوب',
  'منشن', 'رفع الحظر', 'ملصق', 'شعر', 'شخصية', 'القراءة التلقائية', 'سجل المسابقة', 'إضافة', 'معلومات المجموعة', 'منع الروابط', 'منع التاق', 'قول', 'قولي', 'كلمات', 'وصف', 'وصف المجموعة', 'اسم', 'اسم المجموعة', 'صورة المجموعة', 'مراقبة'
]);

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/^\./, '');
}

const LOCKED_NORMALIZED = new Set(LOCKED_COMMANDS.map(normalize));

function isLockedName(value) {
  return LOCKED_NORMALIZED.has(normalize(value));
}

function isLockedDefinition(definition) {
  if (!definition) return false;
  if (isLockedName(definition.name) || isLockedName(definition.localizedName)) return true;
  return [
    ...(Array.isArray(definition.aliases) ? definition.aliases : []),
    ...(Array.isArray(definition.localizedAliases) ? definition.localizedAliases : []),
  ].some(isLockedName);
}

function lockedNames() {
  return [...LOCKED_COMMANDS];
}

module.exports = { LOCKED_COMMANDS, lockedNames, isLockedName, isLockedDefinition, normalize };
