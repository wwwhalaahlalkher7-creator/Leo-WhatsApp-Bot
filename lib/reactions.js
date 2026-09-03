const fs = require('fs');
const path = require('path');
const dataStore = require('./storage');

// List of emojis for command reactions
const commandEmojis = ['⏳'];

// Path for storing auto-reaction state
const USER_GROUP_DATA = 'userGroupData.json';

// Load auto-reaction state from file
function loadAutoReactionState() {
    try {
        if (true) {
            const data = dataStore.read(USER_GROUP_DATA, {});
            return data.autoReaction || false;
        }
    } catch (error) {
        console.error('Error loading auto-reaction state:', error);
    }
    return false;
}

// Save auto-reaction state to file
function saveAutoReactionState(state) {
    try {
        const data = dataStore.read(USER_GROUP_DATA, { groups: [], chatbot: {} });
        
        data.autoReaction = state;
        dataStore.writeSync(USER_GROUP_DATA, data);
    } catch (error) {
        console.error('Error saving auto-reaction state:', error);
    }
}

// Store auto-reaction state
let isAutoReactionEnabled = loadAutoReactionState();

function getRandomEmoji() {
    return commandEmojis[0];
}

// Function to add reaction to a command message
async function addCommandReaction(sock, message) {
    try {
        if (!isAutoReactionEnabled || !message?.key?.id) return;
        
        const emoji = getRandomEmoji();
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        console.error('Error adding command reaction:', error);
    }
}

// Function to handle areact command
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ هذا الأمر للمالك فقط.',
                quoted: message
            });
            return;
        }

        const raw = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = raw.trim().split(/\s+/);
        const action = ({'تشغيل':'on','شغل':'on','تفعيل':'on','إيقاف':'off','ايقاف':'off','وقف':'off','تعطيل':'off',on:'on',off:'off'})[args[1]?.toLowerCase()] || args[1]?.toLowerCase();

        if (action === 'on') {
            isAutoReactionEnabled = true;
            saveAutoReactionState(true);
            await sock.sendMessage(chatId, { 
                text: '✅ تم تشغيل الرد التلقائي.',
                quoted: message
            });
        } else if (action === 'off') {
            isAutoReactionEnabled = false;
            saveAutoReactionState(false);
            await sock.sendMessage(chatId, { 
                text: '⛔ تم إيقاف الرد التلقائي.',
                quoted: message
            });
        } else {
            const currentState = isAutoReactionEnabled ? 'enabled' : 'disabled';
            await sock.sendMessage(chatId, { 
                text: `🔁 الرد التلقائي: *${currentState === 'enabled' ? 'تشغيل' : 'إيقاف'}*\n\nاستخدم \`.رد تلقائي تشغيل\` أو \`.رد تلقائي إيقاف\`.`,
                quoted: message
            });
        }
    } catch (error) {
        console.error('Error handling areact command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ تعذر التحكم في الرد التلقائي.',
            quoted: message
        });
    }
}

module.exports = {
    addCommandReaction,
    handleAreactCommand
}; 