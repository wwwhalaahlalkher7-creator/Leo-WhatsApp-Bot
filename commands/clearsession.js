const fs = require('fs');
const path = require('path');
const os = require('os');
const isOwnerOrSudo = require('../lib/isOwner');

const channelInfo = {
};

async function clearSessionCommand(sock, chatId, msg) {
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

        // Define session directory
        const sessionDir = path.join(__dirname, '../session');

        if (!fs.existsSync(sessionDir)) {
            await sock.sendMessage(chatId, { 
                text: '❌ لم يتم العثور على مجلد جلسة الاتصال.',
                ...channelInfo
            });
            return;
        }

        let filesCleared = 0;
        let errors = 0;
        let errorDetails = [];

        // Send initial status
        await sock.sendMessage(chatId, { 
            text: `🔍 جارٍ تنظيف ملفات الجلسة لتحسين الأداء...`,
            ...channelInfo
        });

        const files = fs.readdirSync(sessionDir);
        
        // Count files by type for optimization
        let appStateSyncCount = 0;
        let preKeyCount = 0;

        for (const file of files) {
            if (file.startsWith('app-state-sync-')) appStateSyncCount++;
            if (file.startsWith('pre-key-')) preKeyCount++;
        }

        // Delete files
        for (const file of files) {
            if (file === 'creds.json') {
                // Skip creds.json file
                continue;
            }
            try {
                const filePath = path.join(sessionDir, file);
                fs.unlinkSync(filePath);
                filesCleared++;
            } catch (error) {
                errors++;
                errorDetails.push(`تعذر حذف ${file}.`);
            }
        }

        // Send completion message
        const message = `✅ تم تنظيف ملفات الجلسة بنجاح.\n\n` +
                       `📊 الإحصائيات:\n` +
                       `• إجمالي الملفات المحذوفة: ${filesCleared}\n` +
                       `• ملفات مزامنة الحالة: ${appStateSyncCount}\n` +
                       `• ملفات مفاتيح التهيئة: ${preKeyCount}\n` +
                       (errors > 0 ? `\n⚠️ عدد الأخطاء: ${errors}\n${errorDetails.join('\n')}` : '');

        await sock.sendMessage(chatId, { 
            text: message,
            ...channelInfo
        });

    } catch (error) {
        console.error('Error in clearsession command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ تعذر تنظيف ملفات الجلسة.',
            ...channelInfo
        });
    }
}

module.exports = clearSessionCommand; 