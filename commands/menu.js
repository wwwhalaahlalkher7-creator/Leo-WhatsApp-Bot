'use strict';

const settings = require('../settings');
const registry = require('../lib/command-registry');
const { createLeoFrame } = require('../systems/ui/frame');

async function menuCommand(sock, chatId, message) {
  const groups = new Map();
  for (const e of registry.helpEntries()) {
    if (e.helpVisible === false) continue;
    const key = e.categoryKey || e.category || 'general';
    if (!groups.has(key)) groups.set(key, { title: registry.categoryTitle(key), commands: [] });
    const command = e.command || e.registryName;
    if (command && !groups.get(key).commands.includes(command)) groups.get(key).commands.push(command);
  }

  const blocks = [...groups.values()]
    .filter(group => group.commands.length)
    .map(group => createLeoFrame(group.title, group.commands.map(c => `• ${registry.helpEntries().find(e => (e.command || e.registryName) === c)?.usage || `.${c}`}`).join('\n')))
    .join('\n\n');

  const header = createLeoFrame(`🤖 ${settings.botName}`, `📋 قائمة الأوامر\n🔖 الإصدار: ${settings.version}`);
  const footer = '💡 للتفاصيل: .مساعدة <اسم الأمر>';
  return sock.sendMessage(chatId, { text: `${header}\n\n${blocks}\n\n${footer}` }, { quoted: message });
}

module.exports = menuCommand;
