# Leo Bot — Full Command Audit v1.35.5

## Scope
Static audit of every registered command. Help visibility and circular-load regression checks are included in v1.35.3. It verifies registry coverage, permission metadata, input/side-effect signals, and known remediation items. Live provider availability still requires a real runtime environment.

## Verified baseline

> v1.35.5 note: retired command modules are intentionally excluded from active Registry coverage.
- 77 registered commands
- 238 unique names/aliases in registry preflight
- 0 unregistered command modules
- 0 duplicate aliases
- 0 registry metadata issues
- 188 JavaScript files pass syntax validation

## Command matrix
| Command | Category | Permission | Usage | Static signals |
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
| `goodnight` | fun | public | `.ليلة سعيدة` | external-api |
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

## Remediation completed

### v1.35.3 Help/Registry fixes
- Fixed the circular Help/Registry module dependency that caused `.مساعدة` to fail at runtime.
- Added explicit `helpVisible` metadata and unified generated Help/Menu visibility.
- Added `scripts-help-registry-audit.js` and `npm run audit:help`.
1. Fixed `remini` response-module shadowing that could break its local fallback path.
2. Centralized runtime User-Agent version strings on `settings.version`.
3. Removed the obsolete hardcoded help-version fallback.
4. Kept SSRF validation centralized in `lib/url-security.js` for user-supplied HTTP(S) media URLs.
5. Hardened ZIP update validation with HTTPS/host allowlisting, size limits, path traversal checks, and post-extraction symlink rejection.
6. Replaced shell-based `unzip -Z1` invocation with `execFile` so the archive path is not interpreted by a shell.

## Remaining release gates
- Install dependencies successfully on the target host.
- Start Leo Bot with a real WhatsApp session.
- Run provider checks and systems tests.
- Manually exercise media/download/AI/group-admin commands.
- Confirm all configured API credentials and external providers.

## Verdict
**Static command/security audit: PASS.**

**Production runtime certification: not yet claimed.**

### v1.35.3 command cleanup
- Retired the interaction category commands: `وخزة`, `بكاء`, `قبلة`, `ربت`, `حضن`, `غمزة`, `فيس بالم`.
- Protected the retired command names/aliases against accidental re-registration.
- Removed the obsolete `سودو` command module; its authorization helpers remain internal because other runtime permission checks use them.
- Stale `مشاركة`/`ارفع` compatibility aliases were removed.

> v1.35.4 PDF FINAL alias cleanup: `shayari` remains active as `.شعر`; six commands were retired per the release alias decision.
