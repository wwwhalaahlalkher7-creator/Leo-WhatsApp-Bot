const store = require('./storage');
function load(){ return store.read('antilinkSettings.json', {}); }
async function save(v){ await store.write('antilinkSettings.json', v); }
function setAntilinkSetting(groupId,type){ const s=load(); s[groupId]=type; return save(s); }
function getAntilinkSetting(groupId){ return load()[groupId] || 'off'; }
module.exports={setAntilinkSetting,getAntilinkSetting};
