const db = require('../db');

function logApiUsage({
  service_name,
  provider,
  endpoint,
  cache_hit = 0,
  success = 1,
  status_code = null,
  error_message = null,
  request_key = null
}) {
  try {
    const insert = db.prepare(`
      INSERT INTO api_usage_logs (
        service_name, provider, endpoint, cache_hit, 
        success, status_code, error_message, request_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      service_name,
      provider,
      endpoint,
      cache_hit ? 1 : 0,
      success ? 1 : 0,
      status_code,
      error_message,
      request_key
    );

    const statusIcon = cache_hit ? '💾 [CACHE HIT]' : (success ? '🌐 [API CALL]' : '❌ [API ERROR]');
    console.log(`${statusIcon} ${service_name} (${provider}): ${endpoint} ${request_key ? `[key: ${request_key}]` : ''}`);
  } catch (err) {
    console.error('Failed to log API usage:', err.message);
  }
}

module.exports = { logApiUsage };
