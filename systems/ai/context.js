'use strict';

const sessions = new Map();
const MAX_MESSAGES = 10;
const MAX_CHARS = 9000;
const TTL_MS = 30 * 60_000;

function keyFor(chatId, userId) {
  return `${chatId || 'unknown'}:${userId || 'unknown'}`;
}

function get(key) {
  const item = sessions.get(key);
  if (!item) return [];
  if (Date.now() - item.updatedAt > TTL_MS) {
    sessions.delete(key);
    return [];
  }
  item.updatedAt = Date.now();
  return item.messages;
}

function push(key, role, content) {
  const text = String(content || '').trim();
  if (!text) return;
  const messages = get(key);
  messages.push({ role, content: text, at: Date.now() });
  while (messages.length > MAX_MESSAGES) messages.shift();
  let total = messages.reduce((sum, x) => sum + x.content.length, 0);
  while (total > MAX_CHARS && messages.length > 2) {
    total -= messages.shift().content.length;
  }
  sessions.set(key, { messages, updatedAt: Date.now() });
}

function addUser(chatId, userId, content) { push(keyFor(chatId, userId), 'user', content); }
function addAssistant(chatId, userId, content) { push(keyFor(chatId, userId), 'assistant', content); }

function format(chatId, userId) {
  return get(keyFor(chatId, userId))
    .map(x => `${x.role === 'assistant' ? 'ليو' : 'المستخدم'}: ${x.content}`)
    .join('\n');
}

function clear(chatId, userId) { sessions.delete(keyFor(chatId, userId)); }
function cleanup() {
  const now = Date.now();
  for (const [key, item] of sessions) if (now - item.updatedAt > TTL_MS) sessions.delete(key);
}

const timer = setInterval(cleanup, Math.min(TTL_MS, 5 * 60_000));
if (timer.unref) timer.unref();

module.exports = { keyFor, get, addUser, addAssistant, format, clear, cleanup, limits: { MAX_MESSAGES, MAX_CHARS, TTL_MS } };
