require('dotenv').config();
const settings = require('../settings');

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

module.exports = { channelInfo };
