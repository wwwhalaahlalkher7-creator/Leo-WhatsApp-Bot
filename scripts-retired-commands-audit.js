#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { RETIRED_COMMANDS } = require('./lib/retired-commands');

const files = [
  path.join(__dirname, 'commands', 'registry-init.js'),
  path.join(__dirname, 'commands', 'registry-core.js'),
  path.join(__dirname, 'commands', 'registry-advanced.js'),
];
const text = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const found = [];
for (const name of RETIRED_COMMANDS) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\bname\s*:\s*['\"]${escaped}['\"]`, 'i'),
    new RegExp(`\baliases\s*:\s*\[[^\]]*['\"]${escaped}['\"]`, 'i'),
    new RegExp(`\blocalizedAliases\s*:\s*\[[^\]]*['\"]${escaped}['\"]`, 'i'),
    new RegExp(`\blocalizedName\s*:\s*['\"]${escaped}['\"]`, 'i'),
  ];
  if (patterns.some(re => re.test(text))) found.push(name);
}
if (found.length) {
  console.error('RETIRED COMMAND AUDIT FAILED');
  found.forEach(x => console.error(' - ' + x));
  process.exit(1);
}
console.log(`Retired command audit passed: ${RETIRED_COMMANDS.size} retired names protected.`);
