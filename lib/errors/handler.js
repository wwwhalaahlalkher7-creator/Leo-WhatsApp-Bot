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
  let text = '❌ حدث خطأ أثناء تنفيذ الأمر.';
  if (status === 429 || normalized.message?.toLowerCase().includes('rate limit')) {
    text = '⏳ تم الوصول إلى حد الاستخدام. حاول مرة أخرى بعد قليل.';
  } else if (status >= 500) {
    text = '⚠️ الخدمة المطلوبة غير متاحة حاليًا. حاول لاحقًا.';
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
