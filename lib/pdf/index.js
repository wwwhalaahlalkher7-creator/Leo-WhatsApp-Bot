const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const ROOT = path.join(process.cwd(), 'temp', 'pdf');
const ENGINE = path.join(process.cwd(), 'scripts', 'pdf_engine.py');
const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 180000;
const MAX_PAGES = 80;
const ALLOWED = new Set(['pdf','doc','docx','ppt','pptx','xls','xlsx','jpg','jpeg','png','webp','bmp','tif','tiff']);

function safeExt(name = '', mime = '') {
  const fromName = path.extname(String(name)).toLowerCase().replace('.', '');
  if (ALLOWED.has(fromName)) return fromName;
  const map = {
    'application/pdf':'pdf',
    'application/msword':'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx',
    'application/vnd.ms-powerpoint':'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx',
    'application/vnd.ms-excel':'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx',
    'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/bmp':'bmp','image/tiff':'tiff'
  };
  return map[mime] || '';
}

function unwrapMessage(msg) {
  if (!msg) return null;
  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
  return msg;
}

function mediaFromRawMessage(message) {
  const root = unwrapMessage(message?.message || message);
  if (!root) return null;
  for (const type of ['documentMessage','imageMessage']) {
    if (root[type]) return { type, media: root[type], name: root[type].fileName || `input.${safeExt('', root[type].mimetype)}`, mime: root[type].mimetype || '' };
  }
  return null;
}

function quotedMediaFromRawMessage(message) {
  const root = unwrapMessage(message?.message || message);
  const ctx = root?.extendedTextMessage?.contextInfo || root?.imageMessage?.contextInfo || root?.videoMessage?.contextInfo || root?.documentMessage?.contextInfo;
  return mediaFromRawMessage(ctx?.quotedMessage ? { message: ctx.quotedMessage } : null);
}

async function downloadMedia(media) {
  const stream = await downloadContentFromMessage(media.media, media.type === 'imageMessage' ? 'image' : 'document');
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error(`PDF file exceeds ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function makeJobDir() {
  fs.mkdirSync(ROOT, { recursive: true });
  const dir = path.join(ROOT, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runEngine(args, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [ENGINE, ...args], { stdio: ['ignore','pipe','pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('PDF processing timed out')); }, timeout);
    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || out.trim() || `PDF engine exited with code ${code}`));
      // Python dependencies/tools may emit harmless stdout before the final
      // JSON payload. Parse the last JSON-looking line instead of requiring
      // stdout to contain JSON and nothing else.
      const lines = out.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      let parsed = null;
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        try { parsed = JSON.parse(lines[i]); break; } catch (_) {}
      }
      if (!parsed || typeof parsed !== 'object') {
        const detail = (err || out).trim().slice(-1000);
        return reject(new Error(`Invalid PDF engine response${detail ? `: ${detail}` : ''}`));
      }
      resolve(parsed);
    });
  });
}

async function processFilePath({ input, operation }) {
  const stat = fs.statSync(input);
  if (stat.size > MAX_BYTES) throw new Error(`PDF file exceeds ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit`);
  const ext = safeExt(path.basename(input), '');
  if (!ext) throw new Error('Unsupported file type');
  const dir = path.dirname(input);
  try {
    const result = await runEngine(['--operation', operation, '--input', input, '--output-dir', dir, '--max-pages', String(MAX_PAGES)]);
    const output = result.output;
    if (!output || !fs.existsSync(output)) throw new Error('PDF engine produced no output');
    const outStat = fs.statSync(output);
    if (outStat.size > MAX_BYTES * 2) throw new Error('Output file is too large');
    return { ...result, output, dir };
  } catch (e) {
    throw e;
  }
}

async function processBuffer({ buffer, name, mime, operation }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Empty file');
  if (buffer.length > MAX_BYTES) throw new Error(`PDF file exceeds ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit`);
  const ext = safeExt(name, mime);
  if (!ext) throw new Error('Unsupported file type');
  const dir = makeJobDir();
  const input = path.join(dir, `input.${ext}`);
  fs.writeFileSync(input, buffer, { mode: 0o600 });
  const result = await processFilePath({ input, operation });
  return { ...result, input };
}

async function processMultipleFilePaths({ inputs, operation }) {
  if (!Array.isArray(inputs) || !inputs.length) throw new Error('No input files');
  const dir = path.dirname(inputs[0]);
  for (const input of inputs) {
    const stat = fs.statSync(input);
    if (stat.size > MAX_BYTES) throw new Error(`PDF file exceeds ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit`);
    if (safeExt(path.basename(input), '') === 'pdf') throw new Error('Only image files are allowed in a multi-image PDF');
  }
  const args = ['--operation', operation];
  for (const input of inputs) args.push('--input', input);
  args.push('--output-dir', dir, '--max-pages', String(MAX_PAGES));
  const result = await runEngine(args);
  const output = result.output;
  if (!output || !fs.existsSync(output)) throw new Error('PDF engine produced no output');
  const outStat = fs.statSync(output);
  if (outStat.size > MAX_BYTES * 2) throw new Error('Output file is too large');
  return { ...result, output, dir, inputs };
}

function cleanup(dir) {
  if (!dir) return;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function detectOperation(media) {
  const ext = safeExt(media.name, media.mime);
  if (ext === 'pdf') return 'menu';
  if (['doc','docx','ppt','pptx','xls','xlsx'].includes(ext)) return 'office-to-pdf';
  if (['jpg','jpeg','png','webp','bmp','tif','tiff'].includes(ext)) return 'image-to-pdf';
  return null;
}

module.exports = { ROOT, MAX_BYTES, MAX_PAGES, mediaFromRawMessage, quotedMediaFromRawMessage, downloadMedia, processBuffer, processFilePath, processMultipleFilePaths, detectOperation, safeExt, cleanup, makeJobDir };
