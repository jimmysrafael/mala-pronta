const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');
const { getUSDBRLRate } = require('./exchangeRateService');
const logger = require('../utils/logger');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FLIGHT_HOST = 'sky-scrapper.p.rapidapi.com';
const FLIGHT_CURRENCY = process.env.FLIGHT_CURRENCY || 'BRL';
const FLIGHT_MARKET = process.env.FLIGHT_MARKET || 'pt-BR';
const FLIGHT_COUNTRY_CODE = process.env.FLIGHT_COUNTRY_CODE || 'BR';

const FLIGHT_ENDPOINTS = [
  { label: 'v2', path: '/api/v2/flights/searchFlights' },
  { label: 'v1', path: '/api/v1/flights/searchFlights' },
];

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

function buildFlightParams({ originAirport, destAirport, departureDate, returnDate, travelers }) {
  return {
    originSkyId: originAirport.skyId,
    destinationSkyId: destAirport.skyId,
    originEntityId: originAirport.entityId,
    destinationEntityId: destAirport.entityId,
    date: departureDate,
    returnDate,
    cabinClass: 'economy',
    adults: travelers,
    sortBy: 'best',
    currency: FLIGHT_CURRENCY,
    market: FLIGHT_MARKET,
    countryCode: FLIGHT_COUNTRY_CODE,
  };
}

function getItineraries(apiResponse) {
  return apiResponse?.data?.itineraries || [];
}

