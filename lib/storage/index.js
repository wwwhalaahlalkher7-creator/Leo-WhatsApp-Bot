'use strict';

// Domain JSON storage facade. Keep Baileys' message/contact cache in
// lightweight_store.js; this facade is the single API for bot-owned JSON data.
const store = require('./json-store');

module.exports = {
  read: store.read.bind(store),
  write: store.write.bind(store),
  writeSync: store.writeSync.bind(store),
  update: store.update.bind(store),
  clear: store.clear.bind(store),
  invalidateAll: store.invalidateAll.bind(store),
  resolve: store.resolve.bind(store),
  clone: store.clone.bind(store),
  JsonStore: store.JsonStore,
};
