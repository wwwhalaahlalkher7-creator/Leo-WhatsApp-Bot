const settings = require('../settings');
const jsonStore = require('../lib/storage');
const { t } = require('../lib/i18n');
const ai = require('../systems/ai');
const isOwnerOrSudo = require('../lib/isOwner');
const media = require('../systems/ai/media');
const capabilities = require('../systems/ai/capabilities');

const USER_GROUP_DATA = 'userGroupData.json';
// Lightweight user facts remain local; conversation context is centralized in systems/ai/context.
const chatMemory = {
    userInfo: new Map()
};

// Load user group data
function loadUserGroupData() {
    try {
        const raw = jsonStore.read(USER_GROUP_DATA, { groups: [], chatbot: {} });

        // Older data files may not contain the chatbot section. Normalize the
        // stored shape so every caller can safely access data.chatbot[chatId].
        const data = (raw && typeof raw === 'object' && !Array.isArray(raw))
            ? raw
            : {};

        return {
            ...data,
            groups: Array.isArray(data.groups) ? data.groups : [],
            chatbot: (data.chatbot && typeof data.chatbot === 'object' && !Array.isArray(data.chatbot))
                ? data.chatbot
                : {}
        };
    } catch (error) {
        console.error('❌ Error loading user group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

// Save user group data
function saveUserGroupData(data) {
    try {
        jsonStore.write(USER_GROUP_DATA, data).catch(err => console.error('Storage error:', err.message));
    } catch (error) {
        console.error('❌ Error saving user group data:', error.message);
    }
}

// Add random delay between 2-5 seconds
function getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 2000;
}

// Add typing indicator
async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {
        console.error('Typing indicator error:', error);
    }
}

// Extract user information from messages
function extractUserInfo(message) {
    const info = {};
    
    // Extract name
    if (message.toLowerCase().includes('my name is')) {
        info.name = message.split('my name is')[1].trim().split(' ')[0];
    }
    
    // Extract age
    if (message.toLowerCase().includes('i am') && message.toLowerCase().includes('years old')) {
        info.age = message.match(/\d+/)?.[0];
    }
    
    // Extract location
    if (message.toLowerCase().includes('i live in') || message.toLowerCase().includes('i am from')) {
        info.location = message.split(/(?:i live in|i am from)/i)[1].trim().split(/[.,!?]/)[0];
    }
    
    return info;
}

async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: t('chatbot.setup'),
            quoted: message
        });
    }

    const data = loadUserGroupData();
    
    // Get bot's number
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Check if sender is bot owner
    const senderId = message.key.participant || message.participant || message.key.remoteJid;
    const senderAlt = message.key.participantAlt || message.key.remoteJidAlt || null;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId, senderAlt);

    // If it's the bot owner, allow access immediately
    if (isOwner) {
        match = String(match || '').trim().toLowerCase().replace(/^تشغيل$/, 'on').replace(/^إيقاف$/, 'off').replace(/^ايقاف$/, 'off');

    if (match === 'on') {
            await showTyping(sock, chatId);
            if (data.chatbot[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: t('chatbot.alreadyEnabled'),
                    quoted: message
                });
            }
            data.chatbot[chatId] = true;
            saveUserGroupData(data);
            console.log(`✅ Chatbot enabled for group ${chatId}`);
            return sock.sendMessage(chatId, { 
                text: t('chatbot.enabled'),
                quoted: message
            });
        }

        if (match === 'off') {
            await showTyping(sock, chatId);
            if (!data.chatbot[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: t('chatbot.alreadyDisabled'),
                    quoted: message
                });
            }
            delete data.chatbot[chatId];
            saveUserGroupData(data);
            console.log(`✅ Chatbot disabled for group ${chatId}`);
            return sock.sendMessage(chatId, { 
                text: t('chatbot.disabled'),
                quoted: message
            });
        }
    }

    // For non-owners, check admin status
    let isAdmin = false;
    if (chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch (e) {
            console.warn('⚠️ Could not fetch group metadata. Bot might not be admin.');
        }
    }

    if (!isAdmin && !isOwner) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: t('common.notAdmin'),
            quoted: message
        });
    }

    if (match === 'on') {
        await showTyping(sock, chatId);
        if (data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { 
                text: t('chatbot.alreadyEnabled'),
                quoted: message
            });
        }
        data.chatbot[chatId] = true;
        saveUserGroupData(data);
        console.log(`✅ Chatbot enabled for group ${chatId}`);
        return sock.sendMessage(chatId, { 
            text: t('chatbot.enabled'),
            quoted: message
        });
    }

    if (match === 'off') {
        await showTyping(sock, chatId);
        if (!data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { 
                text: t('chatbot.alreadyDisabled'),
                quoted: message
            });
        }
        delete data.chatbot[chatId];
        saveUserGroupData(data);
        console.log(`✅ Chatbot disabled for group ${chatId}`);
        return sock.sendMessage(chatId, { 
            text: t('chatbot.disabled'),
            quoted: message
        });
    }

    await showTyping(sock, chatId);
    return sock.sendMessage(chatId, { 
        text: t('chatbot.invalid'),
        quoted: message
    });
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    try {
        // Get bot's ID - try multiple formats
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];
        const botLid = sock.user.lid; // Get the actual LID from sock.user
        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            `${botNumber}@whatsapp.net`,
            `${botNumber}@lid`,
            botLid, // Add the actual LID
            `${botLid.split(':')[0]}@lid` // Add LID without session part
        ];

        // Check for mentions and replies
        let isBotMentioned = false;
        let isReplyToBot = false;

        // Check if message is a reply and contains bot mention
        if (message.message?.extendedTextMessage) {
            const mentionedJid = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
            const quotedParticipant = message.message.extendedTextMessage.contextInfo?.participant;
            
            // Check if bot is mentioned in the reply
            isBotMentioned = mentionedJid.some(jid => {
                const jidNumber = jid.split('@')[0].split(':')[0];
                return botJids.some(botJid => {
                    const botJidNumber = botJid.split('@')[0].split(':')[0];
                    return jidNumber === botJidNumber;
                });
            });
            
            // Check if replying to bot's message
            if (quotedParticipant) {
                // Normalize both quoted and bot IDs to compare cleanly
                const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
                isReplyToBot = botJids.some(botJid => {
                    const cleanBot = botJid.replace(/[:@].*$/, '');
                    return cleanBot === cleanQuoted;
                });
            }
        }
        // Also check regular mentions in conversation
        else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        if (!isBotMentioned && !isReplyToBot) return;

        // Clean the message
        let cleanedMessage = userMessage;

        // Multimodal input: the chatbot can understand media attached to the
        // current message or quoted message. Deterministic media download is
        // kept in systems/ai/media; provider selection stays behind the AI
        // capability layer.
        const mediaTarget = media.currentOrQuoted(message);
        let mediaContext = null;
        if (mediaTarget) {
            try {
                const buffer = await media.download(mediaTarget);
                const mimeType = media.mime(mediaTarget);
                const filename = media.filename(mediaTarget);

                if (mediaTarget.type === 'image' && capabilities.has('chat')) {
                    mediaContext = {
                        type: 'image',
                        content: [
                            { type: 'text', text: cleanedMessage || 'حلّل الصورة واذكر أهم ما يظهر فيها.' },
                            { type: 'image_url', image_url: { url: media.imageDataUrl(buffer, mimeType) } }
                        ]
                    };
                } else if (mediaTarget.type === 'audio' && capabilities.has('audioTranscription')) {
                    const transcript = await capabilities.audioTranscription(buffer, filename, mimeType);
                    cleanedMessage = cleanedMessage
                        ? `${cleanedMessage}\n\nتفريغ التسجيل الصوتي:\n${transcript}`
                        : `حلّل التسجيل الصوتي وأجب بناءً على مضمونه.\n\nتفريغ التسجيل:\n${transcript}`;
                    mediaContext = { type: 'audio', transcript };
                } else if (mediaTarget.type === 'document' && capabilities.has('documentExtraction')) {
                    const extracted = await capabilities.documentExtraction(buffer, filename, mimeType);
                    const extractedText = typeof extracted === 'string'
                        ? extracted
                        : (extracted?.text || extracted?.content || extracted?.result?.text || '');
                    if (!extractedText) throw new Error('لم يتم استخراج نص قابل للتحليل من الملف.');
                    cleanedMessage = cleanedMessage
                        ? `${cleanedMessage}\n\nمحتوى الملف المرفق:\n${String(extractedText).slice(0, 30000)}`
                        : `لخّص وحلّل الملف المرفق.\n\nمحتوى الملف:\n${String(extractedText).slice(0, 30000)}`;
                    mediaContext = { type: 'document', filename };
                } else if (mediaTarget.type === 'video') {
                    cleanedMessage = cleanedMessage || 'أخبرني بما يمكنك استنتاجه من هذا الفيديو.';
                    mediaContext = { type: 'video' };
                }
            } catch (mediaError) {
                console.warn('⚠️ Chatbot media processing failed:', mediaError?.message || mediaError);
                if (!cleanedMessage) {
                    await sock.sendMessage(chatId, {
                        text: 'تعذر تحليل الوسائط المرفقة حاليًا. جرّب مرة أخرى أو أرسلها مع سؤال واضح.',
                        quoted: message
                    });
                    return;
                }
            }
        }
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }

        // Keep lightweight user facts locally, but use the shared AI context keyed by chat + user.
        if (!chatMemory.userInfo.has(senderId)) chatMemory.userInfo.set(senderId, {});

        // Extract and update user information
        const userInfo = extractUserInfo(cleanedMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...userInfo
            });
        }

        const sharedContext = ai.context.format(chatId, senderId);
        ai.context.addUser(chatId, senderId, cleanedMessage);

        // Show typing indicator
        await showTyping(sock, chatId);

        // Get AI response with context
        const response = await getAIResponse(cleanedMessage, {
            context: sharedContext,
            userInfo: chatMemory.userInfo.get(senderId),
            chatId,
            senderId,
            content: mediaContext?.content,
            mediaKey: message.key?.id || mediaTarget?.filename || null
        });

        if (!response) {
            await sock.sendMessage(chatId, { 
                text: t('ai.thinking'),
                quoted: message
            });
            return;
        }

        // Add human-like delay before sending response
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

        // Send response as a reply with proper context
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('❌ Error in chatbot response:', error.message);
        
        // Handle session errors - don't try to send error messages
        if (error.message && error.message.includes('No sessions')) {
            console.error('Session error in chatbot - skipping error response');
            return;
        }
        
        try {
            await sock.sendMessage(chatId, { 
                text: t('ai.confused'),
                quoted: message
            });
        } catch (sendError) {
            console.error('Failed to send chatbot error message:', sendError.message);
        }
    }
}

async function getAIResponse(userMessage, userContext) {
    try {
        const result = await ai.chat(userMessage, {
            language: 'ar',
            context: `${userContext.context || ''}\n\nمعلومات المستخدم التي ذكرها بنفسه: ${JSON.stringify(userContext.userInfo || {})}`.trim(),
            mode: 'auto',
            content: userContext.content,
            mediaKey: userContext.mediaKey
        });
        const reply = result?.text?.trim();
        if (reply && userContext.chatId && userContext.senderId) {
            ai.context.addAssistant(userContext.chatId, userContext.senderId, reply);
        }
        return reply || null;
    } catch (error) {
        console.error('AI provider error:', error.message, error.failures || '');
        return null;
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
}; 