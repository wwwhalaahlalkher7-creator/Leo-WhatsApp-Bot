/**
 * LeoBot Command Registry
 * Single source of truth for newly registered commands:
 * routing + aliases + localization + Help metadata.
 *
 * Existing legacy commands can be migrated here gradually without changing
 * their handlers. New commands should be registered here only.
 */
const { t } = require('./i18n');
const packageInfo = require('../package.json');
const isAdmin = require('./isAdmin');
const { normalizeContract } = require('../systems/command/contract');
const permissionSystem = require('../systems/permission');
const inputSystem = require('../systems/input');
const responseSystem = require('../systems/response');
const { handleCommandError } = require('./errors/handler');
const { createEconomy } = require('../systems/economy');
const { CooldownManager } = require('../systems/cooldown');
const groupSystem = require('../systems/group');
const sessionSystem = require('../systems/session');
const providerSystem = require('../systems/provider');
const moderationSystem = require('../systems/moderation');
const { isRetired } = require('./retired-commands');
const commandObservability = require('../systems/observability');
const cooldownMessages = require('../systems/cooldown/messages');

const cooldownManager = new CooldownManager();
const economy = createEconomy();

const commands = new Map();
const aliases = new Map();

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/^\./, '');
}

function register(definition) {
  if (!definition?.name || typeof definition.execute !== 'function') {
    throw new Error('Invalid command registry definition');
  }
  const name = normalize(definition.name);
  if (isRetired(name)) throw new Error(`Retired command cannot be registered: ${name}`);
  const def = {
    ...definition,
    name,
    aliases: [...new Set((definition.aliases || []).map(normalize).filter(Boolean))].filter(alias => !isRetired(alias)),
    category: definition.category || 'general',
    version: definition.version || packageInfo.version,
    developer: definition.developer || 'Leonardo',
    description: definition.description || '',
    method: definition.method || '',
    note: definition.note || '',
    // Metadata keys are canonical; Help/Localization resolve these keys with
    // the registry text as a safe fallback for legacy commands.
    categoryKey: definition.categoryKey || definition.category || 'general',
    localizedName: definition.localizedName || definition.name,
    localizedAliases: definition.localizedAliases || [],
    ownerOnly: Boolean(definition.ownerOnly),
    hidden: Boolean(definition.hidden),
    helpVisible: definition.helpVisible !== false,
    permission: definition.permission || (definition.ownerOnly ? 'owner' : definition.botAdminOnly ? 'botAdmin' : definition.adminOnly ? 'admin' : definition.groupOnly ? 'group' : 'public'),
    groupOnly: Boolean(definition.groupOnly),
    adminOnly: Boolean(definition.adminOnly),
    botAdminOnly: Boolean(definition.botAdminOnly),
    contract: normalizeContract(definition),
  };
  if (commands.has(name)) throw new Error(`Duplicate registered command: ${name}`);
  commands.set(name, def);
  for (const alias of [name, ...def.aliases]) {
    const previous = aliases.get(alias);
    if (previous && previous !== name) throw new Error(`Duplicate command alias: ${alias}`);
    aliases.set(alias, name);
  }
  for (const alias of def.localizedAliases) {
    if (isRetired(alias)) continue;
    const normalized = normalize(alias);
    if (!normalized) continue;
    const previous = aliases.get(normalized);
    if (previous && previous !== name) throw new Error(`Duplicate localized alias: ${alias}`);
    aliases.set(normalized, name);
  }
  return def;
}

function addAliases(commandName, newAliases = [], options = {}) {
  const name = normalize(commandName);
  const def = commands.get(name);
  if (!def) return null;
  const list = Array.isArray(newAliases) ? newAliases : [newAliases];
  const normalizedList = list.map(normalize).filter(Boolean).filter(alias => !isRetired(alias));
  for (const alias of normalizedList) {
    const previous = aliases.get(alias);
    if (previous && previous !== name) throw new Error(`Duplicate command alias: ${alias}`);
    aliases.set(alias, name);
    if (options.localized) {
      if (!def.localizedAliases.includes(alias)) def.localizedAliases.push(alias);
    } else if (!def.aliases.includes(alias)) {
      def.aliases.push(alias);
    }
  }
  return def;
}

