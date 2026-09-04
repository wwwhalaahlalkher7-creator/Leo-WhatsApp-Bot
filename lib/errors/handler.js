function normalizeError(error) {
  if (!error) return { name: 'Error', message: 'Unknown error', code: undefined, status: undefined };
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    code: error.code,
    status: error.status || error.statusCode || error.response?.status,
  };
}

function logError(scope, error, context = {}) {
  const normalized = normalizeError(error);
  console.error(`[${new Date().toISOString()}] [${scope}]`, {
    ...context,
    name: normalized.name,
    message: normalized.message,
    code: normalized.code,
    status: normalized.status,
    stack: error?.stack,
  });
  return normalized;
}

async function safeSend(sock, chatId, payload, options) {
  if (!sock || !chatId || typeof sock.sendMessage !== 'function') return false;
  try {
    await sock.sendMessage(chatId, payload, options);
    return true;
  } catch (sendError) {
    logError('error-handler.send', sendError, { chatId });
    return false;
  }
}

async function handleCommandError({ sock, chatId, message, error, scope = 'command', userMessage }) {
  const normalized = logError(scope, error, { chatId, command: userMessage, responseSent: Boolean(error?.__leoResponseSent) });
  if (error?.__leoResponseSent) return normalized;
  const status = normalized.status || normalized.code;
  const messageLower = String(normalized.message || '').toLowerCase();
  let text = '❌ تعذر تنفيذ الأمر حاليًا. حاول مرة أخرى بعد قليل.';
  if (status === 429 || /rate.?limit|too many requests|quota|limit exceeded/.test(messageLower)) {
    text = '⏳ تم الوصول إلى حد الاستخدام حاليًا. حاول مرة أخرى بعد قليل.';
  } else if (status === 408 || /timeout|timed out|deadline exceeded/.test(messageLower)) {
    text = '⏳ انتهت مهلة العملية. حاول مرة أخرى بعد قليل.';
  } else if (status >= 500 || /service unavailable|bad gateway|gateway timeout|network|econn|enotfound/.test(messageLower)) {
    text = '🌐 تعذر الوصول إلى الخدمة حاليًا. حاول مرة أخرى لاحقًا.';
  } else if (status === 400 || /invalid|bad request|unsupported/.test(messageLower)) {
    text = '⚠️ البيانات المرسلة غير صالحة أو غير مدعومة. راجع طريقة الاستخدام وحاول مرة أخرى.';
  }
  await safeSend(sock, chatId, { text }, message ? { quoted: message } : undefined);
}

function installProcessHandlers() {
  process.on('unhandledRejection', (reason) => logError('process.unhandledRejection', reason));
  process.on('uncaughtException', (error) => {
    logError('process.uncaughtException', error);
    // Do not exit automatically: the WhatsApp connection layer may recover.
  });
}

module.exports = { normalizeError, logError, safeSend, handleCommandError, installProcessHandlers };
