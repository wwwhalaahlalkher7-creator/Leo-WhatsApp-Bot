'use strict';

const settings = require('../settings');
const commandRegistry = require('./registry-init');
const { t } = require('../lib/i18n');
const { SessionManager } = require('../systems/session');
const interaction = require('../systems/interaction');
const currency = require('../systems/economy/currency');
const { createLeoFrame } = require('../systems/ui/frame');

const helpSessions = new SessionManager({ defaultTtl: 15 * 60 * 1000 });
const VERSION = settings.version;
const DEVELOPER = settings.developerName || 'Leonardo';

function buildHelpCatalog() {
  const categories = [];
  const details = Object.create(null);
  const entries = commandRegistry.helpEntries().filter(entry => entry && entry.helpVisible !== false);

  for (const entry of entries) {
    const command = entry.command;
    if (!command) continue;
    const categoryKey = entry.categoryKey || entry.category || 'general';
    const category = commandRegistry.categoryTitle(categoryKey);
    let bucket = categories.find(item => item.key === categoryKey);
    if (!bucket) {
      bucket = { key: categoryKey, name: category, commands: [] };
      categories.push(bucket);
    }
    if (!bucket.commands.includes(command)) bucket.commands.push(command);

    details[command] = {
      registryName: entry.registryName,
      usage: entry.usage || `.${command}`,
      category,
      version: entry.version || VERSION,
      developer: entry.developer || DEVELOPER,
      cost: entry.cost ?? entry.economyPrice ?? 0,
      description: t(entry.descriptionKey || '', entry.description || t('common.noDescription', 'بدون وصف')),
      note: t(entry.noteKey || '', entry.note || 'استخدم الأمر بالطريقة الموضحة أعلاه.'),
      method: t(entry.methodKey || '', entry.method || t('common.usage', '📌 الاستخدام: استخدم الأمر كما هو موضح.')),
      permission: entry.permission || 'public',
      cooldown: entry.cooldown || null,
      aliases: entry.aliases || [],
      localizedAliases: entry.localizedAliases || []
    };
  }
  return { categories: categories.filter(c => c.commands.length), details };
}

function getHelpCatalog() { return buildHelpCatalog(); }

function formatCost(cost) {
  if (cost === 0) return 'مجاني';
  if (typeof cost === 'number') return `${cost} ${currency.name}`;
  return String(cost);
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return 'بدون تهدئة';
  const total = Math.ceil(ms / 1000);
  if (total < 60) return `${total} ثانية`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return seconds ? `${minutes} دقيقة و${seconds} ثانية` : `${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours} ساعة و${mins} دقيقة` : `${hours} ساعة`;
}

function formatPermission(permission) {
  return ({ public: 'الجميع', group: 'داخل المجموعات', admin: 'مشرفو المجموعة', botAdmin: 'المشرفون + ليو مشرف', owner: 'مالك البوت' })[permission] || 'حسب إعدادات الأمر';
}

function findCommand(catalog, query) {
  const raw = String(query || '').trim();
  if (!raw) return null;
  const resolved = commandRegistry.resolveText(raw.startsWith('.') ? raw : `.${raw}`);
  if (resolved.command) {
    const localized = resolved.command.localizedName || resolved.command.name;
    return catalog.details[localized] ? localized : (catalog.details[resolved.command.name] ? resolved.command.name : null);
  }
  const normalized = raw.replace(/^\./, '').toLowerCase();
  return Object.keys(catalog.details).find(name => String(name).toLowerCase() === normalized) ||
    Object.keys(catalog.details).find(name => catalog.details[name].aliases.some(a => String(a).toLowerCase() === normalized || String(a).replace(/^\./, '').toLowerCase() === normalized));
}

function commandCard(details) {
  const content = [
    `🧩 الأمر: ${details.usage}`,
    `🗂️ الفئة: ${details.category}`,
    `🪙 التكلفة: ${formatCost(details.cost)}`,
    `⏳ الانتظار: ${formatDuration(details.cooldown?.ms)}`,
    `👤 الصلاحية: ${formatPermission(details.permission)}`,
    `🔖 الإصدار: ${details.version}`,
    `👨‍💻 المطوّر: ${details.developer}`,
    '',
    '📝 الوصف:',
    details.description,
    '',
    '📌 الاستخدام:',
    details.method,
    '',
    '💡 ملاحظة:',
    details.note
  ].join('\n');
  return createLeoFrame(`📖 معلومات ${details.usage.replace(/^\./, '')}`, content);
}

async function sendCategories(sock, chatId, message, catalog) {
  const content = [
    '┃ اختر رقم الفئة بالرد على هذه الرسالة.',
    '',
    ...catalog.categories.map((category, index) => `〔 ${index + 1} 〕 ${category.name}`),
    '',
    '💡 أو استخدم: .مساعدة <اسم الأمر>'
  ].join('\n').replace(/^┃/gm, '');
  const sent = await sock.sendMessage(chatId, { text: createLeoFrame('🆘 مساعدة LeoBot', content) }, { quoted: message });
  const id = sent?.key?.id || message?.key?.id;
  const ownerId = message?.key?.participant || message?.key?.remoteJid || 'unknown';
  if (id) helpSessions.create({ type: 'help', chatId, ownerId, activeMessageId: id, data: { stage: 'category', categoryIndex: null } });
}

async function helpCommand(sock, chatId, message, args = []) {
  const catalog = getHelpCatalog();
  const query = Array.isArray(args) ? args.join(' ').trim() : String(args || '').trim();
  if (query) {
    const command = findCommand(catalog, query);
    if (!command) {
      await sock.sendMessage(chatId, { text: createLeoFrame('❌ مساعدة', `لم أجد الأمر: ${query}\n\n💡 استخدم .مساعدة لعرض جميع الفئات.`) }, { quoted: message });
      return;
    }
    await sock.sendMessage(chatId, { text: commandCard(catalog.details[command]) }, { quoted: message });
    return;
  }
  await sendCategories(sock, chatId, message, catalog);
}

async function handleHelpReply(sock, chatId, message) {
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
    const content = [
      'اختر رقم الأمر بالرد على هذه الرسالة.',
      '',
      ...category.commands.map((command, index) => `〔 ${index + 1} 〕 ${catalog.details[command].usage}`),
      '',
      '↩️ رد برقم الأمر لعرض التفاصيل.'
    ].join('\n');
    const sent = await sock.sendMessage(chatId, { text: createLeoFrame(category.name, content) }, { quoted: message });
    helpSessions.touch(session, { data: { ...session.data, stage: 'command', categoryIndex: n - 1 }, activeMessageId: sent?.key?.id || message.key.id });
    return true;
  }

  if (session.data.stage === 'command') {
    const category = catalog.categories[session.data.categoryIndex];
    const command = category?.commands?.[n - 1];
    if (!command) {
      await sock.sendMessage(chatId, { text: '❌ رقم الأمر غير صحيح. اختر رقمًا من القائمة.' }, { quoted: message });
      return true;
    }
    await sock.sendMessage(chatId, { text: commandCard(catalog.details[command]) }, { quoted: message });
    helpSessions.close(session, 'completed');
    return true;
  }
  return false;
}

module.exports = helpCommand;
module.exports.handleHelpReply = handleHelpReply;
Object.defineProperty(module.exports, 'CATEGORIES', { enumerable: true, get: () => getHelpCatalog().categories });
Object.defineProperty(module.exports, 'DETAILS', { enumerable: true, get: () => getHelpCatalog().details });
