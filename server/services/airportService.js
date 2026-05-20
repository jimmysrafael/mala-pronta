const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');

// Cache em memória (curto prazo - 60s)
const memoryCache = new Map();
const CACHE_TTL = 60 * 1000;

// Evitar chamadas duplicadas simultâneas
let lastQuery = '';

// Circuit Breaker State
let apiDisabled = false;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const FLIGHT_HOST = 'sky-scrapper.p.rapidapi.com';

const headers = {
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': FLIGHT_HOST,
};

async function searchAirports(query) {
  const qOriginal = query.trim();
  const q = qOriginal.toLowerCase();
  const qUpper = qOriginal.toUpperCase();
  const maskedKey = RAPIDAPI_KEY ? `****${RAPIDAPI_KEY.slice(-4)}` : 'MISSING';
  
  console.log(`\n[SEARCH] query: "${qOriginal}" | key: ${maskedKey}`);
  
  // Normalização de acentos para busca
  const qNormalized = qOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  
  // 0. BLOQUEIO DE QUERIES CURTAS
  if (q.length < 3) {
    console.log(`[SKIP] Query muito curta: "${q}"`);
    return [];
  }

  // 1. MEMORY CACHE (TTL 60s)
  const cachedMem = memoryCache.get(q);
  if (cachedMem && (Date.now() - cachedMem.timestamp < CACHE_TTL)) {
    console.log(`[CACHE HIT] tipo=memory_airport | key=${q}`);
    return cachedMem.data;
  }

  // Ignorar se for exatamente igual à última processada
  if (q === lastQuery) {
    return cachedMem ? cachedMem.data : [];
  }
  lastQuery = q;

  // 2. BUSCA LOCAL COM RELEVÂNCIA (Banco de Dados)
  const localResults = db.prepare(`
    SELECT skyId, entityId, cityName, airportName, iataCode, subtitle, flightPlaceType, hotelEntityId,
      CASE 
        WHEN UPPER(iataCode) = ? THEN 1
        WHEN UPPER(skyId) = ? THEN 2
        WHEN LOWER(cityName) = ? OR cityNameNormalized = ? THEN 3
        WHEN LOWER(cityName) LIKE ? OR cityNameNormalized LIKE ? THEN 4
        WHEN subtitle LIKE '%Brazil%' THEN 5
        ELSE 6
      END as relevance
    FROM airports 
    WHERE cityNameNormalized LIKE ? 
       OR cityName COLLATE NOCASE LIKE ?
       OR iataCode COLLATE NOCASE LIKE ? 
       OR airportName COLLATE NOCASE LIKE ?
       OR skyId COLLATE NOCASE LIKE ?
    ORDER BY relevance ASC, cityName ASC
    LIMIT 15
  `).all(
    qUpper, qUpper, q, qNormalized, 
    `${q}%`, `${qNormalized}%`, 
    `%${qNormalized}%`, 
    `%${q}%`, 
    `%${q}%`, 
    `%${q}%`,
    `%${q}%`
  );

  // --- REGRAS DE CONTROLE DE CHAMADA ---
  const hasStrongMatch = localResults.some(r => r.relevance <= 3);
  const shouldCallAPI = !hasStrongMatch && localResults.length < 2 && !apiDisabled;

  if (!shouldCallAPI) {
    const reason = apiDisabled ? '[FALLBACK]' : (hasStrongMatch ? '[LOCAL-STRONG]' : '[LOCAL]');
    console.log(`${reason} ${q} -> Usando ${localResults.length} resultados locais.`);
    
    memoryCache.set(q, { data: localResults.slice(0, 8), timestamp: Date.now() });
    return localResults.slice(0, 8);
  }

  // 3. BUSCA NA API EXTERNA
  console.log(`[API CALL] searchAirport: "${q}"`);
  try {
    const { data } = await axios.get(
      'https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport',
      {
        headers,
        params: { query: q, locale: 'pt-BR' },
        timeout: 5000,
      }
    );

    const apiItems = data?.data || [];
    console.log(`[RESULTS RAW] total retornado da API: ${apiItems.length}`);
    
    // FILTRAR E ORDENAR: Priorizar Aeroportos e Match de IATA
    const results = apiItems
      .map(item => {
        const flightParams = item.navigation?.relevantFlightParams || {};
        const hotelParams = item.navigation?.relevantHotelParams || {};
        const resItem = {
          skyId: flightParams.skyId || item.skyId,
          entityId: flightParams.entityId || item.entityId,
          cityName: item.presentation?.title || '',
          airportName: item.presentation?.suggestionTitle || '',
          iataCode: flightParams.skyId || item.skyId,
          subtitle: item.presentation?.subtitle || '',
          type: flightParams.flightPlaceType || item.navigation?.entityType || 'AIRPORT',
          hotelEntityId: hotelParams.entityId || null
        };
        console.log(`[ITEM RAW] skyId=${resItem.skyId} | entityId=${resItem.entityId} | type=${resItem.type} | name=${resItem.cityName} | title=${resItem.airportName} | subtitle=${resItem.subtitle}`);
        return resItem;
      })
      // Priorização (6 Passos)
      .sort((a, b) => {
        const aIata = a.iataCode.toUpperCase();
        const bIata = b.iataCode.toUpperCase();
        const qUpper = q.toUpperCase();
        const qLower = q.toLowerCase();

        // 1º Match exato iataCode
        if (aIata === qUpper && bIata !== qUpper) return -1;
        if (aIata !== qUpper && bIata === qUpper) return 1;

        // 2º Match exato skyId
        if (a.skyId.toUpperCase() === qUpper && b.skyId.toUpperCase() !== qUpper) return -1;
        if (a.skyId.toUpperCase() !== qUpper && b.skyId.toUpperCase() === qUpper) return 1;

        // 3º cityName === query
        const aCity = a.cityName.toLowerCase();
        const bCity = b.cityName.toLowerCase();
        if (aCity === qLower && bCity !== qLower) return -1;
        if (aCity !== qLower && bCity === qLower) return 1;

        // 4º cityName startsWith(query)
        const aStarts = aCity.startsWith(qLower);
        const bStarts = bCity.startsWith(qLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // 5º país === "Brazil"
        const aBrazil = a.subtitle.includes('Brazil');
        const bBrazil = b.subtitle.includes('Brazil');
        if (aBrazil && !bBrazil) return -1;
        if (!aBrazil && bBrazil) return 1;

        // 6º Tipo Aeroporto > Cidade (Fallback de desempate)
        if (a.type === 'AIRPORT' && b.type === 'CITY') return -1;
        if (a.type === 'CITY' && b.type === 'AIRPORT') return 1;

        return 0;
      });

    console.log(`\n[FINAL AUTOCOMPLETE]`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`${i+1}º ${r.iataCode} - ${r.cityName} (${r.type}) [${r.subtitle}]`);
    });

    logApiUsage({
      service_name: 'airports',
      provider: 'Sky Scrapper',
      endpoint: '/searchAirport',
      cache_hit: 0,
      success: 1,
      request_key: q
    });

    // 4. AUTO-POPULATE (Banco) - Apenas Aeroportos para evitar poluição
    const airportsToSave = results.filter(r => r.type === 'AIRPORT');
    
    if (airportsToSave.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO airports (skyId, entityId, cityName, airportName, iataCode, subtitle, cityNameNormalized, flightPlaceType, hotelEntityId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      const transaction = db.transaction((items) => {
        for (const item of items) {
          insert.run(
            item.skyId, 
            item.entityId, 
            item.cityName, 
            item.airportName, 
            item.iataCode, 
            item.subtitle, 
            normalize(item.cityName),
            item.type,
            item.hotelEntityId
          );
        }
      });
      transaction(airportsToSave);
    }

    const finalResults = results.slice(0, 8);
    memoryCache.set(q, { data: finalResults, timestamp: Date.now() });
    
    return finalResults;

  } catch (err) {
    const errorMsg = (err?.response?.data?.message || err.message).toLowerCase();
    
    if (errorMsg.includes('exceeded') || errorMsg.includes('quota')) {
      apiDisabled = true;
      console.error(`[CIRCUIT BREAKER] ATIVADO: Cota da API RapidAPI estourada.`);
    }

    logApiUsage({
      service_name: 'airports',
      provider: 'Sky Scrapper',
      endpoint: '/searchAirport',
      success: 0,
      error_message: errorMsg,
      request_key: q
    });

    console.error(`[FALLBACK] Erro na API: ${errorMsg}. Usando resultados locais.`);
    return localResults.slice(0, 6);
  }
}

module.exports = { searchAirports };
