const { t } = require('../lib/i18n');
const fetch = require('node-fetch');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', chunk => { stderr += chunk.toString(); });
        child.once('error', reject);
        child.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-2000)}`)));
    });
}

async function emojimixCommand(sock, chatId, msg) {
    try {
        // Get the text after command
        const text = msg.message?.conversation?.trim() || 
                    msg.message?.extendedTextMessage?.text?.trim() || '';
        
        const args = text.split(' ').slice(1);
        
        if (!args[0]) {
            await sock.sendMessage(chatId, { text: t('media.emojimix.example') });
            return;
        }

        if (!text.includes('+')) {
            await sock.sendMessage(chatId, { 
                text: t('media.emojimix.format') 
            });
            return;
        }

        let [emoji1, emoji2] = args[0].split('+').map(e => e.trim());

        // Using Tenor API endpoint
        const tenorKey = process.env.TENOR_API_KEY;
        if (!tenorKey) {
            await sock.sendMessage(chatId, { text: t('common.serviceUnavailable') });
            return;
        }
        const url = `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(tenorKey)}&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            await sock.sendMessage(chatId, { 
                text: t('media.emojimix.invalid') 
            });
            return;
        }

        // Get the first result URL
        const imageUrl = data.results[0].url;

        // Create temp directory if it doesn't exist
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Generate random filenames with escaped paths
        const tempFile = path.join(tmpDir, `temp_${Date.now()}.png`).replace(/\\/g, '/');
        const outputFile = path.join(tmpDir, `sticker_${Date.now()}.webp`).replace(/\\/g, '/');

        // Download and save the image
        const imageResponse = await fetch(imageUrl);
        const buffer = await imageResponse.buffer();
        fs.writeFileSync(tempFile, buffer);

        // Convert to WebP using argument-based spawning (no shell interpolation).
        await runFfmpeg(['-y', '-i', tempFile, '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000', outputFile]);

        // Check if output file exists
        if (!fs.existsSync(outputFile)) {
            throw new Error('Failed to create sticker file');
        }

        // Read the WebP file
        const stickerBuffer = fs.readFileSync(outputFile);

        // Send the sticker
        await sock.sendMessage(chatId, { 
            sticker: stickerBuffer 
        }, { quoted: msg });

        // Cleanup temp files
        try {
            fs.unlinkSync(tempFile);
            fs.unlinkSync(outputFile);
        } catch (err) {
            console.error('Error cleaning up temp files:', err);
        }

    } catch (error) {
        console.error('Error in emojimix command:', error);
        await sock.sendMessage(chatId, { 
            text: t('media.emojimix.failed') 
        });
    }
}

module.exports = emojimixCommand; 