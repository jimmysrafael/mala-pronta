const isProduction = process.env.NODE_ENV === 'production';
const debugEnabled = process.env.DEBUG === 'true' || process.env.DEBUG_LOGS === 'true';

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

  console.error(message, err);
}

module.exports = {
  debug,
  info,
  warn,
  error,
};
