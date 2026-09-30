## Current release

- Version: `v1.37.6`
- Version source of truth: `package.json`
- Configuration template: `.env.example`
- Runtime secrets: `.env` only

# 🤖 Leo Bot

**Leo Bot** is a WhatsApp entertainment, assistant and AI bot built around Baileys.

- الاسم الظاهر: **ليو**
- اللغة الافتراضية: **العربية**
- Prefix: `.`
- الشخصية: ذكي، احترافي، ومرح
- المطوّر: **Leonardo**
- الحقوق: **Leonardo's Projects**

## أهم المكونات

- 🤖 AI مع Provider fallback وHealth/Circuit Breaker
- 📥 مزودات تحميل متعددة
- 🎮 ألعاب وترفيه
- 🎨 ملصقات ووسائط
- 👮 إدارة وحماية المجموعات
- 💾 تخزين JSON مركزي مع Atomic writes
- 🛟 Backup/Recovery للبيانات
- 🌐 Localization: العربية هي اللغة التشغيلية الحالية

## التشغيل

```bash
npm install
cp .env.example .env
npm start
```

## الاختبارات

```bash
npm test
npm run providers:health
```

## النسخ الاحتياطي

```bash
npm run data:backup
npm run data:backups
npm run data:restore -- <backup-name>
```

> القناة الرسمية غير مفعلة حاليًا ويمكن إضافتها مستقبلًا من الإعدادات.


## Media job architecture

Expensive media/download operations are scheduled through the lightweight in-process
`systems/jobs` manager. It provides bounded concurrency, FIFO queueing, cancellation,
runtime limits, lifecycle status, and stale-job cleanup without adding an external
queue service.

Provider retry/fallback remains inside the existing provider layer. The job manager
does not duplicate provider logic.

Video processing primitives live in `systems/media/video-pipeline.js` and are designed
for bounded probing, clipping, and optimization. They can be used later by the bot's
media-intelligence features without embedding a full desktop editor.
