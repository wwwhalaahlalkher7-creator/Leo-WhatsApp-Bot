'use strict';
const registry = require('./commands/registry-init');
const failures = [];
const seen = new Map();
for (const c of registry.all()) {
  const canonical = String(c.name).trim().toLowerCase();
  for (const a of [...(c.aliases || []), ...(c.localizedAliases || [])]) {
    const n = String(a || '').trim().toLowerCase().replace(/^\./, '');
    if (!n) continue;
    if (n === canonical && (c.aliases || []).some(x => String(x).trim().toLowerCase() === n)) {
      failures.push(`Canonical command repeated in aliases: ${c.name} -> ${a}`);
    }
    const owner = seen.get(n);
    if (owner && owner !== c.name) failures.push(`Alias collision: ${a} -> ${owner}/${c.name}`);
    else seen.set(n, c.name);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Alias cleanup audit PASS: ${registry.all().length} commands, ${seen.size} unique public aliases/names.`);
