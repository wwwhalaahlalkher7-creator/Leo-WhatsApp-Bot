'use strict';

const settings = require('../settings');
const { t } = require('../lib/i18n');
global.t = t;
const commandRegistry = require('../commands/registry-init');
const { handleHelpReply } = require('../commands/help');
const { handlePdfReply, handlePdfImageCollection } = require('../commands/pdf');
const { handleAnimeReply } = require('../commands/anime');
const jsonStore = require('../lib/storage');
const { handleCommandError } = require('../lib/errors/handler');
const { createLocalizedSock } = require('../lib/localized-sock');
const { isBanned } = require('../lib/isBanned');
const { isSudo } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');
const ownerCommand = require('../commands/owner');
const { incrementMessageCount } = require('../commands/topmembers');
const { handleTicTacToeMove } = require('../commands/tictactoe');
const { Antilink } = require('../lib/antilink');
const { handleMentionDetection } = require('../commands/mention');
const { handleBadwordDetection } = require('../lib/antibadword');
const { handleChatbotResponse } = require('../commands/chatbot');
const { handleMessageRevocation, storeMessage } = require('../commands/antidelete');
const { addCommandReaction } = require('../lib/reactions');
const { isBotEnabled, isGroupApproved } = require('../lib/access-control');
const { handleAutoread } = require('../commands/autoread');
const { handleAutotypingForMessage, showTypingAfterCommand } = require('../commands/autotyping');
const { handleTagDetection } = require('../commands/antitag');
const { answerTrivia, isTriviaActive, leaveTrivia } = require('../competition/engine');
const { guess, isGuessActive } = require('../commands/hangman');
const { afterSuccessfulCommand } = require('../systems/daily-reward');

const channelInfo = settings.channelJid && settings.channelName ? {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: settings.channelJid,
            newsletterName: settings.channelName,
            serverMessageId: -1
        }
    }
} : {};