function isStaleIdResponse(apiResponse) {
  const message = String(apiResponse?.message || '');
  return (
    apiResponse?.status === false ||
    message === 'Something went wrong.' ||
    message.includes('object Object')
  );
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatUSD(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function mapFlightOffers({ itineraries, rate, isExchangeFallback, originAirport, destAirport, departureDate, returnDate }) {
  return itineraries.slice(0, 3).map((item, index) => {
    const rawPrice = Number(item.price?.raw || 0);
    const priceBRL = FLIGHT_CURRENCY === 'BRL' ? rawPrice : rawPrice * rate;
    const priceUSD = FLIGHT_CURRENCY === 'USD' ? rawPrice : priceBRL / rate;
    const legs = item.legs || [];
    const outboundLeg = legs[0];
    const duration = outboundLeg?.durationInMinutes || 0;
    const stops = outboundLeg?.stopCount ?? 0;
    const airline = outboundLeg?.carriers?.marketing?.[0]?.name || 'N/A';

    logger.debug(`[FLIGHT ${index + 1}] price=${FLIGHT_CURRENCY} ${rawPrice} | duration=${duration} min | stops=${stops} | airline=${airline}`);

    return {
      provider: 'sky_scrapper',
      priceUSD,
      formattedUSD: FLIGHT_CURRENCY === 'USD' && item.price?.formatted ? item.price.formatted : formatUSD(priceUSD),
      priceBRL,
      formattedBRL: FLIGHT_CURRENCY === 'BRL' && item.price?.formatted ? item.price.formatted : formatBRL(priceBRL),
      exchangeRate: rate,
      isExchangeFallback,
      currencyOriginal: FLIGHT_CURRENCY,
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
  const cacheKey = `flights-live-v2-${originAirport.skyId}-${destAirport.skyId}-${departureDate}-${returnDate}-${travelers}-${FLIGHT_CURRENCY}-${FLIGHT_MARKET}-${FLIGHT_COUNTRY_CODE}`;
  const tryLabel = isRetry ? 'TENTATIVA 2' : 'TENTATIVA 1';

  logger.debug(`[FLIGHTS REQUEST] (${tryLabel})`);
  logger.debug(`originSkyId=${originAirport.skyId} | originEntityId=${originAirport.entityId}`);
  logger.debug(`destinationSkyId=${destAirport.skyId} | destinationEntityId=${destAirport.entityId}`);
  logger.debug(`date=${departureDate} | returnDate=${returnDate} | travelers=${travelers}`);
  logger.debug(`currency=${FLIGHT_CURRENCY} | market=${FLIGHT_MARKET} | countryCode=${FLIGHT_COUNTRY_CODE}`);
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
          endpoint: FLIGHT_ENDPOINTS[0].path,
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

  const params = buildFlightParams({ originAirport, destAirport, departureDate, returnDate, travelers });
  const endpointAttempts = [];
  let staleIdsDetected = false;

  for (const endpoint of FLIGHT_ENDPOINTS) {
    try {
      logger.debug(`[FLIGHTS API] Tentando ${endpoint.path}`);
      const response = await axios.get(`https://${FLIGHT_HOST}${endpoint.path}`, {
        headers,
        params,
        timeout: 15000,
      });

      const apiResponse = response.data;
      const itineraries = getItineraries(apiResponse);
      const attemptSummary = {
        endpoint: endpoint.path,
        status: apiResponse?.status,
        totalResults: apiResponse?.data?.context?.totalResults || 'N/A',
        itinerariesLength: itineraries.length,
        dataKeys: Object.keys(apiResponse?.data || {}),
      };
      endpointAttempts.push(attemptSummary);

      logger.debug('[FLIGHTS RESPONSE]', attemptSummary);

      if (isStaleIdResponse(apiResponse)) {
        staleIdsDetected = true;
        logger.warn(`[FLIGHTS] ${endpoint.path} retornou resposta de erro da API.`);
        logger.debug('[FLIGHTS ERROR RAW]', apiResponse);
        continue;
      }

      if (itineraries.length === 0) {
        logger.warn(`[FLIGHTS] ${endpoint.path} não retornou itinerários.`);
        continue;
      }

      logger.debug(`Primeiro preço raw: ${itineraries[0].price?.raw}`);
      logger.debug(`Primeiro preço formatted: ${itineraries[0].price?.formatted}`);
      logger.debug(`Primeira companhia: ${itineraries[0].legs?.[0]?.carriers?.marketing?.[0]?.name}`);

      const { rate, isFallback } = await getUSDBRLRate();
      const offers = mapFlightOffers({
        itineraries,
        rate,
        isExchangeFallback: isFallback,
        originAirport,
        destAirport,
        departureDate,
        returnDate,
      });

      await db.run(
        'INSERT INTO flight_cache (cache_key, resultado_json, created_at) VALUES (?, ?, NOW()) ON CONFLICT (cache_key) DO UPDATE SET resultado_json = EXCLUDED.resultado_json, created_at = NOW()',
        [cacheKey, JSON.stringify(offers)]
      );

      logApiUsage({
        service_name: 'flights',
        provider: 'Sky Scrapper',
        endpoint: endpoint.path,
        cache_hit: 0,
        success: 1,
        status_code: response.status,
        request_key: cacheKey,
      });

      return { available: true, data: offers };
    } catch (err) {
      endpointAttempts.push({
        endpoint: endpoint.path,
        status: err.response?.status || null,
        message: err.response?.data?.message || err.message,
      });

      logger.error(`[FLIGHTS API ERROR] ${endpoint.path}`, err);
      logApiUsage({
        service_name: 'flights',
        provider: 'Sky Scrapper',
        endpoint: endpoint.path,
        success: 0,
        status_code: err.response?.status || null,
        error_message: err.response?.data?.message || err.message,
        request_key: cacheKey,
      });
    }
  }

  logger.warn('[FLIGHTS] Nenhum endpoint retornou voos reais.');
  logger.debug('[FLIGHTS ATTEMPTS]', endpointAttempts);

  if (staleIdsDetected && !isRetry) {
    logger.warn('[FLIGHTS] Possíveis Entity IDs obsoletos. Solicitando auto-repair.');
    await db.run('DELETE FROM airports WHERE "skyId" IN (?, ?)', [originAirport.skyId, destAirport.skyId]);

    return {
      available: false,
      needsRefresh: true,
      staleIds: [originAirport.skyId, destAirport.skyId],
      reason: 'Entity IDs obsoletos detectados.',
    };
  }

  return {
    available: false,
    reason: 'Nenhum voo real foi retornado pela Sky Scrapper para essa rota/data.',
    data: [],
  };
}

module.exports = { searchFlights };
