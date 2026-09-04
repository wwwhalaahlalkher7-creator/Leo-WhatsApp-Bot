#!/usr/bin/env node
'use strict';

const registry = require('./commands/registry-init');

const entries = registry.helpEntries();
const issues = [];

for (const entry of entries) {
  const id = entry.command || entry.registryName || '<unknown>';
  if (!entry.command) issues.push(`${id}: missing command name`);
  if (!entry.categoryKey) issues.push(`${id}: missing category`);
  if (!entry.usage) issues.push(`${id}: missing usage`);
  if (!entry.description && !entry.descriptionKey) issues.push(`${id}: missing description`);
  if (!entry.method && !entry.methodKey) issues.push(`${id}: missing method`);
  if (!entry.version) issues.push(`${id}: missing version`);
  if (!entry.developer) issues.push(`${id}: missing developer`);
  if (entry.cost == null) issues.push(`${id}: missing cost`);
}

if (issues.length) {
  console.error(`Help metadata audit failed: ${issues.length} issue(s)`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Help metadata audit passed: ${entries.length} entries have the unified metadata contract.`);
