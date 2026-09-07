## v1.37.6-review-3 — latest owner review decisions

- Approved/locked: `.منع الروابط`, `.منع التاق`, `.قول`, `.قولي`, `.كلمات`, `.وصف`, `.وصف المجموعة`, `.اسم`, `.اسم المجموعة`, `.صورة المجموعة`, `.مراقبة`.
- `.تطبيق`: selection now downloads directly without a confirmation step; APK metadata extraction was strengthened across BK9/APKPure/F-Droid.
- `.تحميل`: added ReelGrab as a final public fallback for YouTube/TikTok/Instagram/Facebook.
- `.لوجو`: improved Arabic text preservation.
- `.اشتراك`: Arabic plan aliases and user-facing labels expanded; command remains under review.

## v1.37.6-review-2 — owner decisions and runtime hardening

- Locked `.رفع الحظر`, `.سكرين`, and `.معلومات المجموعة` after explicit owner approval.
- Hardened `.منع التاق` detection for mass-mention tokens and large mention lists.
- `.قول` / `.قولي`: removed provider-dependent voice selection so male/female selection stays tied to the command across languages.
- `.كلمات`: kept Lyrics.ovh first and added LRCLIB fallback for Arabic/coverage gaps.
- `.منع الحذف`: group deletions are now reported back to the originating group; private deletions remain owner-only.
- Group-management dispatch now carries the real `isGroup` context into handlers, fixing false private-chat detection inside groups.
- `.مراقبة البنك` now routes explicitly to the bank-monitor area instead of the general dashboard.
- `.تطبيق`: added BK9 → APKPure → F-Droid search fallback chain and safer result handling.
- Message-handler errors from ordinary messages/reactions no longer produce the generic command failure response.

# LeoBot v1.37.6 — Owner Command Lock Expansion

- توسيع سجل الأوامر المقفلة باعتماد المالك إلى 32 أمرًا.
- إضافة القائمة الآلية `lib/owner-lock.js` وربطها بالـCommand Registry لتمييز الأوامر المقفلة تلقائيًا.
- إضافة `scripts-owner-lock-audit.js` وفحص `npm run audit:owner-lock` للتأكد من وجود جميع الأوامر المقفلة وعدم خروج Registry عن القائمة المعتمدة.
- تحديث `OWNER-NOTICE.md` ليكون المرجع الرسمي للقائمة الجديدة وسياسة القفل.
- لا يغيّر هذا التحديث سلوك الأوامر المقفلة؛ الهدف هو تثبيت حالة الاعتماد وحمايتها من التعديلات غير المصرح بها.

# LeoBot v1.37.6 — Owner-approved refinements

- إصلاح `.بروفايل` / `.مستوى`: المنشن أو الرد يعرض بطاقة العضو المستهدف بدل المرسل.
- إصلاح مغادرة `.مسابقة` أثناء سؤال جارٍ: الجائزة المصروفة والشيك والسجل تعتمد مكافأة آخر سؤال تمت الإجابة عنه، مع إبقاء آخر نقطة أمان موضحة بشكل منفصل.
- تحديث `OWNER-NOTICE.md` بسجل الأوامر المعتمدة والأوامر التي لم تعتمد بعد، مع قاعدة إذن صريح قبل تعديل الأوامر المعتمدة.
- لم يتم تغيير منطق الفوز الكامل في هذه النسخة؛ يبقى انتظار اختبار الفوز الثاني/الأول كما طلب المالك.


