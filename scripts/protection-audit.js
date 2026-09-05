#!/usr/bin/env node
'use strict';

/**
 * LeoBot Protected Core
 *
 * Existing code/features can be locked after owner approval. The audit is
 * intentionally fail-closed: a protected file changed without an explicit
 * approval will stop the bot from starting.
 *
 * Approve an intentional change with:
 *   LEO_OWNER_APPROVAL=YES node scripts/protection-audit.js --approve
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, '.leo-protection.json');
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'data', 'temp', 'tmp', 'session', 'logs']);
const EXCLUDED_FILES = new Set(['.env', '.leo-protection.json']);
const PROTECTED_EXTENSIONS = new Set(['.js', '.json', '.md', '.py', '.sh', '.txt', '.png', '.webp']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (!EXCLUDED_FILES.has(entry.name) && PROTECTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function currentFiles() { return walk(ROOT).sort((a, b) => rel(a).localeCompare(rel(b))); }

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return null;
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function buildManifest() {
  const files = {};
  for (const file of currentFiles()) files[rel(file)] = hash(file);
  return {
    schema: 1,
    policy: 'protected-core',
    approvedAt: new Date().toISOString(),
    approvedBy: 'owner',
    files,
  };
}

function writeManifest() {
  fs.writeFileSync(MANIFEST, `${JSON.stringify(buildManifest(), null, 2)}\n`, 'utf8');
}

function verify() {
  const manifest = loadManifest();
  if (!manifest?.files || typeof manifest.files !== 'object') {
    throw new Error('Protected Core manifest is missing or invalid. Owner approval is required to initialize it.');
  }
  const failures = [];
  for (const [file, expected] of Object.entries(manifest.files)) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) failures.push(`MISSING ${file}`);
    else {
      const actual = hash(full);
      if (actual !== expected) failures.push(`MODIFIED ${file}`);
    }
  }
  if (failures.length) {
    const err = new Error(`Protected Core blocked startup: ${failures.length} protected file(s) changed.`);
    err.failures = failures;
    return { ok: false, failures, error: err };
  }
  return { ok: true, failures: [] };
}

function approve() {
  if (String(process.env.LEO_OWNER_APPROVAL || '').trim().toUpperCase() !== 'YES') {
    console.error('❌ Owner approval required. Set LEO_OWNER_APPROVAL=YES for an intentional change.');
    process.exitCode = 2;
    return;
  }
  writeManifest();
  const count = Object.keys(loadManifest().files).length;
  console.log(`✅ Protected Core approved and locked: ${count} files.`);
}

if (require.main === module) {
  if (process.argv.includes('--approve')) {
    approve();
  } else {
    const result = verify();
    if (!result.ok) {
      console.error('❌ Protected Core audit failed.');
      for (const item of result.failures) console.error(` - ${item}`);
      console.error('🔐 No changes are accepted until the owner explicitly approves them.');
      process.exit(1);
    }
    console.log(`✅ Protected Core audit passed: ${Object.keys(loadManifest().files).length} files locked.`);
  }
}

module.exports = { verify, approve, writeManifest, buildManifest, MANIFEST };
