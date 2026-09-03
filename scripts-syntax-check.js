#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'data', 'temp', 'tmp', 'session'].includes(entry)) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) collect(full, out);
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = collect(process.cwd());
const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push({ file, error: result.stderr || result.stdout });
}
if (failures.length) {
  console.error(`❌ Syntax failures: ${failures.length}/${files.length}`);
  for (const failure of failures) console.error(`\n${failure.file}\n${failure.error}`);
  process.exit(1);
}
console.log(`✅ JavaScript syntax check passed: ${files.length} files`);