## v1.37.6 — Owner Notice R3
- اعتمد `.مساعدة` والواجهة الحالية كما هي.
- `.بنك` يعرض آخر 10 عمليات فقط، و`.سجل` آخر 10 عمليات.
- إصلاح تسجيل وتنفيذ `.تحويل` مع دعم المنشن أو الرد على العضو.
- تحسين صياغة `.رصيد` عند الاستعلام عن عضو بالرد على رسالته.
- المسابقة: مؤقت السؤال دقيقتان يبدأ من عرض السؤال ولا يُعاد عند الحروف أو المساعدات، مع عرض الزمن المتبقي.
- مغادرة نقطة الأمان أصبحت بتهدئة 5 دقائق، بينما المغادرة أثناء السؤال تبقى 15 دقيقة.
- شيك الجائزة يظهر عند نهاية المسابقة في الفوز والخسارة والمغادرة والتوقف، ويحسب فقط النيـورونات المكتسبة حتى آخر سؤال تمت إجابته دون احتساب خسائر أو خصومات.
- إضافة طبقة OmniRoute الذكية لـ`.صورة` كحل نهائي عند فشل الحصول على صورة مناسبة من البحث.
# v1.37.6 — Local AI Upscale

- إزالة الاعتماد على Free.ai من أمر `.تحسين`.
- إضافة Real-ESRGAN General x4v3 محليًا عبر ONNX Runtime على Railway، بدون API Key أو تكلفة لكل صورة.
- تنزيل نموذج Real-ESRGAN بحجم يقارب 4.87MB عند أول استخدام مع تحقق SHA-256 وتثبيت الإصدار.
- معالجة الصور الكبيرة على دفعات Tiles لتقليل استهلاك الذاكرة على موارد Railway.
- إبقاء Sharp كـ fallback محلي عند تعذر تشغيل نموذج الذكاء الاصطناعي.
- عدم تغيير بقية أوامر البوت أو اقتصاد Neurons.

# v1.37.5 — Free.ai Upscaler

- استبدال Stability AI في `.تحسين` بـ Free.ai Standard (Real-ESRGAN).
- استخدام رصيد Free.ai المجاني اليومي المعلن: 30,000 token/day، مع 500 token لكل صورة Real-ESRGAN.
- دعم 4× AI Upscaling عبر واجهة `/v1/image/upscale/`.
- إضافة `FREE_AI_API_KEY` بدل `STABILITY_API_KEY`.
- الإبقاء على Sharp كـ fallback محلي عند تعذر خدمة الذكاء الاصطناعي.

# v1.37.4 — AI Image Upscaling

- استبدال الاعتماد الأساسي على PrinceTechn في `.تحسين` بـ Stability AI Fast Upscaler.
- إضافة `STABILITY_API_KEY` بدل `PRINCE_API_KEY`.
- استخدام رفع دقة AI حقيقي حتى 4x مع تجهيز الصور لتوافق حدود الخدمة.
- الإبقاء على Sharp كمسار احتياطي محلي عند غياب المفتاح أو تعذر الخدمة.
- الحفاظ على واجهة `.تحسين` واقتصاد الأمر دون تغيير.

# v1.37.3 — Image Enhancement & Poetry Provider Cleanup

- جعل خدمة تحسين الصور الخارجية (PrinceTechn) المسار الأساسي عند توفر `PRINCE_API_KEY` مع تحسين التحقق من الناتج.
- تقوية المعالجة المحلية كمسار احتياطي للتعامل مع صيغ وصور واتساب المختلفة وتدوير EXIF وإخراج متوافق.
- استبدال مزود الشعر القديم بمصدر Qafiyah المفتوح للشعر العربي دون مفتاح API.
- إزالة `SHIZO_API_KEY` من إعدادات البيئة وتنظيف الاعتماد عليه.

# v1.37.2 — Command Cleanup

- إزالة كاملة لأمر Emoji Mix واعتماد Tenor المرتبط به.
- تنظيف زر Rose Day القديم من أمر الشعر.
- تنظيف رسائل الترجمة والمتغيرات البيئية الخاصة بالأوامر المحذوفة.
- تدقيق Registry وRetired Commands وعدم وجود أوامر فعالة غير مسجلة أو aliases متعارضة.

# v1.37.1 — Premium UI & Purchase Flow

