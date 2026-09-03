const axios = require('axios');

function createAbortController(timeout) {
  const controller = new AbortController();
  const ms = Number(timeout);
  const timer = Number.isFinite(ms) && ms > 0
    ? setTimeout(() => controller.abort(), ms)
    : null;
  if (timer?.unref) timer.unref();
  return { controller, clear: () => { if (timer) clearTimeout(timer); } };
}

async function requestJson(url, options = {}) {
  const { timeout = 30000, signal: externalSignal, ...rest } = options;
  const local = externalSignal ? null : createAbortController(timeout);
  const signal = externalSignal || local.controller.signal;
  try {
    const response = await axios({
      url,
      timeout,
      signal,
      method: rest.method || 'GET',
      ...rest,
      validateStatus: status => status >= 200 && status < 500,
    });
    if (response.status >= 400) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    return response.data;
  } finally {
    local?.clear();
  }
}

async function requestBuffer(url, options = {}) {
  const { timeout = 60000, signal: externalSignal, ...rest } = options;
  const local = externalSignal ? null : createAbortController(timeout);
  const signal = externalSignal || local.controller.signal;
  try {
    const response = await axios.get(url, {
      timeout,
      signal,
      responseType: 'arraybuffer',
      validateStatus: status => status >= 200 && status < 500,
      ...rest,
    });
    if (response.status >= 400) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    return Buffer.from(response.data);
  } finally {
    local?.clear();
  }
}

module.exports = { requestJson, requestBuffer, createAbortController };
