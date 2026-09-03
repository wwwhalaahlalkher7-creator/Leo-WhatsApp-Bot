const fs = require('fs');
const path = require('path');

const root = __dirname;
const targets = [
  'lib/providers/legacy-registry.js',
  'commands/legacy-registry.js',
  'commands/registry-phase2d.js',
  'commands/registry-init.js',
];

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'data', 'session'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|cjs|mjs)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(root);

function refsTo(target) {
  const targetAbs = path.join(root, target);
  const targetNoExt = targetAbs.replace(/\.js$/, '');
  return sourceFiles.filter(file => {
    if (path.resolve(file) === path.resolve(targetAbs)) return false;
    const text = fs.readFileSync(file, 'utf8');
    const relativeImport = path.relative(path.dirname(file), targetNoExt).replace(/\\/g, '/');
    const specifiers = [relativeImport, `${relativeImport}.js`];
    return specifiers.some(spec =>
      text.includes(`require('${spec}')`) ||
      text.includes(`require("${spec}")`) ||
      text.includes(`from '${spec}'`) ||
      text.includes(`from "${spec}"`)
    );
  });
}

let failures = 0;
for (const target of targets) {
  const exists = fs.existsSync(path.join(root, target));
  const refs = refsTo(target);
  console.log(`${exists ? 'ACTIVE' : 'REMOVED'} ${target} | runtime_refs=${refs.length}`);
  if (!exists && refs.length) {
    console.error(`Unexpected runtime references remain for removed legacy file: ${target}`);
    for (const ref of refs) console.error(`  - ${path.relative(root, ref)}`);
    failures++;
  }
}

if (failures) process.exit(1);
console.log('Legacy audit PASS');