- إعادة تصميم واجهة `.اشتراك` بواجهة Premium فاخرة وبطاقات Basic / Pro / Ultra.
- إضافة بطاقة اشتراك حالية مصورة مع حالة العضوية ومدة الصلاحية والمزايا.
- إضافة تدفق شراء واضح مع رقم طلب وإشعار تلقائي للمالك.
- فصل سعر الاشتراك المالي عن رصيد النيـورون بوضوح.
- الحفاظ على XP Boost وLuck Boost والمكافأة اليومية دون تغيير اقتصاد العمل أو المنافسة.

# v1.37.0 — Leo Progress & Premium

- نظام XP والمستويات وبطاقة المستوى.
- ربط مستوى XP بحظ الوظائف دون تغيير اقتصاد العمل الأساسي.
- مدير بنك للمالك مع إدارة وتحليل الأرصدة والاشتراكات.
- نظام اشتراكات Basic / Pro / Ultra وبطاقات الاشتراك.
- مكافأة دخول يومية للاشتراكات بتوقيت السودان.

# v1.35.30 — Code Cleanup

- تنظيف آمن للكود والملفات المساندة دون تغيير سلوك الأوامر.
- إزالة تقارير Markdown التاريخية غير اللازمة من حزمة النشر.
- الإبقاء على README وCHANGELOG وملفات التوثيق التشغيلي الأساسية.
- الحفاظ على الاقتصاد، آلية المسابقة، التهدئة، واجهة `.ليو` ولوحة المراقبة كما هي.

# v1.35.29 — Owner Monitoring Dashboard

- توسعة `.مراقبة` إلى لوحة مالك عربية موحدة.
- إضافة `.مراقبة النظام` لمعلومات التشغيل والذاكرة والمجموعات والنشاط.
- تحسين `.مراقبة الأوامر` و`.مراقبة المزودات` باستخدام الإطار الموحد.
- إزالة عرض أخطاء الخدمة الخام من لوحة المراقبة؛ تظهر التصنيفات فقط، مع بقاء التفاصيل في السجلات.
- لا تغيير في الاقتصاد أو أسعار المسابقة أو cooldown أو واجهة `.ليو`.

## v1.35.28 — Arabic Error & UX Polish

- تحسين شامل لرسائل الأخطاء للمستخدمين باللغة العربية.
- منع تسريب رسائل الاستثناءات والتفاصيل التقنية وأسماء مزودي الخدمات إلى الردود العادية.
- تعريب نصوص إعداد لقطة الشاشة والحذف التلقائي.
- تحديث أمثلة واجهة الذكاء الاصطناعي إلى `.ليو`.
- الإبقاء على التفاصيل التقنية داخل السجلات فقط.
- بدون تغيير أسعار الاقتصاد أو آليات المسابقة أو سلوك فترات الانتظار.


## v1.35.27 — Leo AI Interface Polish

- جعل `.ليو` الواجهة العامة الموحدة للذكاء الاصطناعي.
- إزالة أسماء مزودي الذكاء القديمة من aliases العامة.
- إبقاء اختيار المزود والـfallback داخليًا داخل طبقة AI.
- الحفاظ على السياق والوسائط ومنع التكرار والتحقق الخارجي.
- لم تتغير أسعار الاقتصاد أو ديناميكياته.

## v1.35.26 — Cooldown / Wait UX Polish

- تحسين رسائل الانتظار لتكون عربية وواضحة وتعرض المدة بصياغة مناسبة.
- توحيد رسالة الانتظار في المسار العام للعمل وفي أمر `عمل`.
- تعزيز نظام حجز الـ cooldown: عند فشل تنفيذ الأمر أو فشل مزود الخدمة يتم تحرير الحجز بدل معاقبة المستخدم بانتظار غير مستحق.
- الحفاظ على مدة الانتظار وآلية الاقتصاد وديناميكيات النظام دون تغيير.

## v1.35.25 — Economy Price Scale Alignment

- Repriced general Leo economy using the competition economy as the value benchmark.
- Updated service, AI, image, download and game prices only.
- Updated job payout values and fixed game rewards to the same denomination scale.
- Preserved all economy mechanics, cooldowns, weighting, bonus probability and transaction/refund lifecycle.
- Competition prices and competition mechanics were not modified.

