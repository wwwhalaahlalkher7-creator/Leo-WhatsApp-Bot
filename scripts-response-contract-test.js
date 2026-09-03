'use strict';
const assert = require('assert');
const response = require('./systems/response');
const { handleCommandError } = require('./lib/errors/handler');

(async () => {
  const sent = [];
  const sock = { async sendMessage(jid, payload, options) { sent.push({ jid, payload, options }); return { ok: true }; } };
  const tracked = response.createResponseTracker(sock);
  await tracked.sock.sendMessage('chat', { text: 'ok' });
  assert.strictEqual(tracked.state.sent, 1);
  assert.strictEqual(tracked.state.failed, 0);

  const error = new Error('handler failed after response');
  error.__leoResponseSent = tracked.state.sent > 0;
  await handleCommandError({ sock, chatId: 'chat', message: null, error, scope: 'test', userMessage: '.test' });
  assert.strictEqual(sent.length, 1, 'must not send duplicate error response');

  const fresh = [];
  const freshSock = { async sendMessage(jid, payload) { fresh.push({ jid, payload }); return {}; } };
  await handleCommandError({ sock: freshSock, chatId: 'chat', message: null, error: new Error('fresh failure'), scope: 'test', userMessage: '.test' });
  assert.strictEqual(fresh.length, 1, 'must send fallback error when no response was sent');

  console.log('✅ Response contract tests passed: tracking, duplicate-response suppression, fallback error response');
})().catch(error => { console.error(error); process.exitCode = 1; });
