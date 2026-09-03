'use strict';

/** User-facing Arabic labels for economy transaction reasons. */
const REASON_LABELS = Object.freeze({
  'welcome:initial-balance': 'رصيد ترحيبي',
  'bank:transfer': 'تحويل بنكي',
  'search:image': 'بحث عن صورة',
  'ai:imagine': 'توليد صورة بالذكاء الاصطناعي',
  'ai:sora': 'توليد فيديو بالذكاء الاصطناعي',
  'download:song': 'تحميل أغنية',
  'download:video': 'تحميل فيديو',
  'ai:ai': 'سؤال للذكاء الاصطناعي',
  'refund:ai:imagine': 'استرداد تكلفة توليد صورة',
  'refund:ai:sora': 'استرداد تكلفة توليد فيديو',
  'refund:download:song': 'استرداد تكلفة تحميل أغنية',
  'refund:download:video': 'استرداد تكلفة تحميل فيديو',
  'refund:search:image': 'استرداد تكلفة بحث صورة',
});

function formatReason(reason = '') {
  const value = String(reason || '');
  if (REASON_LABELS[value]) return REASON_LABELS[value];
  if (value.startsWith('work:')) return `دخل العمل: ${value.slice(5)}`;
  if (value.startsWith('game:tictactoe')) return 'دخول لعبة إكس-أو';
  if (value.startsWith('game:guess')) return 'دخول لعبة خمن';
  if (value.startsWith('game:trivia')) return 'دخول مسابقة';
  if (value.startsWith('game:reward:tictactoe')) return 'جائزة الفوز في إكس-أو';
  if (value.startsWith('game:reward:guess')) return 'جائزة الفوز في خمن';
  if (value.startsWith('game:reward:trivia')) return 'جائزة الفوز في المسابقة';
  if (value.startsWith('game:refund:tictactoe')) return 'استرداد رسوم التعادل في إكس-أو';
  return value.replace(/^ai:/, 'الذكاء الاصطناعي: ').replace(/^download:/, 'التحميل: ');
}

module.exports = Object.freeze({ REASON_LABELS, formatReason });