## v1.35.24 — Economy Balance Polish

- Activated a balanced central price table for AI, image, search, media, and games.
- Standardized the user-facing currency name to **نيورون**.
- Kept work free to start, with a one-hour cooldown and weighted job earnings.
- Preserved competition-specific economy tables and existing refund/transaction semantics.
- Added an economy balance audit documenting income/expense rules.

## v1.35.23 — Unified Command Info Cards

- Standardized command metadata with version, developer, description, method, note, category, usage, cost, cooldown, and permission defaults.
- Upgraded `.مساعدة` command cards with a consistent information layout.
- Added a dedicated `💡 ملاحظة` section to every command card.
- Added a static help-metadata audit script to prevent incomplete cards.
- Synced README and package versions.

## v1.35.22 — Registry & Alias Cleanup

- Renamed the active migration-era registry files to `registry-core.js` and `registry-advanced.js`.
- Removed obsolete `legacy-registry.js` and `registry-phase2d.js` filenames from the active runtime.
- Removed redundant canonical command names duplicated inside their own `aliases` arrays.
- Preserved real compatibility aliases and all active command handlers.
- Updated registry/help/retired-command audits for the cleaned architecture.
- Added static registry preflight and alias-cleanup validation.
- Confirmed retired commands remain protected from accidental resurrection.

## v1.35.21

- Upgraded `@whiskeysockets/baileys` from `7.0.0-rc.9` to `7.0.0-rc.13`.
- Hardened WhatsApp connection handling for `401 / conflict / device_removed`.
- Preserve the session during the documented transient conflict case instead of deleting it immediately.
- Added bounded conflict reconnect attempts with configurable delay.
- Reset conflict retry counter after a successful connection.
- Real logout/401 paths still clear the session and require re-authentication.

## v1.35.20

### Event Modules + Storage Abstraction
- Split message, group-participant, and status event handlers into dedicated modules under `events/`.
- Added `events/index.js` as the single event wiring surface.
- Reduced `main.js` to process/runtime bootstrap responsibilities instead of feature event implementations.
- Added a single domain JSON storage facade at `lib/storage/index.js`; `lib/data-store.js` remains a compatibility alias.
- Kept `lib/lightweight_store.js` separate because it is specifically the Baileys in-memory/persisted message cache.
- Added `test:event-modules` static contract coverage.

## v1.35.19
- Added owner-only `.مراقبة` dashboard.
- Added `.مراقبة الأوامر` for latest command status (unused/success/failure + reason).
- Added `.مراقبة المزودات` for provider lifecycle/retry/classification/fallback/normalization visibility.
- Added bounded persistent command telemetry without sender/chat identifiers.
# v1.35.19 — Provider Retry Policy

- Added bounded transient-error retries in the shared provider orchestration layer.
- Honors `Retry-After` for 429 responses with a safety cap.
- Uses bounded exponential backoff when no server retry hint is available.
- Never retries permanent 4xx errors or provider circuit/probe guard errors.
- Added `test:provider-retry` regression coverage.

# v1.35.17 — Provider Error Classification

- Added shared Provider error classification: transient vs permanent vs unknown.
- HTTP 408/425/429 and 5xx/network/timeout errors remain eligible for circuit opening after repeated failures.
- HTTP 4xx validation/auth/not-found errors no longer poison the circuit into `open`; they remain `degraded`.
- Structured fallback errors now preserve provider, status, code, and classification metadata.
- Added `scripts-provider-error-classification-test.js` and `test:provider-errors`.

# Changelog

## v1.35.17 — Provider Result Normalization
- Added a canonical provider normalization boundary for media and anime results.
- Rejects invalid media URLs before a provider is treated as successful.
- Deduplicates media URLs and standardizes common provider field variants.
- Normalizes anime search records before ranking/merging.
- Added `test:provider-normalization` regression coverage.

