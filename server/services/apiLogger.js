const db = require('../db');

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
    console.error('Failed to log API usage:', err.message);
  });

  const statusIcon = cache_hit ? '💾 [CACHE HIT]' : (success ? '🌐 [API CALL]' : '❌ [API ERROR]');
  console.log(`${statusIcon} ${service_name} (${provider}): ${endpoint} ${request_key ? `[key: ${request_key}]` : ''}`);
}

module.exports = { logApiUsage };
