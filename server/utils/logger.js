const isProduction = process.env.NODE_ENV === 'production';
const debugEnabled = process.env.DEBUG === 'true' || process.env.DEBUG_LOGS === 'true';

function redactHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (/authorization|api[-_]?key|x-rapidapi-key|cookie/i.test(key)) {
        return [key, '[REDACTED]'];
      }
      return [key, value];
    })
  );
}

function summarizeAxiosError(err) {
  if (!err?.isAxiosError) {
    return err;
  }

  return {
    name: err.name,
    message: err.message,
    code: err.code,
    status: err.response?.status || err.status || null,
    responseData: err.response?.data || null,
    responseHeaders: err.response?.headers ? redactHeaders(err.response.headers) : null,
    request: {
      method: err.config?.method,
      url: err.config?.url,
      params: err.config?.params,
      headers: err.config?.headers ? redactHeaders(err.config.headers) : null,
    },
  };
}

function debug(...args) {
  if (!isProduction || debugEnabled) {
    console.log(...args);
  }
}

function info(...args) {
  if (!isProduction || debugEnabled) {
    console.log(...args);
  }
}

function warn(...args) {
  console.warn(...args);
}

function error(message, err) {
  if (!err) {
    console.error(message);
    return;
  }

  if (isProduction && !debugEnabled) {
    console.error(message, err.message || err);
    return;
  }

  console.error(message, summarizeAxiosError(err));
}

module.exports = {
  debug,
  info,
  warn,
  error,
};
