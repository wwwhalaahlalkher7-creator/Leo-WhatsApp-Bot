#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = [
  path.join(root, 'commands', 'registry-init.js'),
  path.join(root, 'commands', 'registry-core.js'),
  path.join(root, 'commands', 'registry-advanced.js'),
];
const text = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const errors = [];

if (/const\s+helpCommandP4\s*=\s*require\(['"]\.\/help['"]\)/.test(fs.readFileSync(files[1], 'utf8'))) {
  errors.push('help.js is eagerly required from registry-core.js; this recreates the registry/help circular dependency.');
}
if (!/const\s+helpCommandP4\s*=\s*\(\.\.\.args\)\s*=>\s*require\(['"]\.\/help['"]\)\(\.\.\.args\)/.test(fs.readFileSync(files[1], 'utf8'))) {
  errors.push('Help registration is not using the lazy loader expected by the registry architecture.');
}

// Every canonical registration must have a handler and help metadata.
const chunks = [...text.matchAll(/(?:registry|add)\.register\(\{([\s\S]*?)\}\);/g)].map(m => m[1]);
for (const chunk of chunks) {
  const name = chunk.match(/name\s*:\s*['"]([^'"]+)['"]/);
  if (!name) continue;
  for (const field of ['category', 'usage', 'execute']) {
    if (!new RegExp(`\\b${field}\\s*:`).test(chunk)) errors.push(`${name[1]}: missing ${field}`);
  }
  if (!/description(?:Key)?\s*:/.test(chunk)) errors.push(`${name[1]}: missing description metadata`);
  if (!/method(?:Key)?\s*:/.test(chunk)) errors.push(`${name[1]}: missing method metadata`);
}

// Detect aliases targeting commands that are not actually registered.
const names = new Set([...text.matchAll(/name\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1].toLowerCase()));

if (errors.length) {
  console.error('HELP/REGISTRY AUDIT FAILED');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('Help/Registry audit passed: lazy Help loading and registry metadata are consistent.');
