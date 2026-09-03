const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(process.cwd(), 'data');
const backupDir = path.join(dataDir, '.backups');
const manifestFile = path.join(backupDir, 'manifest.json');

function ensure() { fs.mkdirSync(backupDir, { recursive: true }); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function listDataFiles() {
  ensure();
  return fs.readdirSync(dataDir).filter(n => n.endsWith('.json') && n !== 'manifest.json');
}
function backup(label = 'manual') {
  ensure();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(backupDir, `${stamp}-${label}`);
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const name of listDataFiles()) {
    const src = path.join(dataDir, name);
    const dst = path.join(dir, name);
    fs.copyFileSync(src, dst);
    files.push({ name, sha256: sha256(src), size: fs.statSync(src).size });
  }
  const manifest = { createdAt: new Date().toISOString(), label, files };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const all = fs.readdirSync(backupDir).filter(n => fs.statSync(path.join(backupDir, n)).isDirectory()).sort().reverse();
  const retention = 10;
  for (const old of all.slice(retention)) fs.rmSync(path.join(backupDir, old), { recursive: true, force: true });
  return { directory: dir, manifest };
}
function listBackups() {
  ensure();
  return fs.readdirSync(backupDir).filter(n => fs.statSync(path.join(backupDir, n)).isDirectory()).sort().reverse();
}
function restore(name) {
  ensure();
  const dir = path.resolve(backupDir, name);
  if (!dir.startsWith(path.resolve(backupDir) + path.sep)) throw new Error('Invalid backup path');
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Backup manifest not found');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const item of manifest.files || []) {
    const src = path.join(dir, item.name);
    if (!fs.existsSync(src) || sha256(src) !== item.sha256) throw new Error(`Backup integrity check failed: ${item.name}`);
  }
  for (const item of manifest.files || []) fs.copyFileSync(path.join(dir, item.name), path.join(dataDir, item.name));
  return manifest;
}
module.exports = { backup, listBackups, restore };
