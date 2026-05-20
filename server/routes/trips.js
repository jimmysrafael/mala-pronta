const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const db = require('../db');

const { searchFlights } = require('../services/flightService');
const { searchHotels } = require('../services/hotelService');
const { searchAttractions } = require('../services/attractionService');
const { getWeatherInsights } = require('../services/weatherService');
const { searchAirports } = require('../services/airportService');
const { buildFeasiblePlan } = require('../services/tripPlannerService');
const { generateAIItinerary } = require('../services/aiItineraryService');
const { logApiUsage } = require('../services/apiLogger');

const router = express.Router();
// Removemos a obrigatoriedade global para permitir acesso livre no /generate
// router.use(authMiddleware);

function normalizeTravelCityLabel(value) {
  let text = String(value || '').trim();
  if (!text) return '';

  text = text.replace(/\s*\([^)]+\)\s*$/g, '');
  text = text.split('/')[0].trim();
  text = text.replace(/^(Aeroporto\s+Internacional\s+(de|do|da)\s+|Aeroporto\s+(de|do|da)\s+|Internacional\s+(de|do|da)\s+|Aeroporto\s+)/i, '');
  text = text.replace(/\s*-\s*(Congonhas|Santos Dumont|Galeão.*|Antônio Carlos Jobim|Eduardo Gomes|Pinto Martins|Humberto Delgado|Charles de Gaulle).*$/i, '');
  text = text.replace(/\s+(Congonhas|Santos Dumont|Galeão|Antônio Carlos Jobim|Eduardo Gomes|Pinto Martins|Humberto Delgado|Charles de Gaulle)$/i, '');
  return text.replace(/\s{2,}/g, ' ').trim();
}

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req, res) => req.userId ? String(req.userId) : ipKeyGenerator(req, res),
  handler: (req, res) => {
    res.status(429).json({
      error: 'Limite atingido. Tente novamente mais tarde.',
    });
  },
});

const inFlightRequests = new Map();

