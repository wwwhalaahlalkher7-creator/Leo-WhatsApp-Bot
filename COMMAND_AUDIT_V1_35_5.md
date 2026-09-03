# Leo Bot — Full Command Audit v1.35.5

## النطاق
هذا التدقيق يفحص كل أمر مسجل في Registry، مع فحص التغطية، الصلاحيات، الـaliases، وبيانات Help ومؤشرات الاعتماد على خدمات خارجية أو الملفات/العمليات.

> **مهم:** هذا تدقيق ثابت (Static). لا يعني أن كل مزود خارجي أو جلسة WhatsApp تعمل فعليًا في بيئة الإنتاج.

## خط الأساس الذي تم التحقق منه
- **77 أمرًا مسجلًا**
- **237 اسمًا/alias فريدًا** في Registry preflight
- **0 وحدات أوامر نشطة غير مسجلة**
- **6 وحدات أوامر متقاعدة مستثناة عمدًا**
- **0 aliases متعارضة**
- **0 مشاكل في metadata**
- **191 ملف JavaScript** نجح في فحص Syntax

### نتيجة v1.35.5
تم إصلاح مشكلة في أداة Registry Audit كانت تعتبر الأوامر المتقاعدة غير المسجلة أخطاء. الآن يتم استثناؤها صراحةً، كما أن وجود أمر نشط غير مسجل يجعل الـaudit يفشل بدل إصدار تحذير فقط.

## مصفوفة الأوامر

> جميع الأوامر أدناه مأخوذة من مصفوفة الإصدار السابقة بعد تصحيحها لتطابق Registry v1.35.5؛ تم استبدال `goodnight` المتقاعد بـ `shayari` النشط.
| الأمر | الفئة | الصلاحية | الاستخدام | مؤشرات ثابتة |
|---|---|---|---|---|
| `تحميل` | download | public | `.تحميل <رابط>` | user-input/high-impact |
| `apk` | download | public | `.تطبيق <اسم التطبيق>` | external-api, process, filesystem, user-input/high-impact |
| `add` | group | admin | `.add <رقم>` | — |
| `image-ai` | image | public | `.حلل صورة <اختياري: طلب>` | — |
| `logo` | image | public | `.لوجو <النمط> <النص>` | external-api |
| `pdf` | utility | public | `.pdf` | filesystem, media |
| `menu` | basic | public | `.القائمة` | — |
| `owner` | utility | public | `.المالك` | — |
| `quote` | fun | public | `.اقتباس` | — |
| `fact` | fun | public | `.معلومة` | — |
| `news` | utility | public | `.أخبار` | external-api |
| `topmembers` | level | group | `.توب_الأعضاء` | — |
| `alive` | utility | public | `.حالة` | — |
| `balance` | economy | public | `.رصيد` | — |
| `bank` | economy | public | `.بنك` | — |
| `transactions` | economy | public | `.سجل` | — |
| `work` | economy | public | `.عمل` | — |
| `kick` | group | admin | `.طرد @عضو` | — |
| `mute` | group | admin | `.كتم <تشغيل\|إيقاف\|الدقائق>` | — |
| `ban` | group | admin | `.حظر @عضو` | — |
| `unban` | group | admin | `.رفع الحظر @عضو` | — |
| `warn` | group | admin | `.تحذير @عضو [السبب]` | filesystem |
| `warnings` | group | group | `.تحذيرات @عضو` | — |
| `promote` | group | admin | `.ترقية @عضو` | — |
| `demote` | group | admin | `.خفض @مشرف` | — |
| `tag` | group | admin | `.منشن [الكل\|غير المشرفين\|النص]` | filesystem, media |
| `antilink` | group | admin | `.منع الروابط on\|off\|get\|warn\|kick\|delete` | external-api |
| `antitag` | group | admin | `.منع التاق on\|off\|get` | — |
| `groupinfo` | group | group | `.معلومات المجموعة` | — |
| `sticker` | sticker | public | `.ملصق` | process, filesystem, media |
| `tts` | audio | public | `.قولي <النص>` | filesystem |
| `ttsmale` | audio | public | `.قول <النص>` | — |
| `delete` | group | public | `.حذف` | — |
| `settings` | owner | owner | `.إعدادات` | — |
| `weather` | utility | public | `.طقس <المدينة>` | external-api |
| `lyrics` | audio | public | `.كلمات الأغاني <الأغنية>` | external-api |
| `blur` | image | public | `.تمويه` | — |
| `play` | download | public | `.أغنية <البحث أو الرابط>` | user-input/high-impact |
| `video` | download | public | `.فيديو <البحث أو الرابط>` | user-input/high-impact |
| `ai` | ai | public | `.ليو <السؤال>` | — |
| `translate` | utility | public | `.ترجمة <النص>` | external-api |
| `ss` | image | public | `.لقطة <الرابط>` | external-api, user-input/high-impact |
| `shayari` | fun | public | `.شعر` | external-api |
| `imagine` | image | public | `.تخيل <الوصف>` | user-input/high-impact |
| `image` | image | public | `.صورة <البحث>` | user-input/high-impact |
| `removebg` | image | public | `.إزالة الخلفية` | external-api, process, media, user-input/high-impact |
| `remini` | image | public | `.تحسين` | external-api, media, user-input/high-impact |
| `sora` | ai | public | `.سورا <الوصف>` | user-input/high-impact |
| `vv` | utility | public | `.عرض` | — |
| `clearsession` | owner | owner | `.مسح الجلسة` | filesystem |
| `setpp` | owner | owner | `.صورة البروفايل` | filesystem, media |
| `character` | fun | public | `.شخصية` | — |
| `wanted` | fun | public | `.مطلوب @عضو` | external-api |
| `ship` | fun | public | `.توافق @عضو` | — |
| `help` | basic | public | `.مساعدة` | — |
| `approve` | owner | owner | `.موافقة [معرّف المجموعة]` | — |
| `leave` | owner | owner | `.مغادرة [معرّف المجموعة]` | — |
| `update` | owner | owner | `.تحديث` | process, filesystem |
| `mode` | owner | owner | `.وضع عام\|خاص` | — |
| `anime` | anime | public | `.أنمي <اسم الأنمي>` | — |
| `simage` | image | public | `.صورة الملصق` | filesystem, media |
| `bot` | owner | owner | `.البوت <تشغيل\|إيقاف>` | — |
| `pmblocker` | owner | owner | `.حظر الاتصالات <تشغيل\|إيقاف\|حالة>` | — |
| `ttt` | game | public | `.اكس او` | — |
| `guess` | game | public | `.خمن` | — |
| `trivia` | game | public | `.مسابقة` | — |
| `contest-history` | game | public | `.سجل المسابقة` | — |
| `welcome` | group | admin | `.ترحيب` | — |
| `goodbye` | group | admin | `.وداع` | — |
| `antibadword` | group | admin | `.منع الكلمات <تشغيل\|إيقاف>` | — |
| `chatbot` | group | admin | `.شات بوت <تشغيل\|إيقاف>` | — |
| `autostatus` | owner | owner | `.الحالة التلقائية <تشغيل\|إيقاف>` | — |
| `antidelete` | owner | owner | `.منع الحذف <تشغيل\|إيقاف>` | filesystem, media |
| `setgdesc` | group | admin | `.وصف <النص>` | — |
| `setgname` | group | admin | `.اسم <الاسم>` | — |
| `setgpp` | group | admin | `.صورة المجموعة` | — |
| `autoread` | owner | owner | `.القراءة التلقائية <تشغيل\|إيقاف>` | filesystem |