## v1.35.15 — Provider Fallback Quality

- Provider fallback now rejects structurally unusable media results instead of treating any truthy object as success.
- Invalid media URLs from a provider are recorded as provider failures and the ordered fallback chain continues.
- Kitsu search results are now detail-resolvable through the Kitsu provider instead of returning a dead-end search result.
- Added regression coverage for invalid-result rejection, fallback continuation, and provider-order preservation.
- No provider order or user-facing pricing changes.

## v1.35.14 — Provider Lifecycle Hardening

- Standardized outbound HTTP cancellation with `AbortController` for core JSON/buffer requests.
- Downloader HTTP requests now have explicit cancellation timers, preventing timed-out requests from lingering indefinitely.
- OmniRoute requests and generated-media downloads now use bounded cancellation as well.
- Provider health probes now go through the circuit lifecycle, so half-open probes are concurrency-safe and successful probes update the same health state as normal calls.
- Provider health environment values are sanitized to positive numbers; invalid configuration falls back to safe defaults.
- No provider order, pricing, or user-facing command behavior was intentionally changed.

## v1.35.13 — Economy Transaction Consolidation

- Added `economy.runPaid()` as the single payment lifecycle for paid commands.
- Centralized charge, task execution, and refund-on-failure with single-refund protection.
- Migrated AI, image search, image generation, Sora, song, and video paid handlers.
- Kept zero-cost economy configuration unchanged; no user-facing prices were altered.
- Added regression coverage for successful payment, insufficient balance, and refund-on-failure.

## v1.35.12 — Cooldown + Economy Consistency

- Added tokenized cooldown reservations with safe rollback on handler failure before any response.
- Prevented stale rollback from clearing a newer cooldown.
- Preserved cooldown after partial-success responses.
- Added regression tests for cooldown reservation and atomic economy charge/refund behavior.
- Kept legacy economy adapter intentionally; central automatic charging is not enabled to avoid double-charging existing paid handlers.

## v1.35.11 — Command Contract Hardening

- Fixed composite permission contracts so `groupOnly + adminOnly + botAdminOnly` cannot degrade to sender-admin-only.
- `botAdminOnly` now takes precedence in canonical permission selection and automatically requires sender admin when `adminOnly` is also set.
- `groupOnly` is enforced independently before permission evaluation, including when the sender is the owner.
- Added `scripts-command-contract-test.js` and `npm run test:contracts`.

## v1.35.11 — Main Routing Cleanup

- Removed unused legacy command imports from `main.js` after registry migration.
- Removed unused third-party runtime imports from `main.js` (`yt-search`, `node-fetch`, `ytdl-core`, `axios`, `fluent-ffmpeg`).
- Kept only command handlers still required for interaction/event processing in `main.js`.
- No command behavior or registry metadata was intentionally changed.

## v1.35.7 — Registry Bootstrap Cleanup

- Removed the no-op `commands/registry-compat-aliases.js` compatibility shim.
- Simplified registry bootstrap by loading only active registry modules.
- Updated registry/help/retired/legacy audits to stop depending on the removed shim.
- Kept `legacy-registry.js` and `registry-phase2d.js` because they still contain active registrations; their names reflect migration history, not dead code.

## v1.35.7 — Legacy Cleanup

- Removed the unused `lib/providers/legacy-registry.js` inventory after a full repository reference audit confirmed it had no runtime or tooling consumers.
- Kept active command-registry compatibility modules unchanged because they are still part of the startup/audit path.
- No provider behavior or user-facing command was changed by this cleanup.


## v1.35.5 — Storage Stabilization

- Improved JSON storage atomicity and async write serialization.
- Prevented stale queued async writes from overwriting newer synchronous state.
- Rejected storage path traversal outside the data directory.
- JSON corruption is now reported explicitly instead of silently falling back.
- Lightweight Baileys store now tracks dirty state and preserves corrupt store files before reset.
- Added automated storage regression tests.

# Changelog