// POST /api/trips/generate - Acesso Livre (Optional Auth)
router.post('/generate', optionalAuth, generateLimiter, async (req, res) => {
  const { origin, destination, days, budget, travelers = 1, startDate, date, returnDate, interests = '' } = req.body;

  try {
    if (!destination || !days || !budget) {
      return res.status(400).json({ error: 'Destino, dias e orçamento são obrigatórios' });
    }

    const originName = typeof origin === 'object' ? (origin.cityName || origin.airportName || '') : origin;
    const destinationName = typeof destination === 'object' ? (destination.cityName || destination.airportName || '') : destination;
    const destinationIata = typeof destination === 'object' ? (destination.iataCode || '') : '';
    const originIata = typeof origin === 'object' ? (origin.iataCode || '') : '';

    // Tenta reduzir variações de aeroporto para a cidade canônica do banco.
    // Isso evita mandar "Rio de Janeiro Santos Dumont" para hotéis/clima.
    const canonicalOrigin = originIata
      ? db.prepare('SELECT cityName FROM airports WHERE iataCode = ?').get(originIata)
      : null;
    const canonicalDestination = destinationIata
      ? db.prepare('SELECT cityName FROM airports WHERE iataCode = ?').get(destinationIata)
      : null;
    const originCity = normalizeTravelCityLabel(canonicalOrigin?.cityName || originName);
    const destinationCity = normalizeTravelCityLabel(canonicalDestination?.cityName || destinationName);
    
    // 1. GERAR CHAVE ÚNICA DO CACHE
    const departureDate = date || startDate || '';
    const tripReturnDate = returnDate || '';
    const cacheKey = `trip-${originCity}-${destinationCity}-${days}-${budget}-${travelers}-${departureDate}-${tripReturnDate}-${interests}`
      .toLowerCase().replace(/\s+/g, '_');

    // 2. EVITAR DUPLICIDADE EM ANDAMENTO (In-flight tracking)
    if (inFlightRequests.has(cacheKey)) {
      console.log(`[TRACKING] Requisição idêntica em andamento para: ${cacheKey}. Aguardando...`);
      const result = await inFlightRequests.get(cacheKey);
      return res.json(result);
    }

    // Função interna para o processamento
    const processTrip = async () => {
      // 3. CHECK TRIP CACHE (TTL 24h)
      const cached = db.prepare('SELECT resultado_json, created_at FROM trip_cache WHERE cache_key = ?').get(cacheKey);
      if (cached) {
        const ageHours = (new Date() - new Date(cached.created_at)) / (1000 * 60 * 60);
        if (ageHours < 24) {
          console.log(`[CACHE HIT] tipo=trip_cache | key=${cacheKey}`);
          logApiUsage({
            service_name: 'full_trip_itinerary',
            provider: 'CacheSystem',
            endpoint: 'trip_cache',
            cache_hit: 1,
            request_key: cacheKey
          });
          return JSON.parse(cached.resultado_json);
        }
      }

      console.log(`[CACHE MISS] tipo=trip_cache | key=${cacheKey}`);

      // 4. BUSCAR DADOS (Cada serviço tem seu próprio cache interno agora)
      console.log(`\n🛫 [TRIP] Iniciando busca de dados...`);
      let flightResults = await searchFlights({ origin, destination, days, travelers, startDate, date, returnDate });

      // AUTO-REPAIR: Se os IDs do aeroporto estiverem obsoletos
      if (flightResults.needsRefresh) {
        const oldOriginId = origin.entityId;
        const oldDestId = destination.entityId;
        
        console.log(`♻️  [AUTO-REPAIR] Detectada falha de IDs. Atualizando aeroportos: ${origin.iataCode}, ${destination.iataCode}...`);
        
        // Dispara busca na API por IATA para garantir que pegamos o registro exato
        await Promise.all([
          searchAirports(origin.iataCode || origin.cityName),
          searchAirports(destination.iataCode || destination.cityName)
        ]);

        // Busca os novos objetos atualizados do banco (pós-API call)
        const newOrigin = db.prepare('SELECT * FROM airports WHERE iataCode = ?').get(origin.iataCode);
        const newDest = db.prepare('SELECT * FROM airports WHERE iataCode = ?').get(destination.iataCode);

        if (newOrigin) console.log(`[AUTO-REPAIR] ${newOrigin.iataCode} atualizado: ${oldOriginId} -> ${newOrigin.entityId}`);
        if (newDest) console.log(`[AUTO-REPAIR] ${newDest.iataCode} atualizado: ${oldDestId} -> ${newDest.entityId}`);

        // Tenta buscar voos novamente com os novos IDs REAIS em memória
        flightResults = await searchFlights(
          { origin: newOrigin || origin, destination: newDest || destination, days, travelers, startDate, date, returnDate },
          true // isRetry = true
        );
      }

      const destinationForLocalApis = destinationCity || destinationName;
      const destinationForHotels = typeof destination === 'object'
        ? {
            ...destination,
            cityName: destinationForLocalApis,
            hotelEntityId: destination.hotelEntityId || canonicalDestination?.hotelEntityId || null,
          }
        : destinationForLocalApis;
      const [hotels, attractions, weather] = await Promise.all([
        searchHotels({ destination: destinationForHotels, days, budget, startDate }),
        searchAttractions({ destination: destinationForLocalApis }),
        getWeatherInsights({ destination: destinationForLocalApis }),
      ]);

      const tripPlan = buildFeasiblePlan({ 
        destination, 
        days, 
        budget, 
        flights: flightResults, 
        hotels, 
        attractions, 
        weather 
      });
      const itinerary = await generateAIItinerary(tripPlan);

      // 5. SALVAR NO CACHE DE TRIP
      db.prepare('INSERT OR REPLACE INTO trip_cache (cache_key, resultado_json, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
        .run(cacheKey, JSON.stringify(itinerary));

      return itinerary;
    };

    // Registrar no rastreador e processar
    const tripPromise = processTrip();
    inFlightRequests.set(cacheKey, tripPromise);

    try {
      const result = await tripPromise;
      res.json(result);
    } finally {
      // 6. LIMPEZA OBRIGATÓRIA
      inFlightRequests.delete(cacheKey);
    }

  } catch (err) {
    console.error('Generate error:', err);
    if (err.status === 401 || err.code === 'invalid_api_key') {
      return res.status(500).json({ error: 'Chave da API OpenAI inválida.' });
    }
    res.status(500).json({ error: 'Erro ao gerar o roteiro. Tente novamente.' });
  }
});

// POST /api/trips/save - Protegido
router.post('/save', authMiddleware, (req, res) => {
  try {
    const { destination, days, budget, itinerary } = req.body;

    if (!destination || !days || !budget || !itinerary) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const result = db.prepare(
      'INSERT INTO trips (user_id, destination, days, budget, itinerary) VALUES (?, ?, ?, ?, ?)'
    ).run(req.userId, destination, days, budget, JSON.stringify(itinerary));

    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      ...trip,
      itinerary: JSON.parse(trip.itinerary),
    });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Erro ao salvar a viagem' });
  }
});

// GET /api/trips - Protegido
router.get('/', authMiddleware, (req, res) => {
  try {
    const trips = db.prepare(
      'SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.userId);

    const parsed = trips.map((trip) => ({
      ...trip,
      itinerary: JSON.parse(trip.itinerary),
    }));

    res.json(parsed);
  } catch (err) {
    console.error('List trips error:', err);
    res.status(500).json({ error: 'Erro ao buscar viagens' });
  }
});

// DELETE /api/trips/:id - Protegido
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.userId
    );

    if (!trip) {
      return res.status(404).json({ error: 'Viagem não encontrada' });
    }

    db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);

    res.json({ message: 'Viagem deletada com sucesso' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Erro ao deletar a viagem' });
  }
});

module.exports = router;
