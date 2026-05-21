const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

async function getWeatherInsights({ destination }) {
  const cityRaw = typeof destination === 'object'
    ? (destination.cityName || destination.airportName || '')
    : destination;
  const city = cityRaw.split(',')[0].trim();

  try {
    const cached = await db.one('SELECT resultado_json, created_at FROM weather_cache WHERE city_name = ?', [city]);
    if (cached) {
      const createdAt = new Date(cached.created_at);
      const now = new Date();
      const ageHours = (now - createdAt) / (1000 * 60 * 60);

      if (ageHours < 6) {
        console.log(`[CACHE HIT] tipo=weather_cache | key=${city}`);
        logApiUsage({
          service_name: 'weather',
          provider: 'Open-Meteo',
          endpoint: '/forecast',
          cache_hit: 1,
          request_key: city,
        });
        return { available: true, data: JSON.parse(cached.resultado_json) };
      }
    }
  } catch (err) {
    console.error('[weather] Cache check error:', err.message);
  }

  console.log(`[CACHE MISS] tipo=weather_cache | key=${city}`);

  try {
    const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const attempts = [
      city,
      city.replace(/^Ilha de\s+/i, ''),
      normalize(city.replace(/^Ilha de\s+/i, '')),
      `${normalize(city.replace(/^Ilha de\s+/i, ''))}, Colombia`,
    ];

    let loc = null;
    let finalQuery = '';

    for (const q of attempts) {
      if (!q) continue;
      console.log(`[WEATHER TRY] query=${q}`);
      try {
        const geoRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
          params: { name: q, count: 1, language: 'pt', format: 'json' },
          timeout: 3000,
        });
        loc = geoRes.data.results?.[0];
        if (loc) {
          finalQuery = q;
          break;
        }
      } catch (e) {
        console.warn(`[WEATHER TRY FAIL] ${q}: ${e.message}`);
      }
    }

    if (!loc) {
      console.log(`[WEATHER FAIL] Não foi possível encontrar coordenadas para: ${city}`);
      logApiUsage({
        service_name: 'weather',
        provider: 'Open-Meteo',
        endpoint: '/geocoding',
        success: 0,
        error_message: 'City not found',
        request_key: city,
      });
      return { available: false, data: null };
    }

    const { latitude, longitude } = loc;
    console.log(`[WEATHER SUCCESS] lat=${latitude} lon=${longitude} (found via: ${finalQuery})`);

    const forecastRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude,
        longitude,
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
        timezone: 'auto',
        forecast_days: 16,
      },
    });

    const daily = forecastRes.data.daily;
    const maxTemps = daily?.temperature_2m_max || [];
    const minTemps = daily?.temperature_2m_min || [];
    const rains = daily?.precipitation_sum || [];

    const avgTemp = maxTemps.length > 0
      ? Math.round((maxTemps.reduce((a, b) => a + b, 0) + minTemps.reduce((a, b) => a + b, 0)) / (maxTemps.length + minTemps.length))
      : null;

    const totalRain = rains.length > 0
      ? Math.round(rains.reduce((a, b) => a + (b || 0), 0))
      : null;

    const isNorthernHemisphere = latitude > 0;
    const bestMonths = isNorthernHemisphere
      ? ['Abril', 'Maio', 'Setembro', 'Outubro']
      : ['Março', 'Abril', 'Agosto', 'Setembro'];

    const recommendation = avgTemp !== null
      ? `Temperatura média esperada de ${avgTemp}°C nos próximos dias. ${totalRain > 40 ? 'Período com possibilidade de chuvas — leve um guarda-chuva.' : 'Clima favorável para passeios.'}`
      : 'Verifique a previsão do tempo próximo à data da viagem.';

    const result = {
      currentMonth: MONTH_NAMES[new Date().getMonth()],
      currentTemp: avgTemp,
      currentRain: totalRain,
      bestMonths,
      recommendation,
    };

    await db.run(
      'INSERT INTO weather_cache (city_name, resultado_json, created_at) VALUES (?, ?, NOW()) ON CONFLICT (city_name) DO UPDATE SET resultado_json = EXCLUDED.resultado_json, created_at = NOW()',
      [city, JSON.stringify(result)]
    );

    logApiUsage({
      service_name: 'weather',
      provider: 'Open-Meteo',
      endpoint: '/forecast',
      cache_hit: 0,
      success: 1,
      request_key: city,
    });

    return { available: true, data: result };
  } catch (err) {
    logApiUsage({
      service_name: 'weather',
      provider: 'Open-Meteo',
      endpoint: '/forecast',
      success: 0,
      error_message: err.message,
      request_key: city,
    });
    return { available: false, data: null };
  }
}

module.exports = { getWeatherInsights };
