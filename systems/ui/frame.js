'use strict';

/**
 * LeoBot unified WhatsApp frame.
 * Keeps the top/bottom borders symmetrical and caps line width for phones.
 */
const MAX_WIDTH = 38;
const MIN_WIDTH = 24;

function displayWidth(value) {
  return Array.from(String(value || '')).reduce((n, ch) => {
    if (/\p{Extended_Pictographic}/u.test(ch)) return n + 2;
    if (/\p{Mark}/u.test(ch)) return n;
    return n + 1;
  }, 0);
}

function clip(value, max) {
  const chars = Array.from(String(value || ''));
  let out = '';
  let width = 0;
  for (const ch of chars) {
    const w = displayWidth(ch);
    if (width + w > max) break;
    out += ch;
    width += w;
  }
  return out.trimEnd();
}

function wrapLine(value, maxWidth) {
  const text = String(value || '').trim();
  if (!text) return [''];
  if (displayWidth(text) <= maxWidth) return [text];
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (displayWidth(candidate) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      if (displayWidth(word) > maxWidth) {
        let rest = word;
        while (displayWidth(rest) > maxWidth) {
          const part = clip(rest, maxWidth);
          lines.push(part);
          rest = rest.slice(Array.from(part).length);
        }
        line = rest;
      } else line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function normalizeTitle(title, width) {
  const maxTitle = Math.max(8, width - 6);
  const value = String(title || '').trim() || 'LeoBot';
  if (displayWidth(value) <= maxTitle) return value;
  return `${clip(value, Math.max(5, maxTitle - 1))}…`;
}

function createLeoFrame(title, content = '', options = {}) {
  let width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(options.width) || MAX_WIDTH));
  let safeTitle = normalizeTitle(title, width);
  const titleWidth = displayWidth(safeTitle);
  const topFixed = titleWidth + 2; // 〔title〕
  const barTotal = Math.max(2, width - 2 - topFixed);
  const leftBars = Math.floor(barTotal / 2);
  const rightBars = barTotal - leftBars;
  const actualWidth = 2 + leftBars + topFixed + rightBars;
  const top = `╮${'━'.repeat(leftBars)}〔 ${safeTitle} 〕${'━'.repeat(rightBars)}╭`;
  const bottom = `╯${'━'.repeat(actualWidth - 2)}╰`;
  const innerWidth = Math.max(8, actualWidth - 2);
  const lines = String(content || '').split(/\r?\n/).flatMap(line => wrapLine(line, innerWidth));
  const body = lines.map(line => `┃${line ? ` ${line}` : ''}`).join('\n');
  return `${top}\n${body}\n${bottom}`;
}

module.exports = { createLeoFrame, displayWidth, wrapLine, MAX_WIDTH };
