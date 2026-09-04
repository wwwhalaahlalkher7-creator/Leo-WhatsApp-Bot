'use strict';
const input = require('../systems/input');
const currency = require('../systems/economy/currency');
const credits = require('../lib/economy/credits');
const subs = require('../systems/subscriptions');
const xp = require('../systems/xp');
const isOwnerOrSudo = require('../lib/isOwner');
const { createLeoFrame } = require('../systems/ui/frame');

function target(message) { return input.mentions(message)[0] || input.replySender(message); }
function amount(v) { const n=input.number(input.normalizeArabicDigits(String(v||'')),{min:0,max:Number.MAX_SAFE_INTEGER,integer:true}); return n.ok?n.value:NaN; }
async function manager(sock, chatId, userId, message, args=[]) {
  if (!(message?.key?.fromMe || await isOwnerOrSudo(userId,sock,chatId,message?.key?.participantAlt))) return sock.sendMessage(chatId,{text:'❌ هذا الأمر للمالك فقط.'},{quoted:message});
  const action=String(args[0]||'').toLowerCase();
  try {
    if (!action || ['تحليل','analytics','إحصائيات','احصائيات'].includes(action)) {
      const data = credits.__readRaw ? credits.__readRaw() : null;
      const users = data?.users || {};
      let total=0,count=0, dayCredit=0, dayDebit=0, ops24=0;
      const since=Date.now()-86400000;
      for(const u of Object.values(users)) {
        total+=Math.max(0,Number(u.balance)||0); count++;
        for(const tx of (u.transactions||[])) { if(Number(tx.at||0)>=since){ ops24++; if(tx.type==='credit') dayCredit+=Number(tx.amount||0); else dayDebit+=Number(tx.amount||0); } }
      }
      const activeSubs=Object.values(subs.allUsers()).filter(s=>Number(s.expiresAt)>Date.now()).length;
      return sock.sendMessage(chatId,{text:createLeoFrame('مدير البنك',`💰 إجمالي النيـورونات: *${currency.balance(total)}*\n👥 الحسابات: *${count}*\n💎 الاشتراكات الفعالة: *${activeSubs}*\n⭐ ملفات XP: *${Object.keys(require('../lib/storage').read('xp',{users:{}}).users||{}).length}*\n\n📊 *آخر 24 ساعة*\n🟢 الداخل: *${currency.amount(dayCredit)}*\n🔴 الخارج: *${currency.amount(dayDebit)}*\n🔄 العمليات: *${ops24}*\n📈 صافي الحركة: *${currency.amount(dayCredit-dayDebit)}*\n\n📌 إدارة الرصيد: *.مراقبة بنك إضافة* أو *.مراقبة بنك خصم*\n📌 الاشتراكات: *.مراقبة بنك اشتراك*\n📌 الأسعار: *.مراقبة بنك سعر*`)},{quoted:message});
    }
    if (['إضافة','اضافة','add'].includes(action) || ['خصم','deduct','remove'].includes(action)) {
      const who=target(message); const value=amount(args[1]); if(!who||!Number.isSafeInteger(value)||value<=0)return sock.sendMessage(chatId,{text:'❌ استخدم الأمر بالرد على العضو مع المبلغ.'},{quoted:message});
      const before=await credits.getBalance(who); const after=action==='خصم'||action==='deduct'||action==='remove' ? Math.max(0,before-value) : before+value;
      if(after===before && action!=='إضافة' && action!=='اضافة' && action!=='add') return sock.sendMessage(chatId,{text:'❌ لا يوجد رصيد كافٍ للخصم.'},{quoted:message});
      if(after>before) await credits.add(who,after-before,'bank:admin:add'); else if(after<before) await credits.spend(who,before-after,'bank:admin:deduct');
      return sock.sendMessage(chatId,{text:`🏦 تمت العملية بنجاح.\n\n👤 العضو: @${who.split('@')[0]}\n${after>before?'➕':'➖'} المبلغ: *${currency.amount(Math.abs(after-before))}*\n💰 الرصيد الجديد: *${currency.balance(after)}*`},{quoted:message,mentions:[who]});
    }
    if (['اشتراك','subscription'].includes(action)) return sock.sendMessage(chatId,{text:'💎 إدارة الاشتراكات تتم عبر `.اشتراك تفعيل @العضو ultra 30`، والأسعار قابلة للتعديل لاحقًا من مدير البنك.'},{quoted:message});
    if (['سعر','price','prices'].includes(action)) {
      const plan=String(args[1]||'').toLowerCase(); const value=Number(args[2]);
      if (plan && Number.isFinite(value) && value >= 0) { const updated=await subs.updatePlan(plan,{price:Number(value.toFixed(2))}); return sock.sendMessage(chatId,{text:`✅ تم تحديث سعر *${updated.name}* إلى *$${updated.price.toFixed(2)}* شهريًا.`},{quoted:message}); }
      return sock.sendMessage(chatId,{text:`💎 أسعار الاشتراكات الحالية:
🥉 Basic: $${subs.plans().basic.price}
🥈 Pro: $${subs.plans().pro.price}
🥇 Ultra: $${subs.plans().ultra.price}

لتعديل السعر: *.مراقبة بنك سعر ultra 12.50*`},{quoted:message});
    }
    return sock.sendMessage(chatId,{text:'🏦 استخدم `.مراقبة بنك` للتحليل، أو `.مراقبة بنك إضافة/خصم` لإدارة الأرصدة.'},{quoted:message});
  } catch(e){console.error('[BANK-MANAGER]',e?.message||e);return sock.sendMessage(chatId,{text:'❌ تعذر تنفيذ إدارة البنك حاليًا.'},{quoted:message});}
}
module.exports=manager;
