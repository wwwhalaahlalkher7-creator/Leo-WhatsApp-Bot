const settings = require('../settings');
const commandRegistry = require('./registry-init');
const { t } = require('../lib/i18n');
const { SessionManager } = require('../systems/session');
const interaction = require('../systems/interaction');
const currency = require('../systems/economy/currency');

const helpSessions = new SessionManager({ defaultTtl: 15 * 60 * 1000 });
const VERSION = settings.version;
const DEVELOPER = settings.developerName || 'Leonardo';

// Help is generated exclusively from the Command Registry.
// There is intentionally no second command list here: routing, aliases,
// localization, permissions and Help metadata all come from one definition.
function buildHelpCatalog() {
  const categories = [];
  const details = Object.create(null);
  const entries = commandRegistry.helpEntries().filter(entry => entry && entry.helpVisible !== false);

  for (const entry of entries) {
    const command = entry.command;
    if (!command) continue;

    const category = commandRegistry.categoryTitle(entry.categoryKey || entry.category);
    if (!categories.some(item => item.key === (entry.categoryKey || entry.category))) {
      categories.push({
        key: entry.categoryKey || entry.category,
        name: category,
        commands: []
      });
    }

    const bucket = categories.find(item => item.key === (entry.categoryKey || entry.category));
    if (!bucket.commands.includes(command)) bucket.commands.push(command);

    details[command] = {
      usage: entry.usage || `.${command}`,
      category,
      version: entry.version || VERSION,
      developer: entry.developer || DEVELOPER,
      cost: entry.cost ?? 0,
      description: t(entry.descriptionKey || '', entry.description || t('common.noDescription', 'بدون وصف')),
      method: t(entry.methodKey || '', entry.method || t('common.usage', '📌 الاستخدام: استخدم الأمر كما هو موضح.')),
      permission: entry.permission || 'public',
      aliases: entry.aliases || [],
      localizedAliases: entry.localizedAliases || []
    };
  }

  // Stable order: keep registration order and remove accidental empty groups.
  return {
    categories: categories.filter(category => category.commands.length),
    details
  };
}

// The catalog is rebuilt when Help is opened. This keeps Help synchronized
// with the Registry and with the active localization without a second command list.
function getHelpCatalog() {
  const catalog = buildHelpCatalog();
  for (const category of catalog.categories) {
    for (const command of category.commands) {
      if (!catalog.details[command]) {
        throw new Error(`Help metadata missing for registered command: ${command}`);
      }
    }
  }
  return catalog;
}

function formatCost(cost) {
  if (cost === 0) return 'مجاني';
  if (typeof cost === 'number') return `${cost} ${currency.name}`;
  return String(cost);
}

function normalizeNumber(value) {
  return String(value).trim().replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

async function helpCommand(sock, chatId, message) {
  const catalog = getHelpCatalog();
  const text = `╭━━━〔 🆘 مساعدة LeoBot 〕━━━╮
┃ اختر *رقم الفئة* بالرد على هذه الرسالة.
┃ ثم اختر *رقم الأمر* بالرد على القائمة.
┃ كل أمر في القائمة له صفحة تفاصيل موحدة.
╰━━━━━━━━━━━━━━━━━━━━━━╯

${catalog.categories.map((category, index) => `〔 ${index + 1} 〕 ${category.name}`).join('\n')}

↩️ مثال: رد بـ *1* على هذه الرسالة.`;
  const sent = await sock.sendMessage(chatId, { text }, { quoted: message });
  const id = sent?.key?.id || message?.key?.id;
  const ownerId = message?.key?.participant || message?.key?.remoteJid || 'unknown';
  if (id) helpSessions.create({ type: 'help', chatId, ownerId, activeMessageId: id, data: { stage: 'category', categoryIndex: null } });
}

async function handleHelpReply(sock, chatId, message, value) {
  const ownerId = message?.key?.participant || message?.key?.remoteJid || 'unknown';
  const session = helpSessions.get('help', chatId, ownerId);
  if (!session) return false;

  const catalog = getHelpCatalog();

  const parsed = interaction.replyNumber(message, session.activeMessageId, { min: 1, max: 999 });
  if (!parsed.ok) return false;
  const n = parsed.value;

  if (session.data.stage === 'category') {
    const category = catalog.categories[n - 1];
    if (!category) {
      await sock.sendMessage(chatId, { text: '❌ رقم الفئة غير صحيح. اختر رقمًا من القائمة.' }, { quoted: message });
      return true;
    }

    const text = `╭━━━〔 ${category.name} 〕━━━╮
┃ اختر *رقم الأمر* بالرد على هذه الرسالة.
╰━━━━━━━━━━━━━━━━━━━━╯

${category.commands.map((command, index) => `〔 ${index + 1} 〕 ${catalog.details[command].usage}`).join('\n')}

↩️ رد برقم الأمر لعرض التفاصيل.`;
    const sent = await sock.sendMessage(chatId, { text }, { quoted: message });
    helpSessions.touch(session, { state: 'active', data: { ...session.data, stage: 'command', categoryIndex: n - 1 }, activeMessageId: sent?.key?.id || message.key.id });
    return true;
  }

  if (session.data.stage === 'command') {
    const category = catalog.categories[session.data.categoryIndex];
    const command = category?.commands?.[n - 1];
    if (!command) {
      await sock.sendMessage(chatId, { text: '❌ رقم الأمر غير صحيح. اختر رقمًا من القائمة.' }, { quoted: message });
      return true;
    }

    const details = catalog.details[command];
    const text = `╮━━━〔 📖 تفاصيل الأمر 〕━━━╭
┃ 🧩 *الأمر:* ${details.usage}
┃ 🗂️ *الفئة:* ${details.category}
┃ 🔖 *الإصدار:* ${details.version}
┃ 👨‍💻 *المطوّر:* ${details.developer}
┃ 🪙 *الرصيد:* ${formatCost(details.cost)}
┃ 📝 *الوصف:* ${details.description}
┃ ⚙️ *طريقة العمل:* ${details.method}
╯━━━━━━━━━━━━━━━━━━━━━━╰

💡 للعودة: أرسل .مساعدة من جديد.`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
    helpSessions.close(session, 'completed');
    return true;
  }

  return false;
}

module.exports = helpCommand;
module.exports.handleHelpReply = handleHelpReply;
Object.defineProperty(module.exports, 'CATEGORIES', { enumerable: true, get: () => getHelpCatalog().categories });
Object.defineProperty(module.exports, 'DETAILS', { enumerable: true, get: () => getHelpCatalog().details });
