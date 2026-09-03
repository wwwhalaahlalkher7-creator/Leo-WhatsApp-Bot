'use strict';

function normalizeText(value) {
  return String(value || '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*([:؛،,.!?؟])\s*/g, '$1')
    .trim()
    .toLowerCase();
}

function cleanAiPrefix(text) {
  let value = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!value) return '';

  // Legacy gateways sometimes prepend a label, leave a blank line, then the real answer.
  value = value.replace(/^(?:الجواب|جواب|الإجابة|اجابة|الإجابة النهائية|answer|response)\s*[:：-]?\s*\n(?:\s*\n)?/iu, '');
  value = value.replace(/^(?:[?؟])\s*\n(?:\s*\n)?/, '');
  return value.trim();
}

function similarity(a, b) {
  const aa = normalizeText(a).split(/\s+/).filter(Boolean);
  const bb = normalizeText(b).split(/\s+/).filter(Boolean);
  if (!aa.length || !bb.length) return 0;
  const A = new Set(aa);
  const B = new Set(bb);
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection++;
  return intersection / Math.max(A.size, B.size);
}

function dedupeResponse(text) {
  let raw = cleanAiPrefix(text);
  if (!raw) return '';

  const lines = raw.split('\n').map(x => x.trim()).filter(Boolean);
  const uniqueLines = [];
  const seen = new Set();
  for (const line of lines) {
    const key = normalizeText(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueLines.push(line);
  }
  raw = uniqueLines.join('\n').trim();

  const blocks = raw.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const kept = [];
  for (const block of blocks) {
    if (kept.some(prev => similarity(prev, block) >= 0.88)) continue;
    kept.push(block);
  }
  return kept.join('\n\n').trim();
}

function isLikelyDuplicate(a, b, threshold = 0.88) {
  return similarity(a, b) >= threshold;
}

module.exports = { normalizeText, cleanAiPrefix, dedupeResponse, similarity, isLikelyDuplicate };