## الإصلاحات المكتملة

### إصلاحات Help/Registry السابقة
- Fixed the circular Help/Registry module dependency that caused `.مساعدة` to fail at runtime.
- Added explicit `helpVisible` metadata and unified generated Help/Menu visibility.
- Added `scripts-help-registry-audit.js` and `npm run audit:help`.
1. Fixed `remini` response-module shadowing that could break its local fallback path.
2. Centralized runtime User-Agent version strings on `settings.version`.
3. Removed the obsolete hardcoded help-version fallback.
4. Kept SSRF validation centralized in `lib/url-security.js` for user-supplied HTTP(S) media URLs.
5. Hardened ZIP update validation with HTTPS/host allowlisting, size limits, path traversal checks, and post-extraction symlink rejection.
6. Replaced shell-based `unzip -Z1` invocation with `execFile` so the archive path is not interpreted by a shell.

## بوابات الإصدار المتبقية
- Install dependencies successfully on the target host.
- Start Leo Bot with a real WhatsApp session.
- Run provider checks and systems tests.
- Manually exercise media/download/AI/group-admin commands.
- Confirm all configured API credentials and external providers.

## الحكم النهائي
**تدقيق الأوامر والأمان الثابت: ناجح.**

**اعتماد الإنتاج الفعلي: لم يتم ادعاؤه بعد، لأن الاختبارات التي تحتاج dependencies وWhatsApp وProviders يجب تنفيذها على بيئة التشغيل الحقيقية.**

### v1.35.3 command cleanup
- Retired the interaction category commands: `وخزة`, `بكاء`, `قبلة`, `ربت`, `حضن`, `غمزة`, `فيس بالم`.
- Protected the retired command names/aliases against accidental re-registration.
- Removed the obsolete `سودو` command module; its authorization helpers remain internal because other runtime permission checks use them.
- Stale `مشاركة`/`ارفع` compatibility aliases were removed.

> v1.35.4 PDF FINAL alias cleanup: `shayari` remains active as `.شعر`; six commands were retired per the release alias decision.
