'use strict';
const { normalizeContract } = require('./contract');

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/^\./, '').replace(/ـ/g, '');
}
function tokenize(text) {
  const value = String(text ?? '').trim();
  if (!value) return [];
  return value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(v => v.replace(/^['"]|['"]$/g, '')) || [];
}
function parse(text, knownNames = []) {
  const raw = String(text ?? '').trim();
  const withoutPrefix = raw.replace(/^\./, '').trim();
  const tokens = tokenize(withoutPrefix);
  if (!tokens.length) return { isCommand: false, name: '', args: [], raw, tokens: [] };
  const names = [...new Set(knownNames.map(normalize).filter(Boolean))].sort((a, b) => b.length - a.length);
  const lower = withoutPrefix.toLowerCase();
  for (const name of names) {
    if (lower === name || lower.startsWith(`${name} `)) {
      const rest = withoutPrefix.slice(name.length).trim();
      return { isCommand: true, name, args: tokenize(rest), raw, tokens };
    }
  }
  return { isCommand: true, name: normalize(tokens[0]), args: tokens.slice(1), raw, tokens };
}
function define(definition) {
  if (!definition || !definition.name || typeof definition.execute !== 'function') throw new Error('Invalid command definition');
  return Object.freeze({ ...definition, name: normalize(definition.name), aliases: Object.freeze([...(definition.aliases || [])].map(normalize).filter(Boolean)), contract: normalizeContract(definition) });
}
module.exports = { normalize, tokenize, parse, define };
