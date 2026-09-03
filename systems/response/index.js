'use strict';

function quotedOptions(message) { return message ? { quoted: message } : undefined; }

function createResponseTracker(sock) {
  const state = { sent: 0, failed: 0 };
  if (!sock || typeof sock.sendMessage !== 'function') return { sock, state };
  const tracked = new Proxy(sock, {
    get(target, property, receiver) {
      if (property !== 'sendMessage') return Reflect.get(target, property, receiver);
      return async (jid, content, options) => {
        try {
          const result = await target.sendMessage(jid, content, options);
          state.sent += 1;
          return result;
        } catch (error) {
          state.failed += 1;
          throw error;
        }
      };
    }
  });
  return { sock: tracked, state };
}

async function text(sock, chatId, value, message, extra = {}) {
  return sock.sendMessage(chatId, { text: String(value ?? ''), ...extra }, quotedOptions(message));
}

async function media(sock, chatId, payload, message, extra = {}) {
  return sock.sendMessage(chatId, { ...payload, ...extra }, quotedOptions(message));
}

async function react(sock, chatId, message, emoji) {
  if (!message?.key) return null;
  return sock.sendMessage(chatId, { react: { text: String(emoji || ''), key: message.key } });
}

function result(ok, data = {}, error = null) { return ok ? { ok: true, ...data } : { ok: false, error, ...data }; }

module.exports = { text, media, react, result, createResponseTracker };
