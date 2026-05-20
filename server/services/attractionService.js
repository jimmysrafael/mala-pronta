const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');

async function searchAttractions({ destination }) {
  const city = destination.split(',')[0].trim();

  // 1. CHECK CACHE (TTL 48h)
  try {
    const cached = db.prepare('SELECT resultado_json, created_at FROM attraction_cache WHERE city_name = ?').get(city);
    if (cached) {
      const createdAt = new Date(cached.created_at);
      const ageHours = (new Date() - createdAt) / (1000 * 60 * 60);

      if (ageHours < 48) {
        logApiUsage({
          service_name: 'attractions',
          provider: 'OpenTripMap',
          endpoint: '/radius',
          cache_hit: 1,
          request_key: city
        });
        return { available: true, data: JSON.parse(cached.resultado_json) };
      }
    }
  } catch (err) {
    console.error('[attractions] Cache check error:', err.message);
  }

  // 2. API CALL
  try {
    // Passo 1: geocode da cidade
    const geoRes = await axios.get('https://api.opentripmap.com/0.1/en/places/geoname', {
      params: { name: city, apikey: process.env.OPENTRIPMAP_API_KEY },
    });

    const { lat, lon } = geoRes.data;
    if (!lat || !lon) return { available: false, data: [] };

    // Passo 2: buscar atrações no raio de 10km
    const placesRes = await axios.get('https://api.opentripmap.com/0.1/en/places/radius', {
      params: {
        radius: 10000,
        lon,
        lat,
        kinds: 'interesting_places,cultural,natural,architecture,museums,historic',
        limit: 20,
        rate: 3, 
        format: 'json',
        apikey: process.env.OPENTRIPMAP_API_KEY,
      },
    });

    const places = placesRes.data || [];

    // Passo 3: buscar detalhes de até 5 atrações (REDUZIDO DE 10 PARA 5)
    const detailed = await Promise.allSettled(
      places.slice(0, 5).map((p) =>
        axios.get(`https://api.opentripmap.com/0.1/en/places/xid/${p.xid}`, {
          params: { apikey: process.env.OPENTRIPMAP_API_KEY },
        })
      )
    );

    const attractions = detailed
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value.data)
      .filter((a) => a.name)
      .map((a) => ({
        name: a.name,
        kinds: a.kinds?.split(',').slice(0, 3).join(', ') || 'ponto turístico',
        description: a.wikipedia_extracts?.text?.slice(0, 200) || null,
        lat: a.point?.lat,
        lon: a.point?.lon,
        estimatedCost: 0, 
        estimatedDurationMinutes: 90,
      }));

    // 3. SAVE CACHE
    db.prepare('INSERT OR REPLACE INTO attraction_cache (city_name, resultado_json, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run(city, JSON.stringify(attractions));

    logApiUsage({
      service_name: 'attractions',
      provider: 'OpenTripMap',
      endpoint: '/radius',
      cache_hit: 0,
      success: 1,
      request_key: city
    });

    return { available: true, data: attractions };
  } catch (err) {
    logApiUsage({
      service_name: 'attractions',
      provider: 'OpenTripMap',
      endpoint: '/radius',
      success: 0,
      error_message: err.message,
      request_key: city
    });
    return { available: false, data: [] };
  }
}

module.exports = { searchAttractions };
