const { t } = require('../lib/i18n');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');

async function blurCommand(sock, chatId, message, quotedMessage) {
  try {
    let imageBuffer;
    if (quotedMessage?.imageMessage) {
      imageBuffer = await downloadMediaMessage({ message: { imageMessage: quotedMessage.imageMessage } }, 'buffer', {}, {});
    } else if (message.message?.imageMessage) {
      imageBuffer = await downloadMediaMessage(message, 'buffer', {}, {});
    } else {
      return sock.sendMessage(chatId, { text: '❌ رد على صورة أو أرسل صورة مع `.تمويه`.' }, { quoted: message });
    }

    const out = await sharp(imageBuffer)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .blur(10)
      .jpeg({ quality: 88 })
      .toBuffer();

    await sock.sendMessage(chatId, {
      image: out,
      caption: '✅ تم تشويش الصورة بالكامل.'
    }, { quoted: message });
  } catch (error) {
    console.error('Error in blur command:', error);
    await sock.sendMessage(chatId, { text: t('media.blur.failed') }, { quoted: message });
  }
}

module.exports = blurCommand;
