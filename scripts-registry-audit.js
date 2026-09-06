#!/usr/bin/env node
/**
 * LeoBot Registry Completeness Audit
 *
 * Read-only static audit. Retired command modules are excluded from the
 * active coverage count so cleanup does not create false positives.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const commandsDir = path.join(root, 'commands');
const helperModules = new Set([
  'help', 'registry-init', 'registry-core', 'registry-advanced', 'legacy-registry', 'registry-phase2d',
  'index', 'tagall', 'tagnotadmin'
]);

const moduleAliases = new Map([
  ['botstate', ['bot']],
  ['groupmanage', ['setgdesc', 'setgname', 'setgpp']],
  ['hangman', ['guess', 'hint']],
  ['image-search', ['image']],
  ['img-blur', ['blur']],
  ['tictactoe', ['ttt', 'move', 'surrender']],
  ['viewonce', ['vv']],
  ['media-download', ['تحميل']],
  ['song', ['play']]
]);

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/^\./, '');
}
function isLikelyCommandModule(file) {
  return file.endsWith('.js') && !file.startsWith('.') && !helperModules.has(file.slice(0, -3));
}
function canonicalNamesForModule(moduleName) {
  if (moduleAliases.has(moduleName)) return moduleAliases.get(moduleName);
  return [moduleName];
}

const registryFiles = [
  path.join(root, 'commands', 'registry-init.js'),
  path.join(root, 'commands', 'registry-core.js'),
  path.join(root, 'commands', 'registry-advanced.js'),
];
const registryText = registryFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const names = new Set([...registryText.matchAll(/name\s*:\s*['"]([^'"]+)['"]/g)].map(m => normalize(m[1])));

const duplicateAliases = [];
const aliasOwners = new Map();
for (const match of registryText.matchAll(/(?:aliases|localizedAliases)\s*:\s*\[([^\]]*)\]/g)) {
  for (const a of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
    const key = normalize(a[1]);
    if (!key) continue;
    const owner = match.index;
    if (aliasOwners.has(key) && aliasOwners.get(key) !== owner) duplicateAliases.push(key);
    aliasOwners.set(key, owner);
  }
}

const allFiles = fs.readdirSync(commandsDir).filter(isLikelyCommandModule);
const files = allFiles.map(f => f.slice(0, -3));
const unregistered = [];
for (const file of files) {
  const expected = canonicalNamesForModule(file);
  if (!expected.some(name => names.has(normalize(name)))) unregistered.push(file);
}

const metadataIssues = [];
const registrationChunks = [...registryText.matchAll(/registry\.register\(\{([\s\S]*?)\}\);/g)].map(m => m[1]);
for (const chunk of registrationChunks) {
  const nm = chunk.match(/name\s*:\s*['"]([^'"]+)['"]/);
  const name = nm ? nm[1] : '<unknown>';
  if (!/category\s*:/.test(chunk)) metadataIssues.push(`${name}: missing category`);
  if (!/usage\s*:/.test(chunk)) metadataIssues.push(`${name}: missing usage`);
  if (!/description(?:Key)?\s*:/.test(chunk)) metadataIssues.push(`${name}: missing description metadata`);
  if (!/method(?:Key)?\s*:/.test(chunk)) metadataIssues.push(`${name}: missing method metadata`);
  if (!/execute\s*:/.test(chunk)) metadataIssues.push(`${name}: missing execute handler`);
}

const failures = unregistered.length + duplicateAliases.length + metadataIssues.length;
const report = [
  '# LeoBot Registry Completeness Audit', '',
  `Registered commands: ${names.size}`,
  `Active command modules inspected: ${files.length}`,
  `Unregistered active command modules: ${unregistered.length}`,
  `Duplicate aliases: ${duplicateAliases.length}`,
  `Metadata issues: ${metadataIssues.length}`, '',
  '## Unregistered active modules',
  ...(unregistered.length ? unregistered.map(x => `- ${x}`) : ['- None']), '',
  '## Duplicate aliases',
  ...(duplicateAliases.length ? duplicateAliases.map(x => `- ${x}`) : ['- None']), '',
  '## Metadata issues',
  ...(metadataIssues.length ? metadataIssues.map(x => `- ${x}`) : ['- None']), '',
  '## Result',
  failures ? '❌ Audit found active Registry issues.' : '✅ Registry is complete and consistent.'
].join('\n');
console.log(report);
process.exitCode = failures ? 1 : 0;
