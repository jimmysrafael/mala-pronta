const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');

const TRAVELPAYOUTS_TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
const BASE_URL = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';

// Mapear código IATA de companhia para nome legível
const AIRLINE_NAMES = {
  LA: 'LATAM Airlines',
  G3: 'Gol Linhas Aéreas',
  AD: 'Azul Linhas Aéreas',
  AA: 'American Airlines',
  CM: 'Copa Airlines',
  AV: 'Avianca',
  JJ: 'TAM (LATAM)',
  O6: 'Avianca Brasil',
  TP: 'TAP Air Portugal',
  IB: 'Iberia',
  AF: 'Air France',
  KL: 'KLM',
  UA: 'United Airlines',
  DL: 'Delta Air Lines',
};

function getAirlineName(code) {
  return AIRLINE_NAMES[code] || code || 'N/A';
}

async function searchFlightsTravelpayouts({ originSkyId, destSkyId, departureDate, returnDate, travelers = 1 }) {
  const maskedToken = TRAVELPAYOUTS_TOKEN ? `****${TRAVELPAYOUTS_TOKEN.slice(-4)}` : 'MISSING';
  const cacheKey = `tp-flights-${originSkyId}-${destSkyId}-${departureDate}-${returnDate}-${travelers}`;

  console.log(`\n[TRAVELPAYOUTS] Buscando voos: ${originSkyId} -> ${destSkyId}`);
  console.log(`[TRAVELPAYOUTS] Datas: ${departureDate} | Volta: ${returnDate} | Token: ${maskedToken}`);

  if (!TRAVELPAYOUTS_TOKEN) {
    console.warn('[TRAVELPAYOUTS] Token não configurado (TRAVELPAYOUTS_TOKEN). Pulando.');
    return { available: false, source: 'travelpayouts', reason: 'Token não configurado.' };
  }

  // 1. CHECK CACHE (TTL 48h)
  try {
    const cached = db.prepare('SELECT resultado_json, created_at FROM flight_cache WHERE cache_key = ?').get(cacheKey);
    if (cached) {
      const ageHours = (new Date() - new Date(cached.created_at)) / (1000 * 60 * 60);
      if (ageHours < 48) {
        console.log(`[TRAVELPAYOUTS][CACHE HIT] key=${cacheKey}`);
        logApiUsage({
          service_name: 'flights_travelpayouts',
          provider: 'Travelpayouts',
          endpoint: '/aviasales/v3/prices_for_dates',
          cache_hit: 1,
          request_key: cacheKey,
        });
        return { available: true, source: 'travelpayouts_cache', data: JSON.parse(cached.resultado_json) };
      }
    }
  } catch (err) {
    console.error('[TRAVELPAYOUTS] Erro ao checar cache:', err.message);
  }

  console.log(`[TRAVELPAYOUTS][CACHE MISS] key=${cacheKey}`);

  // 2. CHAMADA À API
  try {
    const params = {
      origin: originSkyId,
      destination: destSkyId,
      departure_at: departureDate,
      currency: 'brl',
      token: TRAVELPAYOUTS_TOKEN,
      direct: false,
      limit: 5,
      sorting: 'price',
    };

    // Incluir data de volta apenas se fornecida (voo de ida e volta)
    if (returnDate) {
      params.return_at = returnDate;
    }

    const response = await axios.get(BASE_URL, {
      params,
      headers: { 'Accept-Encoding': 'gzip, deflate' },
      timeout: 8000,
    });

    const result = response.data;
    const tickets = result?.data || [];

    console.log(`[TRAVELPAYOUTS] success=${result?.success} | tickets encontrados=${tickets.length}`);

    if (!result?.success || tickets.length === 0) {
      console.warn('[TRAVELPAYOUTS] Nenhum ticket encontrado para essa rota/data.');
      logApiUsage({
        service_name: 'flights_travelpayouts',
        provider: 'Travelpayouts',
        endpoint: '/aviasales/v3/prices_for_dates',
        cache_hit: 0,
        success: 0,
        error_message: 'Nenhum resultado retornado.',
        request_key: cacheKey,
      });
      return { available: false, source: 'travelpayouts', reason: 'Nenhum voo encontrado para essa rota nas próximas semanas.' };
    }

    // 3. MAPEAR para o formato padrão do MalaPronta
    const offers = tickets.slice(0, 3).map((ticket, index) => {
      const priceBRL = ticket.price || 0;
      const airline = ticket.airline || 'N/A';
      const stops = ticket.transfers ?? 0;
      const departureDateActual = ticket.departure_at ? ticket.departure_at.split('T')[0] : departureDate;
      const returnDateActual = ticket.return_at ? ticket.return_at.split('T')[0] : returnDate;
      const expiresAt = ticket.expires_at || null;

      console.log(`[TRAVELPAYOUTS][FLIGHT ${index + 1}] price=BRL ${priceBRL} | airline=${airline} | stops=${stops} | expires=${expiresAt}`);

      return {
        provider: 'travelpayouts',
        priceBRL,
        formattedBRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceBRL),
        priceUSD: null,
        formattedUSD: null,
        exchangeRate: null,
        isExchangeFallback: false,
        currencyOriginal: 'BRL',
        currencyDefault: 'BRL',
        stops,
        duration: null,
        airline: getAirlineName(airline),
        airlineCode: airline,
        originAirport: originSkyId,
        destAirport: destSkyId,
        departureDate: departureDateActual,
        returnDate: returnDateActual,
        expiresAt,
        link: ticket.link ? `https://www.aviasales.com${ticket.link}` : null,
      };
    });

    // 4. SALVAR CACHE (48h)
    db.prepare('INSERT OR REPLACE INTO flight_cache (cache_key, resultado_json, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run(cacheKey, JSON.stringify(offers));

    logApiUsage({
      service_name: 'flights_travelpayouts',
      provider: 'Travelpayouts',
      endpoint: '/aviasales/v3/prices_for_dates',
      cache_hit: 0,
      success: 1,
      request_key: cacheKey,
    });

    console.log(`[TRAVELPAYOUTS] ✅ ${offers.length} oferta(s) salvas no cache.`);
    return { available: true, source: 'travelpayouts', data: offers };

  } catch (err) {
    const status = err.response?.status;
    const errorMsg = err.message;
    console.error(`[TRAVELPAYOUTS] ❌ Erro: ${errorMsg} | status=${status}`);
    if (err.response?.data) console.error('[TRAVELPAYOUTS] Resposta:', JSON.stringify(err.response.data));

    logApiUsage({
      service_name: 'flights_travelpayouts',
      provider: 'Travelpayouts',
      endpoint: '/aviasales/v3/prices_for_dates',
      cache_hit: 0,
      success: 0,
      error_message: errorMsg,
      request_key: cacheKey,
    });

    return { available: false, source: 'travelpayouts', reason: `Erro ao consultar Travelpayouts: ${errorMsg}` };
  }
}

module.exports = { searchFlightsTravelpayouts };
