const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');
const { getUSDBRLRate } = require('./exchangeRateService');
const logger = require('../utils/logger');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FLIGHT_HOST = 'sky-scrapper.p.rapidapi.com';

const headers = {
  'Content-Type': 'application/json',
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': FLIGHT_HOST,
};

function getRelativeDate(baseDate, days) {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function searchFlights({ origin, destination, days, travelers = 1, startDate, date, returnDate: explicitReturnDate }, isRetry = false) {
  const originAirport = typeof origin === 'object' && origin.skyId ? origin : null;
  const destAirport = typeof destination === 'object' && destination.skyId ? destination : null;
  const maskedKey = RAPIDAPI_KEY ? `****${RAPIDAPI_KEY.slice(-4)}` : 'MISSING';

  if (!originAirport || !destAirport) {
    return { available: false, reason: 'Selecione os aeroportos.', data: [] };
  }

  const departureDate = date || startDate || getRelativeDate(null, 30);
  const returnDate = explicitReturnDate || getRelativeDate(departureDate, parseInt(days));
  const cacheKey = `flights-v1-${originAirport.skyId}-${destAirport.skyId}-${departureDate}-${returnDate}-${travelers}`;

  const tryLabel = isRetry ? 'TENTATIVA 2' : 'TENTATIVA 1';
  logger.debug(`[FLIGHTS REQUEST] (${tryLabel})`);
  logger.debug(`originSkyId=${originAirport.skyId} | originEntityId=${originAirport.entityId}`);
  logger.debug(`destinationSkyId=${destAirport.skyId} | destinationEntityId=${destAirport.entityId}`);
  logger.debug(`date=${departureDate} | returnDate=${returnDate} | travelers=${travelers}`);
  logger.debug(`key=${maskedKey} | cacheKey=${cacheKey}`);

  try {
    const cached = await db.one('SELECT resultado_json, created_at FROM flight_cache WHERE cache_key = ?', [cacheKey]);
    if (cached) {
      const ageHours = (new Date() - new Date(cached.created_at)) / (1000 * 60 * 60);
      if (ageHours < 24) {
        logger.debug(`[CACHE HIT] tipo=flight_cache | key=${cacheKey}`);
        logApiUsage({
          service_name: 'flights',
          provider: 'Sky Scrapper',
          endpoint: '/api/v1/flights/searchFlights',
          cache_hit: 1,
          request_key: cacheKey,
        });
        return { available: true, data: JSON.parse(cached.resultado_json) };
      }
    }
  } catch (err) {
    logger.error('[flights] Cache check error:', err);
  }

  logger.debug(`[CACHE MISS] tipo=flight_cache | key=${cacheKey}`);

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
          cabinClass: 'economy',
          adults: travelers,
          sortBy: 'best',
          currency: 'USD',
          market: 'en-US',
          countryCode: 'US',
        },
      }
    );

    const apiResponse = response.data;
    const itineraries = apiResponse?.data?.itineraries || [];

    logger.debug('[FLIGHTS RESPONSE]');
    logger.debug(`status=${apiResponse?.status !== undefined ? apiResponse.status : 'N/A'}`);
    logger.debug(`totalResults=${apiResponse?.data?.context?.totalResults || 'N/A'}`);
    logger.debug(`itinerariesLength=${itineraries.length}`);
    logger.debug(`Object.keys(response.data)=${Object.keys(apiResponse).join(', ')}`);
    logger.debug(`Object.keys(response.data.data || {})=${Object.keys(apiResponse?.data || {}).join(', ')}`);
    logger.debug(`Array.isArray(itineraries)=${Array.isArray(itineraries)}`);

    if (apiResponse?.status === false || apiResponse?.message === 'Something went wrong.' || apiResponse?.message?.includes('object Object')) {
      logger.debug('[FLIGHTS ERROR RAW]');
      logger.debug(JSON.stringify(apiResponse, null, 2));

      if (!isRetry) {
        logger.warn('[FLIGHTS] API v1 retornou erro na Tentativa 1.');
        await db.run('DELETE FROM airports WHERE "skyId" IN (?, ?)', [originAirport.skyId, destAirport.skyId]);

        return {
          available: false,
          needsRefresh: true,
          staleIds: [originAirport.skyId, destAirport.skyId],
          reason: 'Entity IDs obsoletos detectados.',
        };
      }

      logger.error('[FLIGHTS] API v1 falhou novamente na Tentativa 2. Usando fallback.');
      return { available: false, reason: 'Não foi possível consultar voos em tempo real. Usamos uma estimativa com base no orçamento.', data: [] };
    }

    if (itineraries.length === 0) {
      return { available: false, reason: 'Nenhum voo encontrado para essa rota.', data: [] };
    }

    logger.debug(`Primeiro preço raw: ${itineraries[0].price?.raw}`);
    logger.debug(`Primeiro preço formatted: ${itineraries[0].price?.formatted}`);
    logger.debug(`Primeira companhia: ${itineraries[0].legs?.[0]?.carriers?.marketing?.[0]?.name}`);

    const { rate, isFallback } = await getUSDBRLRate();

    const offers = itineraries.slice(0, 3).map((item, index) => {
      const priceUSD = item.price?.raw || 0;
      const priceBRL = priceUSD * rate;
      const legs = item.legs || [];
      const outboundLeg = legs[0];
      const duration = outboundLeg?.durationInMinutes || 0;
      const stops = outboundLeg?.stopCount ?? 0;
      const airline = outboundLeg?.carriers?.marketing?.[0]?.name || 'N/A';

      logger.debug(`[FLIGHT ${index + 1}] price=USD ${priceUSD} | duration=${duration} min | stops=${stops} | airline=${airline}`);

      return {
        provider: 'air_scraper',
        priceUSD,
        formattedUSD: item.price?.formatted || `$ ${priceUSD.toFixed(0)}`,
        priceBRL,
        formattedBRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceBRL),
        exchangeRate: rate,
        isExchangeFallback: isFallback,
        currencyOriginal: 'USD',
        currencyDefault: 'BRL',
        stops,
        duration: duration ? `${Math.floor(duration / 60)}h${duration % 60}min` : null,
        airline,
        originAirport: originAirport.airportName || originAirport.cityName,
        destAirport: destAirport.airportName || destAirport.cityName,
        departureDate,
        returnDate,
      };
    });

    await db.run(
      'INSERT INTO flight_cache (cache_key, resultado_json, created_at) VALUES (?, ?, NOW()) ON CONFLICT (cache_key) DO UPDATE SET resultado_json = EXCLUDED.resultado_json, created_at = NOW()',
      [cacheKey, JSON.stringify(offers)]
    );

    logApiUsage({
      service_name: 'flights',
      provider: 'Sky Scrapper',
      endpoint: '/api/v1/flights/searchFlights',
      cache_hit: 0,
      success: 1,
      request_key: cacheKey,
    });

    return { available: true, data: offers };
  } catch (err) {
    logger.error('[FLIGHTS ERROR]', err);
    if (err.response?.data) logger.debug(JSON.stringify(err.response.data, null, 2));

    logApiUsage({
      service_name: 'flights',
      provider: 'Sky Scrapper',
      endpoint: '/api/v1/flights/searchFlights',
      success: 0,
      error_message: err.message,
      request_key: cacheKey,
    });
    return { available: false, reason: 'Não foi possível consultar voos em tempo real. Usamos uma estimativa com base no orçamento.', data: [] };
  }
}

module.exports = { searchFlights };
