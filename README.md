## Current release

- Version: `v1.35.26`
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
