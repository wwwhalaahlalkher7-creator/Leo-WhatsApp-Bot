'use strict';

function classifyError(error) {
  const status = Number(error?.status ?? error?.response?.status ?? error?.statusCode);
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || error || '').toLowerCase();
  if ([408, 425, 429].includes(status)) return 'transient';
  if (status >= 500 && status <= 599) return 'transient';
  if (['ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET', 'EAI_AGAIN', 'ENETUNREACH', 'ECONNREFUSED', 'ERR_NETWORK', 'ERR_CANCELED', 'ABORT_ERR'].includes(code)) return 'transient';
  if (/timeout|timed out|network error|socket hang up|connection reset|temporar|temporarily unavailable|rate limit|too many requests|service unavailable|bad gateway|gateway timeout/i.test(message)) return 'transient';
  if (status >= 400 && status < 500) return 'permanent';
  if (/invalid|unsupported|not found|forbidden|unauthorized|bad request|no .* found|unusable|empty_result/i.test(message)) return 'permanent';
  return 'unknown';
}

module.exports = { classifyError };