## 1.35.5

- Fixed the Registry Completeness Audit to exclude intentionally retired command modules from active coverage checks.
- The Registry audit now fails the release gate for genuinely unregistered active command modules, duplicate aliases, or metadata issues.
- Updated release/runtime version markers from v1.35.4 to v1.35.5.
- Prepared v1.35.5 as a stabilization release; no new user-facing command family was added.


## 1.35.4

- Updated the public command aliases to the new Arabic-first list requested for v1.35.4.
- Help now uses the first requested public Arabic alias as the displayed command name.
- Resolved the requested `تنزيل` alias collision by reserving it for media download; demote remains available as `خفض`.
- Hardened the PDF bridge to parse the final JSON payload even when the Python process emits harmless stdout diagnostics.
- Prevented OmniRoute TTS from sending the invalid `auto` model; OmniRoute is used only with an explicit `provider/model`, otherwise local TTS fallback is used.
- Added Kitsu as a third keyless anime fallback when AniList and Jikan are both unavailable.
- Added stable User-Agent headers and slightly longer anime provider timeouts.
- Hardened Shayari response parsing and Rose Day handling when `PRINCE_API_KEY` is missing.
- Stabilized RemoveBG registry routing through an explicit command function to avoid legacy registry binding errors.

1.35.3
- Added a hard retirement guard so explicitly deleted commands cannot be re-registered accidentally.
- Removed stale compatibility aliases for deleted share/upload commands.
- Added a retired-command audit to prevent regressions.


## 1.35.2
- Fixed the `.مساعدة` crash caused by a circular `registry-init -> legacy-registry -> help -> registry-init` dependency.
- Help now loads the completed registry lazily and no longer captures a partial module export.
- Unified Help/Menu visibility through the registry; hidden/internal commands are excluded from both generated command lists.
- Added `helpVisible` metadata as an explicit visibility gate for future retired/internal commands.
- Added a dedicated Help/Registry regression audit and npm script: `npm run audit:help`.
- Registry metadata and routing checks remain enforced before release.

# CHANGELOG

## 1.35.1
- إصلاح توجيه الأوامر العربية متعددة الكلمات عبر مطابقة أطول أمر مسجل قبل تحويل الاختصارات، لمنع تعارض `صورة الملصق` مع `صورة` و`صورة المجموعة` و`صورة البروفايل` وغيرها.
- تحسين `.سورا` بإرسال حالة نجاح/فشل واضحة، مع تأكيد استرداد التكلفة عند الفشل.
- إصلاح `.قول` و`.قولي`: العربية تستخدم مسار Edge المحلي بصوت ذكر/أنثى صحيح، بينما اللغات الأخرى تستمر عبر AI أولًا.
- تمرير جنس الصوت إلى OmniRoute للغات غير العربية مع أصوات افتراضية منفصلة.
- إصلاح خطأ `Assignment to constant variable` في Remini.
- حماية `.ليلة سعيدة` من استجابة API غير النصية التي كانت تسبب `Invalid media type`.

# Changelog

## 1.35.0 — Production Hardening

- Unified bot versioning around `package.json`.
- Removed hardcoded owner number fallback.
- Added `.env.example` configuration reference.
- Hardened the ZIP updater with HTTPS, host allowlisting, size limits, redirect validation, and ZIP path checks.
- Replaced shell-string FFmpeg execution with argument-based process spawning in media conversion paths.
- Fixed duplicate sticker fallback logic that could discard a successful fallback encode.
- Removed obsolete versioned project-history documents from the release root.

## v1.35.11 — Interaction Contract Hardening
- Centralized media/reply/mention extraction in `systems/input`.
- Added explicit interaction validation in the command registry dispatch path.
- Added fail-closed validation for commands that explicitly declare media, reply, or mention requirements.
- Added interaction regression tests.

