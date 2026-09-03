async function shipCommand(sock, chatId, msg) {
  try {
    const metadata=await sock.groupMetadata(chatId); const ps=(metadata.participants||[]).map(v=>v.id).filter(Boolean);
    if(ps.length<2) return sock.sendMessage(chatId,{text:'❌ المجموعة تحتاج عضوين على الأقل.'},{quoted:msg});
    const first=ps[Math.floor(Math.random()*ps.length)]; let second=ps[Math.floor(Math.random()*ps.length)]; while(second===first) second=ps[Math.floor(Math.random()*ps.length)];
    const percent=Math.floor(Math.random()*101);
    await sock.sendMessage(chatId,{text:`💖 *نسبة التوافق*\n\n@${first.split('@')[0]} ❤️ @${second.split('@')[0]}\n💞 النسبة: *${percent}%*\n\nبالتوفيق لكما 😄`,mentions:[first,second]},{quoted:msg});
  } catch(e){console.error(e);await sock.sendMessage(chatId,{text:'❌ تعذر حساب التوافق. تأكد أن الأمر داخل مجموعة.'},{quoted:msg});}
}
module.exports=shipCommand;
