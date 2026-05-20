const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');
const { getUSDBRLRate } = require('./exchangeRateService');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FLIGHT_HOST = 'sky-scrapper.p.rapidapi.com';

const headers = {
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': FLIGHT_HOST,
};

function getRelativeDate(baseDate, days) {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function searchFlights({ origin, destination, days, travelers = 1, startDate }, isRetry = false) {
  const originAirport = typeof origin === 'object' && origin.skyId ? origin : null;
  const destAirport = typeof destination === 'object' && destination.skyId ? destination : null;
  const maskedKey = RAPIDAPI_KEY ? `****${RAPIDAPI_KEY.slice(-4)}` : 'MISSING';

  if (!originAirport || !destAirport) {
    return { available: false, reason: 'Selecione os aeroportos.', data: [] };
  }

  const departureDate = startDate || getRelativeDate(null, 30);
  const returnDate = getRelativeDate(departureDate, parseInt(days));
  const cacheKey = `flights-v1-${originAirport.skyId}-${destAirport.skyId}-${departureDate}-${returnDate}-${travelers}`;

  const tryLabel = isRetry ? 'TENTATIVA 2' : 'TENTATIVA 1';
  console.log(`\n[FLIGHTS REQUEST] (${tryLabel})`);
  console.log(`originSkyId=${originAirport.skyId} | originEntityId=${originAirport.entityId}`);
  console.log(`destinationSkyId=${destAirport.skyId} | destinationEntityId=${destAirport.entityId}`);
  console.log(`date=${departureDate} | returnDate=${returnDate} | travelers=${travelers}`);
  console.log(`key=${maskedKey} | cacheKey=${cacheKey}`);

  // 1. CHECK CACHE (TTL 24h)
  try {
    const cached = db.prepare('SELECT resultado_json, created_at FROM flight_cache WHERE cache_key = ?').get(cacheKey);
    if (cached) {
      const ageHours = (new Date() - new Date(cached.created_at)) / (1000 * 60 * 60);
      if (ageHours < 24) {
        console.log(`[CACHE HIT] tipo=flight_cache | key=${cacheKey}`);
        logApiUsage({
          service_name: 'flights',
          provider: 'Sky Scrapper',
          endpoint: '/api/v1/flights/searchFlights',
          cache_hit: 1,
          request_key: cacheKey
        });
        return { available: true, data: JSON.parse(cached.resultado_json) };
      }
    }
  } catch (err) {
    console.error('[flights] Cache check error:', err.message);
  }

  console.log(`[CACHE MISS] tipo=flight_cache | key=${cacheKey}`);

  // 2. API CALL
  try {
    const response = await axios.get(
      'https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchFlights',
      {
        headers,
        params: {
          originSkyId: originAirport.skyId,
          destinationSkyId: destAirport.skyId,
          originEntityId: originAirport.entityId,
          destinationEntityId: destAirport.entityId,
          date: departureDate,
          returnDate,
          adults: travelers,
          cabinClass: 'economy',
          currency: 'USD',
          market: 'en-US',
          countryCode: 'US',
          sortBy: 'best'
        },
      }
    );

    const apiResponse = response.data;
    const itineraries = apiResponse?.data?.itineraries || [];

    console.log(`[FLIGHTS RESPONSE RAW]`);
    console.log(`status=${apiResponse?.status !== undefined ? apiResponse.status : 'N/A'}`);
    console.log(`totalResults=${apiResponse?.data?.context?.totalResults || 'N/A'}`);
    console.log(`itinerariesLength=${itineraries.length}`);
    console.log(`Object.keys(response.data)=${Object.keys(apiResponse).join(', ')}`);
    console.log(`Object.keys(response.data.data || {})=${Object.keys(apiResponse?.data || {}).join(', ')}`);
    console.log(`Array.isArray(itineraries)=${Array.isArray(itineraries)}`);

    // TRATATIVA DE ERRO DE PARÂMETROS (ENTITY ID OBSOLETO)
    if (apiResponse?.status === false || apiResponse?.message === 'Something went wrong.' || apiResponse?.message?.includes('object Object')) {
      console.log(`[FLIGHTS ERROR RAW]`);
      console.log(JSON.stringify(apiResponse, null, 2));

      if (!isRetry) {
        console.warn(`⚠️  [FLIGHTS] API v1 retornou erro na Tentativa 1.`);
        db.prepare('DELETE FROM airports WHERE skyId IN (?, ?)').run(originAirport.skyId, destAirport.skyId);
        
        return { 
          available: false, 
          needsRefresh: true, 
          staleIds: [originAirport.skyId, destAirport.skyId],
          reason: 'Entity IDs obsoletos detectados.' 
        };
      } else {
        console.error(`❌ [FLIGHTS] API v1 falhou novamente na Tentativa 2. Usando fallback.`);
        return { available: false, reason: 'Não foi possível consultar voos em tempo real. Usamos uma estimativa com base no orçamento.', data: [] };
      }
    }

    if (itineraries.length === 0) {
      return { available: false, reason: 'Nenhum voo encontrado para essa rota.', data: [] };
    }

    console.log(`Primeiro preço raw: ${itineraries[0].price?.raw}`);
    console.log(`Primeiro preço formatted: ${itineraries[0].price?.formatted}`);
    console.log(`Primeira companhia: ${itineraries[0].legs?.[0]?.carriers?.marketing?.[0]?.name}`);

    const { rate, isFallback } = await getUSDBRLRate();

    const offers = itineraries.slice(0, 3).map((item, index) => {
      const priceUSD = item.price?.raw || 0;
      const priceBRL = priceUSD * rate;
      const legs = item.legs || [];
      const outboundLeg = legs[0];
      const returnLeg = legs[1];
      
      const duration = outboundLeg?.durationInMinutes || 0;
      const stops = outboundLeg?.stopCount ?? 0;
      const airline = outboundLeg?.carriers?.marketing?.[0]?.name || 'N/A';
      
      console.log(`[FLIGHT ${index+1}] price=USD ${priceUSD} | duration=${duration} min | stops=${stops} | airline=${airline}`);

      return {
        provider: 'air_scraper',
        priceUSD,
        formattedUSD: item.price?.formatted || `$ ${priceUSD.toFixed(0)}`,
        priceBRL,
        formattedBRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceBRL),
        exchangeRate: rate,
        isExchangeFallback: isFallback,
        currencyOriginal: "USD",
        currencyDefault: "BRL",
        stops,
        duration: duration ? `${Math.floor(duration / 60)}h${duration % 60}min` : null,
        airline,
        originAirport: originAirport.airportName || originAirport.cityName,
        destAirport: destAirport.airportName || destAirport.cityName,
        departureDate,
        returnDate,
      };
    });

    // 3. SAVE CACHE
    db.prepare('INSERT OR REPLACE INTO flight_cache (cache_key, resultado_json, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run(cacheKey, JSON.stringify(offers));

    logApiUsage({
      service_name: 'flights',
      provider: 'Sky Scrapper',
      endpoint: '/api/v1/flights/searchFlights',
      cache_hit: 0,
      success: 1,
      request_key: cacheKey
    });

    return { available: true, data: offers };
  } catch (err) {
    console.error(`[FLIGHTS ERROR RAW] ${err.message}`);
    if (err.response?.data) console.log(JSON.stringify(err.response.data, null, 2));

    logApiUsage({
      service_name: 'flights',
      provider: 'Sky Scrapper',
      endpoint: '/api/v1/flights/searchFlights',
      success: 0,
      error_message: err.message,
      request_key: cacheKey
    });
    return { available: false, reason: 'Não foi possível consultar voos em tempo real. Usamos uma estimativa com base no orçamento.', data: [] };
  }
}

module.exports = { searchFlights };