## 2026-09-06 — Command review batch
- اعتماد `.اقتباس` و`.أخبار` و`.التوب` وإضافتها إلى قائمة الأوامر المقفلة.
- حذف أمر `.حالة` من الـCommand Registry بناءً على قرار المالك.
- إزالة alias `.رصيدي` مع الإبقاء على `.رصيد`.
- تطوير `.أخبار`: إزالة الروابط من القائمة، دعم البحث عبر `.أخبار <الخبر>`, وإضافة عرض الخبر المختار بشكل مكبّر عند الرد برقم الخبر.
- إصلاح `.معلومات المجموعة` مع معالجة أكثر أمانًا لمعرفات المشاركين والمالك ورسالة الخطأ.

## v1.37.6 — runtime fixes (2026-09-07)
- `.لوجو`: Arabic text now keeps the original Ephoto360 template/background and replaces only the generated Latin word, instead of switching to an unrelated local design.
- `.تطبيق`: search results are ranked by relevance across multiple sources; Arabic common app names are normalized; APKCombo download flow now handles its current check-in/variant flow; maximum package size raised to 2 GB.
- `.تحميل` / `.تنزيل`: added AllDL as another universal provider/fallback for YouTube, TikTok, Instagram, Facebook and additional public social links; direct media cap raised to 2 GB.
- `.منع الحذف`: removed the phone-number line from the deletion report; the bot itself remains the only protected sender from anti-delete reports.

## v1.37.6 — logo behavior correction (2026-09-07)
- `.لوجو`: removed Arabic text rendering completely; the command now uses the original Ephoto360 template directly.
- Arabic input is rejected explicitly instead of producing a different/unrelated design.
- Help/card text now clearly states that Arabic is not supported and gives the requested example `.لوجو ناروتو Leo`.

## v1.37.6 — owner follow-up fixes (2026-09-07)
- `.لوجو`: Arabic text rendering support removed completely. The command now requires English text and the command card explicitly states that Arabic is unavailable. Example: `.لوجو ناروتو Leo`.
- `.تطبيق`: fixed the current APKPure download flow so it resolves the real `d.apkpure.net` APK/XAPK file instead of returning the HTML download page.
- `.منع الحذف`: album images are now detected through WhatsApp's album association metadata, queued briefly, reported once, then recovered as a single native WhatsApp album. Single-image deletions keep the previous behavior.


## v1.37.6 — media downloader reliability follow-up (2026-09-07)
- `.تحميل` / `.تنزيل`: every video/audio/image result is normalized before WhatsApp delivery instead of trusting the provider's original container/codec. Videos are converted to H.264/AAC MP4 at up to 720p, audio to MP3, and images to JPEG with a size/dimension cap.
- Provider fallback now verifies that returned CDN links are actually reachable before accepting a provider; stale/HTML/error links no longer stop the fallback chain.
- X/Twitter now tries ReelGrab first so image/carousel results can be preserved, then AllDL and public-page metadata.
- YouTube gained a local `@distube/ytdl-core` fallback after remote providers.
- Added universal routing/fallback coverage for Reddit, Pinterest, Threads, Snapchat, CapCut, Douyin, SnackVideo/Kwai and SoundCloud; Pinterest uses ReelGrab/OG fallback and Threads uses public page metadata when media is exposed.
- AllDL quality selection now prefers a compatible video at or below 720p when quality variants are supplied, reducing oversized WhatsApp deliveries.

## v1.37.6 — downloader A/B experiment (2026-09-07)
- `.تحميل` now inspects the media before delivery: images and audio are sent immediately through smart normalization; videos open a reply-based quality menu with available resolution and file-size information when the provider exposes it.
- Quality selection is bound to the exact menu message and the requesting user, expires after 10 minutes, and does not consume ordinary standalone numeric messages.
- Added experimental `.سنابتيوب` as a separate public command for A/B testing. Its primary path uses a single universal downloader strategy first, with the existing universal social fallback only when the experimental engine cannot resolve the URL.
- Both paths reuse the existing WhatsApp-compatible media optimizer so the experiment compares downloader/extraction behavior rather than incompatible output files.
