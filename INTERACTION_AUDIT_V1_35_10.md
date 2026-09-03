# Interaction Contract Audit — v1.35.10

## الهدف
منع وصول الأوامر التي تتطلب صورة/فيديو/ملف أو رد أو منشن إلى الـ handler دون تحقق موحد.

## التغيير
- `systems/input` أصبح المصدر الموحد لاستخراج الوسائط المباشرة والمقتبسة والـ mentions والـ reply context.
- `systems/interaction.validate()` يتحقق من العقود المعلنة صراحة.
- `lib/command-registry.dispatch()` يطبق التحقق قبل cooldown والتنفيذ.
- العقود المستنتجة تلقائيًا من النص القديم لا تُفرض قسرًا؛ التحقق الإلزامي يُفعل فقط عند التصريح بـ `interaction`/`interactionType`، لتجنب كسر التوافق.

## العقود الصريحة التي تم تشديدها
media: image-ai, pdf, sticker, blur, removebg, remini, setpp
reply-required: simage, delete, viewonce
mention-or-reply: tag, wanted
mention: ship

## اختبارات
- media direct: PASS
- media quoted: PASS
- reply required: PASS
- mention required: PASS
- mention-or-reply: PASS
- fail-closed invalid input: PASS
