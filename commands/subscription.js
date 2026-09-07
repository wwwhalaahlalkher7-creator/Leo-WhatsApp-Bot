'use strict';
const sharp = require('sharp');
const { safeProfileBuffer } = require('../lib/image-output');
const subs = require('../systems/subscriptions');
const input = require('../systems/input');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

function esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function money(v) { return `$${Number(v || 0).toFixed(2)}`; }
function dateAr(ts) { return new Date(ts).toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' }); }

function premiumMenuSvg(plans) {
  const p = plans;
  const card = (x, plan, title, subtitle, daily, xp, luck, accent, featured=false) => `
    <g>
      <rect x="${x}" y="210" width="400" height="570" rx="34" fill="#111827" stroke="${accent}" stroke-width="3"/>
      ${featured ? `<rect x="${x+62}" y="192" width="276" height="42" rx="21" fill="${accent}"/><text x="${x+200}" y="221" text-anchor="middle" fill="#fff" font-size="20" font-family="sans-serif" font-weight="700">الأكثر طلبًا</text>` : ''}
      <text x="${x+35}" y="270" fill="${accent}" font-size="24" font-family="sans-serif" font-weight="700">${esc(subtitle)}</text>
      <text x="${x+35}" y="325" fill="#fff" font-size="38" font-family="sans-serif" font-weight="700">${esc(title)}</text>
      <text x="${x+35}" y="382" fill="#fff" font-size="34" font-family="sans-serif" font-weight="700">${money(p[plan].price)}</text>
      <text x="${x+145}" y="382" fill="#9ca3af" font-size="20" font-family="sans-serif">شهريًا</text>
      <line x1="${x+35}" y1="410" x2="${x+365}" y2="410" stroke="#374151"/>
      <text x="${x+35}" y="455" fill="#e5e7eb" font-size="21" font-family="sans-serif">🎁 ${daily} نيورون يوميًا</text>
      <text x="${x+35}" y="505" fill="#e5e7eb" font-size="21" font-family="sans-serif">⭐ XP ×${xp}</text>
      <text x="${x+35}" y="555" fill="#e5e7eb" font-size="21" font-family="sans-serif">🍀 حظ +${luck}% في العمل</text>
      <text x="${x+35}" y="625" fill="#9ca3af" font-size="18" font-family="sans-serif">• مكافأة دخول يومية</text>
      <text x="${x+35}" y="665" fill="#9ca3af" font-size="18" font-family="sans-serif">• لا تؤثر على رصيد XP</text>
      <text x="${x+35}" y="705" fill="#9ca3af" font-size="18" font-family="sans-serif">• المزايا فعالة طوال الاشتراك</text>
      <text x="${x+35}" y="750" fill="${accent}" font-size="18" font-family="sans-serif" font-weight="700">.اشتراك شراء ${plan}</text>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1340" height="930">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#090b13"/><stop offset="0.55" stop-color="#17112d"/><stop offset="1" stop-color="#0b1020"/></linearGradient></defs>
    <rect width="1340" height="930" rx="48" fill="url(#bg)"/>
    <circle cx="1170" cy="110" r="150" fill="#8b5cf6" opacity="0.10"/><circle cx="170" cy="850" r="190" fill="#06b6d4" opacity="0.06"/>
    <text x="670" y="82" text-anchor="middle" fill="#c4b5fd" font-size="25" font-family="sans-serif" font-weight="700">LEO PREMIUM</text>
    <text x="670" y="135" text-anchor="middle" fill="#fff" font-size="48" font-family="sans-serif" font-weight="700">اختر تجربتك المميزة</text>
    <text x="670" y="174" text-anchor="middle" fill="#9ca3af" font-size="20" font-family="sans-serif">مزايا إضافية للـ XP والحظ ومكافأة دخول يومية</text>
    ${card(45,'basic','Leo Basic','البداية الذكية',p.basic.dailyReward,p.basic.xpBoost,Math.round(p.basic.luckBoost*100),'#60a5fa')}
    ${card(470,'pro','Leo Pro','الخيار المتوازن',p.pro.dailyReward,p.pro.xpBoost,Math.round(p.pro.luckBoost*100),'#a78bfa',true)}
    ${card(895,'ultra','Leo Ultra','التجربة القصوى',p.ultra.dailyReward,p.ultra.xpBoost,Math.round(p.ultra.luckBoost*100),'#f59e0b')}
    <text x="670" y="875" text-anchor="middle" fill="#9ca3af" font-size="18" font-family="sans-serif">للطلب: .اشتراك شراء الأساسي  •  المحترف  •  الألترا   |   التفعيل بعد تأكيد الدفع</text>
  </svg>`;
}

function currentCardSvg(name, sub) {
  const d = sub.details;
  const remaining = Math.max(0, Number(sub.expiresAt) - Date.now());
  const days = Math.max(0, Math.ceil(remaining / 86400000));
  const accent = sub.plan === 'ultra' ? '#f59e0b' : sub.plan === 'pro' ? '#a78bfa' : '#60a5fa';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="680">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#090b13"/><stop offset="0.5" stop-color="#1c1237"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
    <rect width="1200" height="680" rx="48" fill="url(#g)"/>
    <circle cx="1030" cy="100" r="190" fill="${accent}" opacity="0.12"/>
    <text x="70" y="82" fill="#c4b5fd" font-size="25" font-family="sans-serif" font-weight="700">LEO PREMIUM • عضويتك</text>
    <text x="70" y="155" fill="#fff" font-size="52" font-family="sans-serif" font-weight="700">${esc(d.name)}</text>
    <text x="70" y="202" fill="#d1d5db" font-size="25" font-family="sans-serif">${esc(name)}</text>
    <rect x="70" y="245" width="1060" height="1" fill="#374151"/>
    <text x="70" y="305" fill="#9ca3af" font-size="21" font-family="sans-serif">الحالة</text><text x="220" y="305" fill="#86efac" font-size="23" font-family="sans-serif" font-weight="700">● نشط</text>
    <text x="70" y="355" fill="#9ca3af" font-size="21" font-family="sans-serif">ينتهي في</text><text x="220" y="355" fill="#fff" font-size="23" font-family="sans-serif">${esc(dateAr(sub.expiresAt))}</text>
    <text x="70" y="405" fill="#9ca3af" font-size="21" font-family="sans-serif">المتبقي</text><text x="220" y="405" fill="${accent}" font-size="23" font-family="sans-serif" font-weight="700">${days} يوم</text>
    <text x="70" y="475" fill="#e5e7eb" font-size="23" font-family="sans-serif">🎁 ${d.dailyReward} نيورون مكافأة دخول يومية</text>
    <text x="70" y="520" fill="#e5e7eb" font-size="23" font-family="sans-serif">⭐ XP ×${d.xpBoost}   •   🍀 حظ +${Math.round(d.luckBoost*100)}%</text>
    <text x="70" y="590" fill="#9ca3af" font-size="19" font-family="sans-serif">المكافأة اليومية مرة واحدة في اليوم بتوقيت السودان.</text>
    <text x="70" y="625" fill="#9ca3af" font-size="19" font-family="sans-serif">لإدارة العضوية: .اشتراك الحالي  •  .اشتراك إلغاء</text>
  </svg>`;
}

async function sendPremiumMenu(sock, chatId, userId, message) {
  const p = subs.plans();
  const image = await sharp(Buffer.from(premiumMenuSvg(p))).png().toBuffer();
  return sock.sendMessage(chatId, {
    image,
    caption: `💎 *Leo Premium*\n\nاختر الباقة التي تناسبك ثم أرسل أمر الشراء المكتوب داخل البطاقة.\n\n💳 الدفع يتم خارج البوت، وبعد تأكيد الدفع يتم تفعيل الاشتراك من الإدارة.\n\n📌 *ملاحظة:* سعر الاشتراك مالي، ولا يُخصم من رصيد النيـورون.`,
  }, { quoted: message });
}

async function sendCard(sock, chatId, userId, message, sub) {
  const name = await sock.getName(userId, false).catch(() => 'عضو Leo');
  const { buffer: avatar } = await safeProfileBuffer(sock, userId, 260);
  const base = await sharp(Buffer.from(currentCardSvg(name, sub))).png().toBuffer();
  const avatarImg = await sharp(avatar).resize(190,190,{fit:'cover'}).png().toBuffer();
  const out = await sharp(base).composite([{input:avatarImg,left:930,top:250}]).jpeg({quality:91}).toBuffer();
  return sock.sendMessage(chatId, {
    image: out,
    caption: `💎 *${sub.details.name}*\n\n👤 العضو: *${name}*\n📅 صالح حتى: *${dateAr(sub.expiresAt)}*\n⏳ المتبقي: *${Math.max(0, Math.ceil((Number(sub.expiresAt)-Date.now())/86400000))} يوم*\n🎁 المكافأة اليومية: *${sub.details.dailyReward} نيورون*\n⭐ XP Boost: *×${sub.details.xpBoost}*\n🍀 حظ العمل: *+${Math.round(sub.details.luckBoost*100)}%*\n\n📌 المكافأة اليومية تُصرف مرة واحدة يوميًا بعد نجاح أول أمر تستخدمه.`,
  }, { quoted: message });
}

function ownerJid() {
  const n = String(settings.ownerNumber || '').replace(/[^0-9]/g, '');
  return n ? `${n}@s.whatsapp.net` : null;
}

async function requestPurchase(sock, chatId, userId, message, plan) {
  const p = subs.plans()[plan];
  const name = await sock.getName(userId, false).catch(() => 'عضو Leo');
  const requestId = `SUB-${Date.now().toString(36).toUpperCase()}`;
  const owner = ownerJid();
  if (owner) {
    await sock.sendMessage(owner, { text:
      `🔔 *طلب اشتراك جديد*\n\n` +
      `🆔 الطلب: *${requestId}*\n` +
      `👤 العضو: *${name}*\n` +
      `📱 المعرّف: ${userId}\n` +
      `💎 الباقة: *${p.name}*\n` +
      `💵 السعر: *${money(p.price)} / شهر*\n\n` +
      `بعد تأكيد الدفع استخدم:\n*.اشتراك تفعيل @العضو ${plan === 'basic' ? 'الأساسي' : plan === 'pro' ? 'المحترف' : 'الألترا'} 30*`
    });
  }
  return sock.sendMessage(chatId, { text:
    `💎 *تم تسجيل طلبك بنجاح*\n\n` +
    `📦 الباقة: *${p.name}*\n` +
    `💵 السعر: *${money(p.price)} / شهر*\n` +
    `🆔 رقم الطلب: *${requestId}*\n\n` +
    `💳 *الخطوة التالية:* أكمل الدفع مع الإدارة.\n` +
    `بعد تأكيد الدفع سيتم تفعيل اشتراكك يدويًا.\n\n` +
    `🤍 لا يتم خصم أي نيورون من رصيدك مقابل الاشتراك.`
  }, { quoted: message });
}

async function subscriptionCommand(sock, chatId, userId, message, args=[]) {
  try {
    const active = subs.get(userId);
    const action = String(args[0] || '').toLowerCase();
    const planAliases = { basic:'basic', 'الأساسي':'basic', 'اساسي':'basic', 'البداية':'basic', pro:'pro', 'المحترف':'pro', 'احترافي':'pro', ultra:'ultra', 'الألترا':'ultra', 'الالترا':'ultra', 'المتقدم':'ultra' };
    if (!action) return active ? sendCard(sock,chatId,userId,message,active) : sendPremiumMenu(sock,chatId,userId,message);
    if (['حالي','الحالي','status'].includes(action)) return active ? sendCard(sock,chatId,userId,message,active) : sock.sendMessage(chatId,{text:'ℹ️ *لا يوجد لديك اشتراك فعال حاليًا.*\n\nاستخدم `.اشتراك` لعرض الباقات المتاحة.',},{quoted:message});
    if (['شراء','buy','اشترك','اشتراك'].includes(action)) {
      const plan = planAliases[String(args[1] || '').toLowerCase()] || String(args[1] || '').toLowerCase();
      if (!subs.plans()[plan]) return sock.sendMessage(chatId,{text:'❌ اختر باقة صحيحة: *الأساسي* أو *المحترف* أو *الألترا*.\n\nمثال: `.اشتراك شراء المحترف`'},{quoted:message});
      return requestPurchase(sock,chatId,userId,message,plan);
    }
    if (['تفعيل','منح','grant'].includes(action)) {
      if (!(await isOwnerOrSudo(userId,sock,chatId,message?.key?.participantAlt))) return sock.sendMessage(chatId,{text:'❌ هذا الإجراء للمالك فقط.'},{quoted:message});
      const target = input.mentions(message)[0] || input.replySender(message) || userId;
      const plan = planAliases[String(args[1] || '').toLowerCase()] || String(args[1] || '').toLowerCase();
      const days = Number(args[2] || 30);
      if (!subs.plans()[plan]) return sock.sendMessage(chatId,{text:'❌ الباقة غير صحيحة.'},{quoted:message});
      const result = await subs.set(target,plan,days,{grantedBy:userId});
      return sock.sendMessage(chatId,{text:`✅ تم تفعيل *${result.details.name}* للعضو بنجاح لمدة *${days} يومًا*.\n\n💎 سيتمتع العضو بمزايا الباقة والمكافأة اليومية.`},{quoted:message,mentions:[target]});
    }
    if (['إلغاء','الغاء','cancel'].includes(action)) {
      if (!active) return sock.sendMessage(chatId,{text:'ℹ️ لا يوجد لديك اشتراك فعال لإلغائه.'},{quoted:message});
      await subs.cancel(userId);
      return sock.sendMessage(chatId,{text:'✅ تم إلغاء الاشتراك الحالي.\n\nلن تُصرف مكافآت الدخول اليومية بعد الإلغاء.'},{quoted:message});
    }
    return sock.sendMessage(chatId,{text:'💎 استخدم `.اشتراك` لعرض الباقات.\n📦 `.اشتراك شراء المحترف` لطلب باقة.\n📋 `.اشتراك الحالي` لعرض عضويتك.'},{quoted:message});
  } catch (e) { console.error('[SUBSCRIPTION]',e?.message||e); return sock.sendMessage(chatId,{text:'❌ تعذر معالجة الاشتراك حاليًا.'},{quoted:message}); }
}
module.exports = subscriptionCommand;
