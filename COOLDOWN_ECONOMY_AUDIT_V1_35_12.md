# Cooldown + Economy Audit — v1.35.12

## الهدف
تقوية اتساق الـ cooldown والاقتصاد دون فرض middleware اقتصادي مركزي على الأوامر القديمة التي تنفذ الخصم داخليًا.

## التغييرات
- الـ CooldownManager أصبح يدعم reservation token قابلًا للإلغاء بأمان.
- إذا فشل handler قبل إرسال أي رد، يتم تحرير cooldown المحجوز.
- إذا أرسل handler ردًا ثم فشل، يبقى cooldown لأن التنفيذ قد يكون نجح جزئيًا.
- rollback محمي بـ token لمنع حذف cooldown أحدث من استدعاء متزامن.
- الاقتصاد بقي atomic عبر `JsonStore.update`.
- لم يتم تفعيل خصم مركزي تلقائي لأن معظم أوامر الدفع الحالية تنفذ `chargeFor()` داخل handlers؛ تفعيله الآن كان سيؤدي إلى double-charge.
- يمكن تفعيل economy middleware لاحقًا لأوامر جديدة مصممة له صراحة.

## الاختبارات
- cooldown reservation rollback: PASS
- stale-token protection: PASS
- atomic charge/refund model: PASS
- JavaScript syntax: PASS

## قرار هندسي
لا نحذف `lib/economy/credits.js` الآن؛ هو compatibility/storage adapter حقيقي. الانتقال الآمن يتطلب أولًا توحيد جميع handlers المدفوعة على transaction API واحد.
