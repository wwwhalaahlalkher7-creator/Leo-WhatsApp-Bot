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
  // Bottom border is fixed at 20 bars. The top border is sized from the
  // title itself, so short titles stay compact instead of stretching to 38.
  const safeTitle = String(title || '').trim() || 'LeoBot';
  const titleWidth = displayWidth(safeTitle);
  const availableBars = Math.max(0, 20 - titleWidth - 4);
  const leftBars = Math.max(2, Math.floor(availableBars / 2));
  const rightBars = Math.max(2, availableBars - leftBars);
  const top = `╮${'━'.repeat(leftBars)}〔 ${safeTitle} 〕${'━'.repeat(rightBars)}╭`;
  const bottom = `╯${'━'.repeat(20)}╰`;
  const innerWidth = Math.max(8, 34);
  const lines = String(content || '').split(/\r?\n/).flatMap(line => wrapLine(line, innerWidth));
  const body = lines.map(line => `┃${line ? ` ${line}` : ''}`).join('\n');
  return `${top}\n${body}\n${bottom}`;
}

module.exports = { createLeoFrame, displayWidth, wrapLine, MAX_WIDTH };