async function handleMessages(sock, messageUpdate, printLog) {
    // Keep error-handler context outside the try block so the catch block can
    // safely report failures even when local variables inside try are scoped away.
    let errorChatId = null;
    let errorMessage = null;
    let errorUserMessage = '';
    try {
        // Commands receive a localized socket so static user-facing English strings are translated centrally.
        sock = createLocalizedSock(sock);
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        errorMessage = message;
        if (!message?.message) return;

        // Handle autoread functionality
        await handleAutoread(sock, message);

        // Store message for antidelete feature
        if (message.message) {
            storeMessage(sock, message);
        }

        // Handle message revocation
        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        const chatId = message.key.remoteJid;
        errorChatId = chatId;
        const senderId = message.key.participant || message.key.remoteJid;
        const senderIdAlt = message.key.participantAlt || message.key.remoteJidAlt || null;
        const ownerIdentityCandidates = [senderId, senderIdAlt].filter(Boolean);
        const isGroup = chatId.endsWith('@g.us');
        const senderIsSudo = await isSudo(senderId) || (senderIdAlt ? await isSudo(senderIdAlt) : false);
        const senderIsOwnerOrSudo = await isOwnerOrSudo(senderId, sock, chatId, senderIdAlt);
        // Private chats are intentionally owner-only. Sudo users retain their
        // group privileges but do not receive private-chat responses.
        const cleanOwnerNumber = String(settings.ownerNumber || '').replace(/[^0-9]/g, '');
        const isActualOwner = message.key.fromMe || [senderId, senderIdAlt].filter(Boolean).some(id => String(id).split(':')[0].split('@')[0].replace(/[^0-9]/g, '') === cleanOwnerNumber);

        // Archive first (storeMessage above), then silently ignore every private
        // message from non-owners. This gate is deliberately before buttons and
        // commands so no private response can bypass it.
        if (!isGroup && !isActualOwner) return;

        // Arabic-first command aliases. English commands remain supported for compatibility.
        // Only the command token is translated; arguments are preserved exactly.
        function normalizeArabicCommand(text) {
            let value = String(text || '').trim();
            if (!value.startsWith('.')) return value;
            const match = value.match(/^\.([^\s]+)([\s\S]*)$/);
            if (!match) return value;
            const key = match[1].replace(/ـ/g, '');
            const tail = match[2] || '';
            if (key === 'سجل' && /^\s+المسابقة\s*$/i.test(tail)) return '.contest-history';
            if (key === 'منشن' && /^\s+(تشغيل|شغل|تفعيل|إيقاف|ايقاف|وقف|تعطيل|on|off)\b/i.test(tail)) {
                value = `.mention${tail}`;
            } else if (key === 'تشغيل' && /^\s+البوت(?:\s|$)/i.test(tail)) {
                value = `.bot${tail.replace(/^\s+البوت/i, '')}`;
            } else if (key === 'إيقاف' && /^\s+البوت(?:\s|$)/i.test(tail)) {
                value = `.bot${tail.replace(/^\s+البوت/i, '')}`;
            } else {
                // Resolve the longest registered command BEFORE collapsing Arabic
                // aliases to their canonical names. This is critical for commands
                // such as `.صورة الملصق`, `.صورة البروفايل`, `.صورة المجموعة`,
                // `.منع الروابط`, and `.اكس او`; otherwise the first token (e.g.
                // `صورة`) steals the message as a shorter command.
                const resolved = commandRegistry.resolveText(value);
                if (resolved.command) {
                    const canonicalArgs = resolved.args.length ? ` ${resolved.args.join(' ')}` : '';
                    value = `.${resolved.command.name}${canonicalArgs}`;
                } else {
                    const registered = commandRegistry.resolve(key);
                    value = registered ? `.${registered.name}${tail}` : value;
                }
            }
            const parts = value.split(/\s+/);
            const command = parts[0];
            const toggles = new Set(['.chatbot','.welcome','.goodbye','.autostatus','.autoreact','.areact','.autotyping','.autoread','.anticall','.antitag','.mention','.setmention','.antilink','.antibadword']);
            if (toggles.has(command) && parts[1]) {
                const arg = parts[1].toLowerCase();
                if (['تشغيل','شغل','تفعيل','مفعل','نعم','on'].includes(arg)) parts[1] = 'on';
                if (['إيقاف','ايقاف','وقف','تعطيل','معطل','لا','off'].includes(arg)) parts[1] = 'off';
            }
            return parts.join(' ');
        }

        let rawCommandText = (
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            message.message?.buttonsResponseMessage?.selectedButtonId?.trim() ||
            ''
        ).replace(/\.\s+/g, '.').trim();
        if (/^(اوامر|أوامر|commands|command|مساعدة|المساعدة|help)$/i.test(rawCommandText)) rawCommandText = '.' + rawCommandText;
        let userMessage = normalizeArabicCommand(rawCommandText).toLowerCase().trim();
        errorUserMessage = userMessage;
        // During an active trivia round, `.استمرار` / `.مغادرة` are handled as
        // reply-bound game actions below. Outside trivia, `.مغادرة` remains the
        // owner's group-leave command.

        // Preserve raw message for commands like .tag that need original casing
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        // Only log command usage
        if (userMessage.startsWith('.')) {
            console.log(`📝 Command used in ${isGroup ? 'group' : 'private'}: ${userMessage}`);
        }
        // Read bot mode once; don't early-return so moderation can still run in private mode
        let isPublic = true;
        try {
            const data = jsonStore.read('bot-mode', { isPublic: true });
            if (typeof data.isPublic === 'boolean') isPublic = data.isPublic;
        } catch (error) {
            console.error('Error checking access mode:', error);
            // default isPublic=true on error
        }
        const isOwnerOrSudoCheck = message.key.fromMe || senderIsOwnerOrSudo;
        const commandToken = userMessage.split(/\s+/)[0];

        // Trivia decision actions may be written with a dot as well. They are
        // accepted only as replies to the exact safe-point decision message.
        if (isTriviaActive(chatId) && /^\.(استمرار|متابعة|مغادرة|مغادره)(?:\s|$)/i.test(rawCommandText)) {
            const actionText = rawCommandText.replace(/^\./, '').trim();
            const handledTriviaAction = await answerTrivia(sock, chatId, actionText, senderId, message, senderIdAlt);
            if (handledTriviaAction) return;
        }

        // HARD GROUP ACCESS GATE:
        // Until the owner explicitly approves a group, absolutely no command,
        // button action, game input, or feature response is allowed there.
        // The only exception is the owner-only approval command itself.
        const groupApproved = !isGroup || isGroupApproved(chatId);
        const preResolved = commandRegistry.resolve(commandToken);
        const approvalCommand = preResolved?.name === 'approve';
        if (isGroup && !groupApproved && !approvalCommand) return;

        // Global pause applies only after the approval gate so an unapproved
        // group can still be approved by the owner even if the bot is paused.
        const botControlCommand = preResolved?.name === 'bot';
        if (!isBotEnabled() && !botControlCommand && !approvalCommand) return;

        // Handle button responses
        if (message.message?.buttonsResponseMessage) {
            const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
            const chatId = message.key.remoteJid;

            if (buttonId === 'channel') {
                await sock.sendMessage(chatId, {
                    text: '📢 لا توجد قناة رسمية مفعّلة حاليًا.'
                }, { quoted: message });
                return;
            } else if (buttonId === 'owner') {
                                await ownerCommand(sock, chatId);
                return;
            } else if (buttonId === 'support') {
                await sock.sendMessage(chatId, {
                    text: '🛠️ لا يوجد رابط دعم خارجي مفعّل حاليًا.'
                }, { quoted: message });
                return;
            }
        }

                // Banned users: ignore normal messages/reactions. For commands, warn only once
        // during the current bot process so repeated commands do not cause spam.
        if (isBanned(senderId) && !userMessage.startsWith('.unban')) {
            if (userMessage.startsWith('.')) {
                const warnedKey = `${chatId}:${senderId}`;
                if (!global.__leoBannedCommandWarnings) global.__leoBannedCommandWarnings = new Set();
                if (!global.__leoBannedCommandWarnings.has(warnedKey)) {
                    global.__leoBannedCommandWarnings.add(warnedKey);
                    await sock.sendMessage(chatId, {
                        text: '🚫 أنت محظور من استخدام البوت. تواصل مع أحد المشرفين أو مالك المجموعة لرفع الحظر.',
                        ...channelInfo
                    });
                }
            }
            return;
        }

        // Continue an active multi-image PDF collection before normal command handling.
        if (message?.message && senderId) {
            const collected = await handlePdfImageCollection(sock, chatId, message, senderId, userMessage);
            if (collected) return;
        }

        // PDF menu replies have priority over all other numeric handlers.
        // A PDF operation number (1-6) is accepted only when replying to the
        // exact PDF menu message; ordinary standalone numbers are not PDF input.
        if (/^[1-7١-٧]$/.test(userMessage)) {
            const pdfReplyHandled = await handlePdfReply(sock, chatId, message, senderId, rawCommandText);
            if (pdfReplyHandled) return;
        }

        // Help navigation replies must be checked before other numeric moves.
        if (/^[0-9٠-٩۰-۹]{1,2}$/.test(userMessage)) {
            const handledHelpReply = await handleHelpReply(sock, chatId, message, userMessage);
            if (handledHelpReply) return;
            const handledAnimeReply = await handleAnimeReply(sock, chatId, message, userMessage, senderId);
            if (handledAnimeReply) return;
        }

        // Trivia answers are accepted only when the player replies to the current trivia question.
        // Unrelated messages from the player or other members must continue normally.
        if (isTriviaActive(chatId) && !userMessage.startsWith('.')) {
            const handledTrivia = await answerTrivia(sock, chatId, userMessage, senderId, message, senderIdAlt);
            if (handledTrivia) return;
        }

        // First check if it's a game move
        if (/^[1-9]$/.test(userMessage) || /^(استسلام|إستسلام|surrender)$/i.test(userMessage)) {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage, message);
            return;
        }
        if (isGuessActive(chatId) && !userMessage.startsWith('.')) {
            const handledGuess = await guess(sock, chatId, userMessage, senderId, message);
            if (handledGuess) return;
        }

        /*  // Basic message response in private chat
          if (!isGroup && (userMessage === 'hi' || userMessage === 'hello' || userMessage === 'bot' || userMessage === 'hlo' || userMessage === 'hey' || userMessage === 'bro')) {
              await sock.sendMessage(chatId, {
                  text: 'Hi, How can I help you?\nYou can use .menu for more info and commands.',
                  ...channelInfo
              });
              return;
          } */

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // Check for bad words and antilink FIRST, before ANY other processing
        // Always run moderation in groups, regardless of mode
        if (isGroup) {
            if (userMessage) {
                await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
            }
            // Antilink checks message text internally, so run it even if userMessage is empty
            await Antilink(message, sock);
        }

        // Non-owner private messages were already archived and stopped above.

        // Non-command messages continue here. PDF menu numbers were already
        // checked above and are accepted only as replies to the active PDF menu.
        if (!userMessage.startsWith('.')) {
            // Show typing indicator if autotyping is enabled
            await handleAutotypingForMessage(sock, chatId, userMessage);

            if (isGroup) {
                // Always run moderation features (antitag) regardless of mode
                await handleTagDetection(sock, chatId, message, senderId);
                await handleMentionDetection(sock, chatId, message);

                // Only run chatbot in public mode or for owner/sudo
                if (isPublic || isOwnerOrSudoCheck) {
                    await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                }
            }
            return;
        }
        // In private mode, only owner/sudo can run commands
        if (!isPublic && !isOwnerOrSudoCheck) {
            return;
        }

        // Registry is the single source of truth for command permissions.
        // Legacy admin/owner command arrays and duplicated checks were removed.
        const resolvedRegistry = commandRegistry.resolveText(userMessage);
        const registryCommand = resolvedRegistry.command;
        if (registryCommand) {
            const registryToken = registryCommand.name;
            const registryArgs = resolvedRegistry.args;
            const dispatchContext = {
                senderId, senderIdAlt, isGroup, isOwner: senderIsOwnerOrSudo,
                isSenderAdmin: false, isBotAdmin: false
            };
            const handled = await commandRegistry.dispatch(
                sock, chatId, message, registryToken, registryArgs, dispatchContext
            );
            if (handled) {
                await showTypingAfterCommand(sock, chatId);
                await addCommandReaction(sock, message);
                if (dispatchContext.commandSucceeded) {
                    try { await afterSuccessfulCommand(sock, chatId, senderId, message, registryToken, require('../systems/economy').createEconomy()); }
                    catch (rewardError) { console.error('[DAILY-REWARD]', rewardError?.message || rewardError); }
                }
                return;
            }
        }

        // During an active trivia round, Arabic "مغادرة" belongs to the game, not the owner-only bot-leave command.
        if (isTriviaActive(chatId) && (userMessage === '.leave' || userMessage === '.leave نعم' || userMessage === '.leave yes')) {
            const confirmed = userMessage !== '.leave';
            await leaveTrivia(sock, chatId, senderId, message, confirmed, senderIdAlt);
            return;
        }


    } catch (error) {
        await handleCommandError({ sock, chatId: errorChatId, message: errorMessage, error, scope: 'message-handler', userMessage: errorUserMessage });
    }
}

module.exports = { handleMessages };
