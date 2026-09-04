// Central bot settings.
// Secrets belong in .env, never in this file.
require('dotenv').config();

const normalizeNumber = (value = '') => String(value).replace(/[^0-9]/g, '');
const packageInfo = require('./package.json');

const settings = {
  packname: 'Leo Bot',
  author: process.env.BOT_OWNER_NAME || 'Leonardo',
  botName: 'Leo Bot',
  botOwner: process.env.BOT_OWNER_NAME || 'Leonardo',
  ownerNumber: normalizeNumber(process.env.OWNER_NUMBER || ''),
  botNumber: normalizeNumber(process.env.BOT_NUMBER || ''),
  commandMode: 'public',
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: 'WhatsApp entertainment and assistant bot.',
  version: packageInfo.version,
  updateZipUrl: 'https://github.com/wwwhalaahlalkher7-creator/Leo-WhatsApp-Bot/archive/refs/heads/main.zip',
  githubRepo: 'wwwhalaahlalkher7-creator/Leo-WhatsApp-Bot',
  channelLink: process.env.CHANNEL_LINK || '',
  channelJid: process.env.CHANNEL_JID || '',
  channelName: process.env.CHANNEL_NAME || '',
  developerName: process.env.BOT_OWNER_NAME || 'Leonardo',
  displayName: 'ليو',
  language: 'ar',
  copyright: "Leonardo's Projects",
  aiPersona: 'smart-professional-funny',
  aiInterface: 'ليو',
  aiDefaultLanguage: 'ar',
};

module.exports = settings;
