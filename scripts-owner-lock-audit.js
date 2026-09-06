/**
 * Owner-lock audit for the commands explicitly approved by the owner.
 * Fails if any locked command is missing, duplicated, or not marked ownerLocked.
 */
const assert = require('assert');
const registry = require('./lib/command-registry');
const { LOCKED_COMMANDS, normalize } = require('./lib/owner-lock');

const commands = registry.all();
const locked = new Map();

for (const command of commands) {
  if (command.ownerLocked) locked.set(normalize(command.localizedName || command.name), command);
}

const missing = [];
const mismatched = [];
for (const publicName of LOCKED_COMMANDS) {
  const normalized = normalize(publicName);
  const command = commands.find(c => [c.name, c.localizedName, ...(c.localizedAliases || []), ...(c.aliases || [])]
    .some(value => normalize(value) === normalized));
  if (!command) {
    missing.push(publicName);
  } else if (!command.ownerLocked) {
    mismatched.push(`${publicName} -> ${command.name}`);
  }
}

const extraLocked = [...locked.values()]
  .filter(command => !LOCKED_COMMANDS.some(name => [command.name, command.localizedName, ...(command.localizedAliases || []), ...(command.aliases || [])]
    .some(value => normalize(value) === normalize(name))))
  .map(command => command.name);

assert.deepStrictEqual(missing, [], `Missing locked commands: ${missing.join(', ')}`);
assert.deepStrictEqual(mismatched, [], `Commands not marked ownerLocked: ${mismatched.join(', ')}`);
assert.deepStrictEqual(extraLocked, [], `Unexpected ownerLocked commands: ${extraLocked.join(', ')}`);

console.log(`Owner-lock audit passed: ${LOCKED_COMMANDS.length} commands are owner-locked.`);
console.log(`Locked commands: ${LOCKED_COMMANDS.map(c => '.' + c).join(' | ')}`);
