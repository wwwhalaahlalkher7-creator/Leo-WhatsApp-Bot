const input = require('../systems/input');
const response = require('../systems/response');
const settings = require('../settings');
const registry = require('../lib/command-registry');
async function menuCommand(sock, chatId, message) {
  const groups = new Map();
  for (const e of registry.helpEntries()) {
    const key=e.categoryKey||e.category||'general';
    if(!groups.has(key)) groups.set(key,{title:registry.categoryTitle(key),commands:[]});
    const c=e.command||e.registryName;
    if(c&&!groups.get(key).commands.includes(c)) groups.get(key).commands.push(c);
  }
  const blocks=[...groups.values()].map(g=>`╭─〔 ${g.title} 〕\n${g.commands.map(c=>`│ • .${c}`).join('\n')}\n╰────────────`).join('\n\n');
  const text=`╭━━━〔 🤖 ${settings.botName} 〕━━━╮\n┃ 📋 *قائمة الأوامر*\n┃ 🔖 الإصدار: ${settings.version}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n${blocks}\n\n💡 للتفاصيل: \.مساعدة`;
  return response.text(sock, chatId, text, message);
}
module.exports=menuCommand;
