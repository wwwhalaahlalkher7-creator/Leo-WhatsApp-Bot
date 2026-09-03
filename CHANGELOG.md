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
- Retired six user-facing commands: goodnight, roseday, emojimix, flirt, anticall and mention.
- Help now uses the first requested public Arabic alias as the displayed command name.
- Resolved the requested `تنزيل` alias collision by reserving it for media download; demote remains available as `خفض`.
- Hardened the PDF bridge to parse the final JSON payload even when the Python process emits harmless stdout diagnostics.
- Prevented OmniRoute TTS from sending the invalid `auto` model; OmniRoute is used only with an explicit `provider/model`, otherwise local TTS fallback is used.
- Added Kitsu as a third keyless anime fallback when AniList and Jikan are both unavailable.
- Added stable User-Agent headers and slightly longer anime provider timeouts.
- Hardened Shayari response parsing and Rose Day handling when `PRINCE_API_KEY` is missing.
- Stabilized RemoveBG registry routing through an explicit command function to avoid legacy registry binding errors.

1.35.3
- Retired the obsolete interaction/reaction command family: poke, cry, kiss, pat, hug, wink, facepalm.
- Added a hard retirement guard so explicitly deleted commands cannot be re-registered accidentally.
- Removed stale compatibility aliases for deleted share/upload commands.
- Kept internal autotyping/reaction infrastructure where it is still used by the bot runtime; the retired user commands are no longer exposed or routable.
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
