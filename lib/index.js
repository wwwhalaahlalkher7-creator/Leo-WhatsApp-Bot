const store = require('./storage');

const DEFAULTS = {
  antibadword: {}, antilink: {}, antitag: {}, welcome: {}, goodbye: {},
  chatbot: {}, warnings: {}, sudo: []
};

function loadUserGroupData() {
  return { ...DEFAULTS, ...store.read('userGroupData.json', DEFAULTS) };
}

async function saveUserGroupData(data) { await store.write('userGroupData.json', data); return true; }

async function updateSection(section, updater) {
  const data = loadUserGroupData();
  if (!data[section] || typeof data[section] !== 'object') data[section] = {};
  const result = await updater(data[section], data);
  if (result !== undefined) data[section] = result;
  await saveUserGroupData(data);
  return data;
}

async function setAntilink(groupId, type, action) { await updateSection('antilink', s => { s[groupId] = { enabled: type === 'on', action: action || 'delete' }; }); return true; }
async function getAntilink(groupId, type) { const d=loadUserGroupData(); return type === 'on' ? d.antilink?.[groupId] || null : null; }
async function removeAntilink(groupId) { await updateSection('antilink', s => { delete s[groupId]; }); return true; }

async function setAntitag(groupId, type, action) { await updateSection('antitag', s => { s[groupId] = { enabled: type === 'on', action: action || 'delete' }; }); return true; }
async function getAntitag(groupId, type) { const d=loadUserGroupData(); return type === 'on' ? d.antitag?.[groupId] || null : null; }
async function removeAntitag(groupId) { await updateSection('antitag', s => { delete s[groupId]; }); return true; }

async function incrementWarningCount(groupId, userId) {
  const d=loadUserGroupData(); d.warnings ||= {}; d.warnings[groupId] ||= {}; d.warnings[groupId][userId] = (d.warnings[groupId][userId] || 0) + 1; await saveUserGroupData(d); return d.warnings[groupId][userId];
}
async function resetWarningCount(groupId, userId) { const d=loadUserGroupData(); if(d.warnings?.[groupId]?.[userId] !== undefined) d.warnings[groupId][userId]=0; await saveUserGroupData(d); return true; }

async function isSudo(userId) { return loadUserGroupData().sudo?.includes(userId) || false; }
async function addSudo(userJid) { const d=loadUserGroupData(); d.sudo ||= []; if(!d.sudo.includes(userJid)) d.sudo.push(userJid); await saveUserGroupData(d); return true; }
async function removeSudo(userJid) { const d=loadUserGroupData(); d.sudo = (d.sudo || []).filter(x => x !== userJid); await saveUserGroupData(d); return true; }
async function getSudoList() { return Array.isArray(loadUserGroupData().sudo) ? loadUserGroupData().sudo : []; }

async function addWelcome(jid, enabled, message) { await updateSection('welcome', s => { s[jid] = { enabled, message: message || '╔═👋 ترحيب ═╗\n║ 👤 العضو: {user}\n║ 🏠 المجموعة: {group}\n║ 📝 {description}\n╚════════════╝' }; }); return true; }
async function delWelcome(jid) { await updateSection('welcome', s => { delete s[jid]; }); return true; }
async function isWelcomeOn(jid) { return !!loadUserGroupData().welcome?.[jid]?.enabled; }
async function getWelcome(jid) { return loadUserGroupData().welcome?.[jid]?.message || null; }

async function addGoodbye(jid, enabled, message) { await updateSection('goodbye', s => { s[jid] = { enabled, message: message || '👋 مع السلامة يا {user}!\nسنفتقدك في المجموعة.' }; }); return true; }
async function delGoodBye(jid) { await updateSection('goodbye', s => { delete s[jid]; }); return true; }
async function isGoodByeOn(jid) { return !!loadUserGroupData().goodbye?.[jid]?.enabled; }
async function getGoodbye(jid) { return loadUserGroupData().goodbye?.[jid]?.message || null; }

async function setAntiBadword(groupId, type, action) { await updateSection('antibadword', s => { s[groupId] = { enabled: type === 'on', action: action || 'delete' }; }); return true; }
async function getAntiBadword(groupId, type) { const d=loadUserGroupData(); return type === 'on' ? d.antibadword?.[groupId] || null : null; }
async function removeAntiBadword(groupId) { await updateSection('antibadword', s => { delete s[groupId]; }); return true; }

async function setChatbot(groupId, enabled) { await updateSection('chatbot', s => { s[groupId] = { enabled }; }); return true; }
async function getChatbot(groupId) { return loadUserGroupData().chatbot?.[groupId] || null; }
async function removeChatbot(groupId) { await updateSection('chatbot', s => { delete s[groupId]; }); return true; }

module.exports = { setAntilink,getAntilink,removeAntilink,setAntitag,getAntitag,removeAntitag,incrementWarningCount,resetWarningCount,isSudo,addSudo,removeSudo,getSudoList,addWelcome,delWelcome,isWelcomeOn,getWelcome,addGoodbye,delGoodBye,isGoodByeOn,getGoodbye,setAntiBadword,getAntiBadword,removeAntiBadword,setChatbot,getChatbot,removeChatbot };
