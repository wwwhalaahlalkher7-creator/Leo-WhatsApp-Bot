const dataStore = require('../lib/storage');
const isOwnerOrSudo = require('../lib/isOwner');
const PATH = 'pmblocker.json';
const DEFAULT = '⚠️ الرسائل الخاصة مغلقة حاليًا. تواصل مع مالك البوت داخل مجموعة مسموح بها.';
function readState() { const d=dataStore.read(PATH,{enabled:false,message:DEFAULT}); return {enabled:!!d.enabled,message:d.message||DEFAULT}; }
function writeState(enabled,message) { const cur=readState(); dataStore.writeSync(PATH,{enabled:!!enabled,message:message||cur.message}); }
async function pmblockerCommand(sock, chatId, message, args) {
  const senderId=message.key.participant||message.key.remoteJid; const alt=message.key.participantAlt||message.key.remoteJidAlt||null;
  if (!message.key.fromMe && !(await isOwnerOrSudo(senderId,sock,chatId,alt))) return sock.sendMessage(chatId,{text:'❌ هذا الأمر للمالك فقط.'},{quoted:message});
  const [sub,...rest]=String(args||'').trim().split(/\s+/); const state=readState(); let action=String(sub||'').toLowerCase(); action=({'تشغيل':'on','شغل':'on','تفعيل':'on','إيقاف':'off','ايقاف':'off','وقف':'off','تعطيل':'off','حالة':'status','رسالة':'setmsg','تعيين_الرسالة':'setmsg'})[action] || action;
  if (!['on','off','status','setmsg'].includes(action)) return sock.sendMessage(chatId,{text:'📵 *حظر الاتصالات الخاصة*\n\n`.حظر الاتصالات تشغيل`\n`.حظر الاتصالات إيقاف`\n`.حظر الاتصالات حالة`\n`.حظر الاتصالات رسالة <النص>`'},{quoted:message});
  if(action==='status') return sock.sendMessage(chatId,{text:`📵 حظر الخاص: *${state.enabled?'تشغيل ✅':'إيقاف ⛔'}*\n📝 الرسالة: ${state.message}`},{quoted:message});
  if(action==='setmsg'){const msg=rest.join(' ').trim(); if(!msg)return sock.sendMessage(chatId,{text:'📌 اكتب الرسالة بعد الأمر.'},{quoted:message}); writeState(state.enabled,msg); return sock.sendMessage(chatId,{text:'✅ تم تحديث رسالة حظر الخاص.'},{quoted:message});}
  const enabled=action==='on'; writeState(enabled); return sock.sendMessage(chatId,{text:enabled?'✅ تم تشغيل حظر الرسائل الخاصة.':'✅ تم إيقاف حظر الرسائل الخاصة.'},{quoted:message});
}
module.exports={pmblockerCommand,readState};
