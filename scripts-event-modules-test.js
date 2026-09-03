'use strict';

const fs = require('fs');
const path = require('path');

const expected = [
  ['events/messages.js', 'handleMessages'],
  ['events/group-participants.js', 'handleGroupParticipantUpdate'],
  ['events/status.js', 'handleStatus'],
  ['events/index.js', 'handleMessages'],
];

for (const [file, exportName] of expected) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  if (!source.includes(`module.exports`) || !source.includes(exportName)) {
    throw new Error(`Event module contract missing: ${file} -> ${exportName}`);
  }
}

const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
if (main.includes('async function handleMessages') || main.includes('async function handleGroupParticipantUpdate')) {
  throw new Error('main.js still contains event handler implementations');
}
if (!main.includes("require('./events/messages')") && !main.includes("require('./events')")) {
  throw new Error('main.js is not wired to the event modules');
}

const storage = require('./lib/storage');
for (const method of ['read', 'write', 'writeSync', 'update', 'clear', 'invalidateAll', 'resolve']) {
  if (typeof storage[method] !== 'function') throw new Error(`Storage abstraction missing ${method}`);
}
if (storage.JsonStore == null) throw new Error('Storage abstraction missing JsonStore constructor');

console.log('Event modules + storage abstraction: PASS');
