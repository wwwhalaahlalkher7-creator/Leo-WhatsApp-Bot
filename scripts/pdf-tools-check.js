#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const py = path.join(__dirname, 'pdf_engine.py');
if (!fs.existsSync(py)) throw new Error('pdf_engine.py missing');
for (const f of ['commands/pdf.js','lib/pdf/index.js','systems/ai/documents.js']) {
  const r = spawnSync(process.execPath, ['--check', path.join(root,f)], { encoding:'utf8' });
  if (r.status !== 0) { process.stderr.write(r.stderr || 'syntax check failed\n'); process.exit(1); }
}
const probes = ['soffice','pdftoppm','gs','python3'];
const missing = probes.filter(x => spawnSync('sh',['-lc',`command -v ${x}`]).status !== 0);
if (missing.length) { console.error(`❌ Missing PDF runtime tools: ${missing.join(', ')}`); process.exit(1); }
const pyProbe = spawnSync('python3',['-c',"import fitz,docx,openpyxl,pptx,arabic_reshaper,bidi; print('python pdf dependencies ok')"],{encoding:'utf8'});
if (pyProbe.status !== 0) console.warn(`⚠️ Optional RTL shaping dependencies are not installed in this environment. Railway will install them from requirements.txt.\n${pyProbe.stderr || ''}`);
console.log('✅ PDF runtime and JS syntax probe passed.');
