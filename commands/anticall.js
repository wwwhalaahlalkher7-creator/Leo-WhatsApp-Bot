const dataStore = require('../lib/storage');
const PATH = 'anticall.json';
function readState() { return dataStore.read(PATH, { enabled: false }); }
function writeState(enabled) { dataStore.writeSync(PATH, { enabled: !!enabled }); }
async function anticallCommand(sock, chatId, message, args) {
  let sub = String(args || '').trim().toLowerCase(); sub = ({'تشغيل':'on','شغل':'on','تفعيل':'on','إيقاف':'off','ايقاف':'off','وقف':'off','تعطيل':'off','حالة':'status','وضع':'status'})[sub] || sub; const state = readState();
  if (!sub || !['on','off','status'].includes(sub)) return sock.sendMessage(chatId, { text: '📵 *منع المكالمات*\n\n`.المكالمة التلقائية تشغيل`\n`.المكالمة التلقائية إيقاف`\n`.المكالمة التلقائية حالة`' }, { quoted: message });
  if (sub === 'status') return sock.sendMessage(chatId, { text: `📵 منع المكالمات: *${state.enabled ? 'تشغيل ✅' : 'إيقاف ⛔'}*` }, { quoted: message });
  const enabled = sub === 'on'; writeState(enabled);
  return sock.sendMessage(chatId, { text: enabled ? '✅ تم تشغيل منع المكالمات.' : '✅ تم إيقاف منع المكالمات.' }, { quoted: message });
}
module.exports = { anticallCommand, readState };
