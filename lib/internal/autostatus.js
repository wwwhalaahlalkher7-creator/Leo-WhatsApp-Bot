const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../isOwner');
const dataStore = require('../storage');

const channelInfo = {
};

// Path to store auto status configuration
const configPath = 'autoStatus.json';

// Initialize config file if it doesn't exist
if (!dataStore.read(configPath, null)) dataStore.writeSync(configPath, { enabled: false, reactOn: false });

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!msg.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ هذا الأمر للمالك فقط.',
                ...channelInfo
            });
            return;
        }

        // Read current config
        let config = dataStore.read(configPath, { enabled: false, reactOn: false });

        // If no arguments, show current status
        if (!args || args.length === 0) {
            const status = config.enabled ? 'enabled' : 'disabled';
            const reactStatus = config.reactOn ? 'enabled' : 'disabled';
            await sock.sendMessage(chatId, { 
                text: `🔄 *إعدادات الحالة التلقائية*\n\n📱 *عرض الحالات:* ${config.enabled ? 'تشغيل' : 'إيقاف'}\n💫 *التفاعل مع الحالات:* ${config.reactOn ? 'تشغيل' : 'إيقاف'}\n\nاستخدم \`.الحالة التلقائية تشغيل\` أو \`.الحالة التلقائية إيقاف\`.\nللتفاعل: \`.الحالة التلقائية تفاعل تشغيل/إيقاف\``,
                ...channelInfo
            });
            return;
        }

        // Handle on/off commands
        const command = ({'تشغيل':'on','شغل':'on','تفعيل':'on','إيقاف':'off','ايقاف':'off','وقف':'off','تعطيل':'off','تفاعل':'react'})[args[0].toLowerCase()] || args[0].toLowerCase();
        
        if (command === 'on') {
            config.enabled = true;
            dataStore.writeSync(configPath, config);
            await sock.sendMessage(chatId, { 
                text: '✅ تم تشغيل عرض الحالات التلقائي.\nسيقوم LeoBot بقراءة الحالات تلقائيًا.',
                ...channelInfo
            });
        } else if (command === 'off') {
            config.enabled = false;
            dataStore.writeSync(configPath, config);
            await sock.sendMessage(chatId, { 
                text: '⛔ تم إيقاف عرض الحالات التلقائي.',
                ...channelInfo
            });
        } else if (command === 'react') {
            // Handle react subcommand
            if (!args[1]) {
                await sock.sendMessage(chatId, { 
                    text: '❌ حدد تشغيل أو إيقاف للتفاعل.',
                    ...channelInfo
                });
                return;
            }
            
            const reactCommand = args[1].toLowerCase();
            if (reactCommand === 'on') {
                config.reactOn = true;
                dataStore.writeSync(configPath, config);
                await sock.sendMessage(chatId, { 
                    text: '💫 تم تشغيل التفاعل مع الحالات.',
                    ...channelInfo
                });
            } else if (reactCommand === 'off') {
                config.reactOn = false;
                dataStore.writeSync(configPath, config);
                await sock.sendMessage(chatId, { 
                    text: '⛔ تم إيقاف التفاعل مع الحالات.',
                    ...channelInfo
                });
            } else {
                await sock.sendMessage(chatId, { 
                    text: '❌ أمر التفاعل غير صحيح. استخدم تشغيل أو إيقاف.',
                    ...channelInfo
                });
            }
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ الأمر غير صحيح. استخدم تشغيل أو إيقاف.',
                ...channelInfo
            });
        }

    } catch (error) {
        console.error('Error in autostatus command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ تعذر تحديث الحالة التلقائية حاليًا.',
            ...channelInfo
        });
    }
}

// Function to check if auto status is enabled
function isAutoStatusEnabled() {
    try {
        const config = dataStore.read(configPath, { enabled: false, reactOn: false });
        return config.enabled;
    } catch (error) {
        console.error('Error checking auto status config:', error);
        return false;
    }
}

// Function to check if status reactions are enabled
function isStatusReactionEnabled() {
    try {
        const config = dataStore.read(configPath, { enabled: false, reactOn: false });
        return config.reactOn;
    } catch (error) {
        console.error('Error checking status reaction config:', error);
        return false;
    }
}

// Function to react to status using proper method
async function reactToStatus(sock, statusKey) {
    try {
        if (!isStatusReactionEnabled()) {
            return;
        }

        // Use the proper relayMessage method for status reactions
        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: statusKey.participant || statusKey.remoteJid,
                        fromMe: false
                    },
                    text: '💚'
                }
            },
            {
                messageId: statusKey.id,
                statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
            }
        );
        
        // Removed success log - only keep errors
    } catch (error) {
        console.error('❌ Error reacting to status:', error.message);
    }
}

// Function to handle status updates
async function handleStatusUpdate(sock, status) {
    try {
        if (!isAutoStatusEnabled()) {
            return;
        }

        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Handle status from messages.upsert
        if (status.messages && status.messages.length > 0) {
            const msg = status.messages[0];
            if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                try {
                    await sock.readMessages([msg.key]);
                    const sender = msg.key.participant || msg.key.remoteJid;
                    
                    // React to status if enabled
                    await reactToStatus(sock, msg.key);
                    
                    // Removed success log - only keep errors
                } catch (err) {
                    if (err.message?.includes('rate-overlimit')) {
                        console.log('⚠️ Rate limit hit, waiting before retrying...');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await sock.readMessages([msg.key]);
                    } else {
                        throw err;
                    }
                }
                return;
            }
        }

        // Handle direct status updates
        if (status.key && status.key.remoteJid === 'status@broadcast') {
            try {
                await sock.readMessages([status.key]);
                const sender = status.key.participant || status.key.remoteJid;
                
                // React to status if enabled
                await reactToStatus(sock, status.key);
                
                // Removed success log - only keep errors
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    console.log('⚠️ Rate limit hit, waiting before retrying...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await sock.readMessages([status.key]);
                } else {
                    throw err;
                }
            }
            return;
        }

        // Handle status in reactions
        if (status.reaction && status.reaction.key.remoteJid === 'status@broadcast') {
            try {
                await sock.readMessages([status.reaction.key]);
                const sender = status.reaction.key.participant || status.reaction.key.remoteJid;
                
                // React to status if enabled
                await reactToStatus(sock, status.reaction.key);
                
                // Removed success log - only keep errors
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    console.log('⚠️ Rate limit hit, waiting before retrying...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await sock.readMessages([status.reaction.key]);
                } else {
                    throw err;
                }
            }
            return;
        }

    } catch (error) {
        console.error('❌ Error in auto status view:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
}; 