const db = require('../db');
const logger = require('../utils/logger');

function logApiUsage({
  service_name,
  provider,
  endpoint,
  cache_hit = 0,
  success = 1,
  status_code = null,
  error_message = null,
  request_key = null,
}) {
  void db.run(
    `
      INSERT INTO api_usage_logs (
        service_name, provider, endpoint, cache_hit,
        success, status_code, error_message, request_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      service_name,
      provider,
      endpoint,
      cache_hit ? 1 : 0,
      success ? 1 : 0,
      status_code,
      error_message,
      request_key,
    ]
  ).catch((err) => {
    logger.error('Failed to log API usage:', err);
  });

  const statusIcon = cache_hit ? '💾 [CACHE HIT]' : (success ? '🌐 [API CALL]' : '❌ [API ERROR]');
  logger.info(`${statusIcon} ${service_name} (${provider}): ${endpoint}`);
  if (request_key) {
    logger.debug(`[API USAGE KEY] ${service_name}: ${request_key}`);
  }
}

module.exports = { logApiUsage };