function resolve(token) {
  return aliases.get(normalize(token)) ? commands.get(aliases.get(normalize(token))) : null;
}

// Resolve the longest registered command prefix from a complete command body.
// This is required for commands whose public name contains spaces (e.g. Arabic
// "اكس او") and prevents the parser from treating the second word as an arg.
function resolveText(text) {
  const body = String(text || '').trim().replace(/^\./, '');
  if (!body) return { command: null, args: [], raw: body };
  const tokens = body.split(/\s+/);
  let matched = null;
  let matchedCount = 0;
  for (let i = 1; i <= tokens.length; i++) {
    const candidate = tokens.slice(0, i).join(' ');
    const command = resolve(candidate);
    if (command) { matched = command; matchedCount = i; }
  }
  return { command: matched, args: matched ? tokens.slice(matchedCount) : tokens.slice(1), raw: body };
}


async function dispatch(sock, chatId, message, token, args, context = {}) {
  const command = resolve(token);
  if (!command) return false;

  const { senderId, senderIdAlt, isGroup = false, isOwner = false } = context;
  let isSenderAdmin = Boolean(context.isSenderAdmin);
  let isBotAdmin = Boolean(context.isBotAdmin);

  if ((command.adminOnly || command.botAdminOnly || command.contract.permission === 'admin' || command.contract.permission === 'botAdmin') && isGroup) {
    const status = await isAdmin(sock, chatId, senderId, senderIdAlt);
    isSenderAdmin = status.isSenderAdmin;
    isBotAdmin = status.isBotAdmin;
  }

  if (command.contract.interactionExplicit) {
    const interaction = require('../systems/interaction');
    const validation = interaction.validate(message, command.contract.interaction);
    if (!validation.ok) {
      const interactionText = {
        reply_required: '❌ يجب استخدام هذا الأمر بالرد على الرسالة المطلوبة.',
        media_required: '❌ يجب إرفاق صورة/فيديو/ملف مناسب مع الأمر أو الرد على الوسائط.',
        mention_required: '❌ يجب منشن العضو المطلوب.',
        mention_or_reply_required: '❌ يجب منشن العضو أو الرد على رسالته.',
        unknown_interaction: '❌ تعذر التحقق من مدخلات هذا الأمر.'
      };
      await responseSystem.text(sock, chatId, interactionText[validation.reason] || '❌ مدخلات الأمر غير صحيحة.', message);
      await commandObservability.record(command.name, 'failure', { durationMs: 0, reason: `interaction:${validation.reason}` });
      return true;
    }
  }

  const permission = permissionSystem.check(command.contract, {
    isGroup,
    isOwner,
    isSenderAdmin,
    isBotAdmin,
    requireSenderAdmin: Boolean(command.contract.requireSenderAdmin),
  });
  if (!permission.ok) {
    const textByReason = {
      group_only: t('common.onlyGroup', '❌ هذا الأمر متاح داخل المجموعات فقط.'),
      owner_only: t('common.ownerOnlyShort', '❌ هذا الأمر للمالك فقط.'),
      admin_only: t('common.notAdmin', '❌ هذا الأمر للمشرفين فقط.'),
      bot_admin_only: t('common.botMustBeAdmin', '❌ لازم يكون ليو مشرفًا لتنفيذ هذا الأمر.'),
    };
    await responseSystem.text(sock, chatId, textByReason[permission.reason] || '❌ لا تملك صلاحية استخدام هذا الأمر.', message);
    await commandObservability.record(command.name, 'failure', { durationMs: 0, reason: `permission:${permission.reason}` });
    return true;
  }

  const cooldown = command.contract.cooldown;
  let cooldownReservation = null;
  let cooldownScope = null;
  let cooldownKey = null;
  if (cooldown && cooldown.ms > 0) {
    cooldownScope = cooldown.scope || 'command';
    cooldownKey = cooldown.key === 'group' ? chatId : senderId;
    const result = cooldownManager.consume(cooldownScope, `${command.name}:${cooldownKey}`, cooldown.ms);
    if (!result.ok) {
      await responseSystem.text(sock, chatId, cooldownMessages.waitMessage(result.remaining), message);
      await commandObservability.record(command.name, 'failure', { durationMs: 0, reason: 'cooldown:active' });
      return true;
    }
    cooldownReservation = result.token;
  }

  const trackedResponse = responseSystem.createResponseTracker(sock);
  const startedAt = Date.now();
  context.commandSucceeded = false;
  context.commandName = command.name;
  const dispatchContext = {
    ...context,
    isSenderAdmin,
    isBotAdmin,
    commandSucceeded: false,
    commandName: command.name,
    systems: {
      input: inputSystem,
      response: responseSystem,
      economy,
      permission: permissionSystem,
      command: command.contract,
      permissionResult: { ...permission, isOwner, isSenderAdmin, isBotAdmin },
      cooldown: cooldownManager,
      group: groupSystem,
      session: sessionSystem,
      provider: providerSystem,
      moderation: moderationSystem,
    },
  };
  try {
    await command.execute(trackedResponse.sock, chatId, message, args, dispatchContext);
    dispatchContext.commandSucceeded = true;
    context.commandSucceeded = true;
    await commandObservability.record(command.name, 'success', { durationMs: Date.now() - startedAt });
  } catch (error) {
    const responseSent = trackedResponse.state.sent > 0;
    error.__leoResponseSent = responseSent;
    // A cooldown is a reservation, not a payment for attempting a command.
    // Any thrown execution error means the command did not complete normally,
    // including provider/API failures that happened after a progress message
    // was sent. Release the reservation so transient failures do not punish
    // the user. rollback() is token-guarded to avoid deleting a newer
    // reservation created by a concurrent invocation.
    if (cooldownReservation) {
      cooldownManager.rollback(cooldownScope, `${command.name}:${cooldownKey}`, cooldownReservation);
    }
    await commandObservability.record(command.name, 'failure', { durationMs: Date.now() - startedAt, reason: commandObservability.reasonFromError(error) });
    await handleCommandError({
      sock,
      chatId,
      message,
      error,
      scope: `command:${command.name}`,
      userMessage: `${command.name} ${args.join(' ')}`.trim(),
    });
  }
  return true;
}

function all() { return [...commands.values()]; }

function helpEntries() {
  return all().filter(c => !c.hidden).map(c => ({
    command: c.localizedName || c.name,
    registryName: c.name,
    aliases: c.aliases || [],
    localizedAliases: c.localizedAliases || [],
    usage: c.usage,
    category: c.categoryKey || c.category,
    categoryKey: c.categoryKey || c.category,
    description: c.description || '',
    note: c.note || '',
    descriptionKey: c.descriptionKey || (c.description ? `registry.${c.name}.description` : ''),
    method: c.method || '',
    methodKey: c.methodKey || (c.method ? `registry.${c.name}.method` : ''),
    cost: c.cost ?? c.contract?.economy?.price ?? 0,
    economyPrice: c.contract?.economy?.price ?? c.cost ?? 0,
    cooldown: c.contract?.cooldown || null,
    version: c.version,
    developer: c.developer || 'Leonardo',
    ownerOnly: c.ownerOnly,
    permission: c.permission,
    helpVisible: c.helpVisible,
  }));
}

function categoryTitle(category) {
  const key = `commandCategories.${category}`;
  return t(key, category);
}

module.exports = { register, addAliases, resolve, resolveText, dispatch, all, helpEntries, categoryTitle, normalize };
