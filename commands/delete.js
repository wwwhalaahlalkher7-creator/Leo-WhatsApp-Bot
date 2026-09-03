const isAdmin = require('../lib/isAdmin');
const { t } = require('../lib/i18n');
const store = require('../lib/lightweight_store');

function cleanJid(id = '') {
    return String(id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
}
function sameParticipant(a, b) {
    if (!a || !b) return false;
    const left = String(a); const right = String(b);
    return left === right || cleanJid(left) === cleanJid(right);
}
function participantCandidates(msg) {
    const key = msg?.key || {};
    return [key.participant, key.participantAlt, key.remoteJid, key.remoteJidAlt].filter(Boolean);
}

async function deleteCommand(sock, chatId, message, senderId) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId, message.key.participantAlt || message.key.remoteJidAlt || null);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: t('commands.delete.botAdmin') }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: t('commands.delete.admins') }, { quoted: message });
            return;
        }

        // Determine target user and count
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        let countArg = null;
        
        // Check if a number is provided
        if (parts.length > 1) {
            const maybeNum = parseInt(parts[1], 10);
            if (!isNaN(maybeNum) && maybeNum > 0) {
                countArg = Math.min(maybeNum, 50);
            }
        }
        
        // Check if user is replying to a message
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        const repliedParticipant = ctxInfo.participant || null;
        const mentioned = Array.isArray(ctxInfo.mentionedJid) && ctxInfo.mentionedJid.length > 0 ? ctxInfo.mentionedJid[0] : null;
        
        // If no number provided but replying to a message, default to 1
        if (countArg === null && repliedParticipant) {
            countArg = 1;
        }
        // If no number provided and not replying/mentioning, show usage message
        else if (countArg === null && !repliedParticipant && !mentioned) {
            await sock.sendMessage(chatId, { 
                text: t('commands.delete.usage') 
            }, { quoted: message });
            return;
        }
        // If no number provided but mentioning a user, default to 1
        else if (countArg === null && mentioned) {
            countArg = 1;
        }


        // Determine target user: replied > mentioned; if neither, delete last N messages from group
        let targetUser = null;
        let repliedMsgId = null;
        let deleteGroupMessages = false;
        let directlyDeletedCount = 0;
        let deleteFailures = 0;
        
        if (repliedParticipant && ctxInfo.stanzaId) {
            targetUser = repliedParticipant;
            repliedMsgId = ctxInfo.stanzaId;
        } else if (mentioned) {
            targetUser = mentioned;
        } else {
            // No user mentioned or replied to - delete last N messages from group
            deleteGroupMessages = true;
        }

        // Gather last N messages from targetUser in this chat
        const chatMessages = Array.isArray(store.messages[chatId]) ? store.messages[chatId] : [];
        // Newest last; we traverse from end backwards
        const toDelete = [];
        const seenIds = new Set();

        if (deleteGroupMessages) {
            // Delete last N messages from group (any user)
            for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < countArg; i--) {
                const m = chatMessages[i];
                if (!seenIds.has(m.key.id)) {
                    // skip protocol/system messages, bot's own messages, and the current command message
                    if (!m.message?.protocolMessage && 
                        !m.key.fromMe && 
                        m.key.id !== message.key.id) {
                        toDelete.push(m);
                        seenIds.add(m.key.id);
                    }
                }
            }
        } else {
            // Original logic for specific user
            // If replying, prioritize deleting the exact replied message first (counts toward N)
            if (repliedMsgId) {
                const repliedInStore = chatMessages.find(m => m.key.id === repliedMsgId && participantCandidates(m).some(candidate => sameParticipant(candidate, targetUser)));
                if (repliedInStore) {
                    toDelete.push(repliedInStore);
                    seenIds.add(repliedInStore.key.id);
                } else {
                    // If not found in store, still attempt delete directly
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: false,
                                id: repliedMsgId,
                                participant: repliedParticipant || targetUser
                            }
                        });
                        // The local store may not contain a message that WhatsApp
                        // can still delete. Count the successful direct request.
                        directlyDeletedCount += 1;
                        countArg = Math.max(0, countArg - 1);
                    } catch (error) {
                        deleteFailures += 1;
                    }
                }
            }
            for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < countArg; i--) {
                const m = chatMessages[i];
                const participant = m.key.participant || m.key.remoteJid;
                if (participantCandidates(m).some(candidate => sameParticipant(candidate, targetUser)) && !seenIds.has(m.key.id)) {
                    // skip protocol/system messages
                    if (!m.message?.protocolMessage) {
                        toDelete.push(m);
                        seenIds.add(m.key.id);
                    }
                }
            }
        }

        if (toDelete.length === 0) {
            const errorMsg = deleteGroupMessages 
                ? t('commands.delete.emptyGroup') 
                : t('commands.delete.emptyUser');
            await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
            return;
        }

        // Delete sequentially with small delay
        for (const m of toDelete) {
            try {
                const msgParticipant = deleteGroupMessages 
                    ? (m.key.participant || m.key.remoteJid) 
                    : (m.key.participant || targetUser);
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: m.key.id,
                        participant: msgParticipant
                    }
                });
                await new Promise(r => setTimeout(r, 300));
            } catch (e) {
                deleteFailures += 1;
            }
        }

        const successCount = directlyDeletedCount + toDelete.length - deleteFailures;
        if (successCount > 0) {
            const partial = deleteFailures > 0 ? `\n⚠️ تعذر حذف ${deleteFailures} رسالة.` : '';
            await sock.sendMessage(chatId, {
                text: `✅ تم حذف ${successCount} رسالة بنجاح.${partial}`
            }, { quoted: message });
            return;
        }
        await sock.sendMessage(chatId, { text: t('commands.delete.failed') }, { quoted: message });
        return;

    
    } catch (err) {
        await sock.sendMessage(chatId, { text: t('commands.delete.failed') }, { quoted: message });
    }
}

module.exports = deleteCommand;

