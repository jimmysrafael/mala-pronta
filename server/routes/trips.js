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
const logger = require('../utils/logger');

const router = express.Router();

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
  keyGenerator: (req, res) => (req.userId ? String(req.userId) : ipKeyGenerator(req, res)),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Limite atingido. Tente novamente mais tarde.',
    });
  },
});

const inFlightRequests = new Map();

function isValidTravelLocation(value) {
  if (typeof value === 'string') {
    const text = value.trim();
    return text.length >= 2 && text.length <= 120;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  return ['cityName', 'airportName', 'iataCode', 'skyId'].some((field) => {
    const text = String(value[field] || '').trim();
    return text.length >= 2 && text.length <= 120;
  });
}

function isValidIsoDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function validateGeneratePayload(body = {}) {
  const days = Number(body.days);
  const budget = Number(body.budget);
  const travelers = body.travelers === undefined ? 1 : Number(body.travelers);
  const interests = String(body.interests || '').trim();

  if (!isValidTravelLocation(body.origin)) {
    return { error: 'Origem invalida' };
  }
  if (!isValidTravelLocation(body.destination)) {
    return { error: 'Destino invalido' };
  }
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return { error: 'Dias deve ser um numero entre 1 e 30' };
  }
  if (!Number.isFinite(budget) || budget < 100 || budget > 100000) {
    return { error: 'Orcamento deve ser um valor entre 100 e 100000' };
  }
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 9) {
    return { error: 'Viajantes deve ser um numero entre 1 e 9' };
  }
  if (!isValidIsoDate(body.startDate) || !isValidIsoDate(body.date) || !isValidIsoDate(body.returnDate)) {
    return { error: 'Data invalida' };
  }
  if (interests.length > 300) {
    return { error: 'Interesses deve ter no maximo 300 caracteres' };
  }

  return {
    value: {
      origin: body.origin,
      destination: body.destination,
      days,
      budget,
      travelers,
      startDate: body.startDate || '',
      date: body.date || '',
      returnDate: body.returnDate || '',
      interests,
    },
  };
}

// POST /api/trips/generate - Acesso Livre (Optional Auth)
router.post('/generate', optionalAuth, generateLimiter, async (req, res) => {

  try {
    const validation = validateGeneratePayload(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { origin, destination, days, budget, travelers, startDate, date, returnDate, interests } = validation.value;

    if (!destination || !days || !budget) {
      return res.status(400).json({ error: 'Destino, dias e orçamento são obrigatórios' });
    }

    const originName = typeof origin === 'object' ? (origin.cityName || origin.airportName || '') : origin;
    const destinationName = typeof destination === 'object' ? (destination.cityName || destination.airportName || '') : destination;
    const destinationIata = typeof destination === 'object' ? (destination.iataCode || '') : '';
    const originIata = typeof origin === 'object' ? (origin.iataCode || '') : '';

    const canonicalOrigin = originIata
      ? await db.one('SELECT "cityName" FROM airports WHERE "iataCode" = ?', [originIata])
      : null;
    const canonicalDestination = destinationIata
      ? await db.one('SELECT "cityName", "hotelEntityId" FROM airports WHERE "iataCode" = ?', [destinationIata])
      : null;

    const originCity = normalizeTravelCityLabel(canonicalOrigin?.cityName || originName);
    const destinationCity = normalizeTravelCityLabel(canonicalDestination?.cityName || destinationName);

    const departureDate = date || startDate || '';
    const tripReturnDate = returnDate || '';
    const cacheKey = `trip-${originCity}-${destinationCity}-${days}-${budget}-${travelers}-${departureDate}-${tripReturnDate}-${interests}`
      .toLowerCase().replace(/\s+/g, '_');

    if (inFlightRequests.has(cacheKey)) {
      logger.info('[TRACKING] Requisição idêntica em andamento. Aguardando...');
      const result = await inFlightRequests.get(cacheKey);
      return res.json(result);
    }

    const processTrip = async () => {
      const cached = await db.one('SELECT resultado_json, created_at FROM trip_cache WHERE cache_key = ?', [cacheKey]);
      if (cached) {
        const ageHours = (new Date() - new Date(cached.created_at)) / (1000 * 60 * 60);
        if (ageHours < 24) {
          logger.info('[CACHE HIT] tipo=trip_cache');
          logApiUsage({
            service_name: 'full_trip_itinerary',
            provider: 'CacheSystem',
            endpoint: 'trip_cache',
            cache_hit: 1,
            request_key: cacheKey,
          });
          return JSON.parse(cached.resultado_json);
        }
      }

      logger.info('[CACHE MISS] tipo=trip_cache');
      logger.info('[TRIP] Iniciando busca de dados...');
      let flightResults = await searchFlights({ origin, destination, days, travelers, startDate, date, returnDate });

      if (flightResults.needsRefresh) {
        const oldOriginId = origin.entityId;
        const oldDestId = destination.entityId;

        logger.info('[AUTO-REPAIR] Detectada falha de IDs. Atualizando aeroportos.');

        await Promise.all([
          searchAirports(origin.iataCode || origin.cityName),
          searchAirports(destination.iataCode || destination.cityName),
        ]);

        const newOrigin = await db.one('SELECT * FROM airports WHERE "iataCode" = ?', [origin.iataCode]);
        const newDest = await db.one('SELECT * FROM airports WHERE "iataCode" = ?', [destination.iataCode]);

        if (newOrigin) logger.info(`[AUTO-REPAIR] ${newOrigin.iataCode} atualizado.`);
        if (newDest) logger.info(`[AUTO-REPAIR] ${newDest.iataCode} atualizado.`);

        flightResults = await searchFlights(
          { origin: newOrigin || origin, destination: newDest || destination, days, travelers, startDate, date, returnDate },
          true
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
        weather,
      });
      const itinerary = await generateAIItinerary(tripPlan);

      await db.run(
        'INSERT INTO trip_cache (cache_key, resultado_json, created_at) VALUES (?, ?, NOW()) ON CONFLICT (cache_key) DO UPDATE SET resultado_json = EXCLUDED.resultado_json, created_at = NOW()',
        [cacheKey, JSON.stringify(itinerary)]
      );

      return itinerary;
    };

    const tripPromise = processTrip();
    inFlightRequests.set(cacheKey, tripPromise);

    try {
      const result = await tripPromise;
      res.json(result);
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  } catch (err) {
    logger.error('Generate error:', err);
    if (err.status === 401 || err.code === 'invalid_api_key') {
      return res.status(500).json({ error: 'Chave da API OpenAI inválida.' });
    }
    res.status(500).json({ error: 'Erro ao gerar o roteiro. Tente novamente.' });
  }
});

// POST /api/trips/save - Protegido
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { destination, days, budget, itinerary } = req.body;

    if (!destination || !days || !budget || !itinerary) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const saved = await db.one(
      'INSERT INTO trips (user_id, destination, days, budget, itinerary) VALUES (?, ?, ?, ?, ?) RETURNING *',
      [req.userId, destination, days, budget, itinerary]
    );

    res.status(201).json(saved);
  } catch (err) {
    logger.error('Save error:', err);
    res.status(500).json({ error: 'Erro ao salvar a viagem' });
  }
});

// GET /api/trips - Protegido
router.get('/', authMiddleware, async (req, res) => {
  try {
    const trips = await db.many(
      'SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );

    res.json(trips);
  } catch (err) {
    logger.error('List trips error:', err);
    res.status(500).json({ error: 'Erro ao buscar viagens' });
  }
});

// DELETE /api/trips/:id - Protegido
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const trip = await db.one(
      'SELECT * FROM trips WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (!trip) {
      return res.status(404).json({ error: 'Viagem não encontrada' });
    }

    await db.run('DELETE FROM trips WHERE id = ?', [req.params.id]);

    res.json({ message: 'Viagem deletada com sucesso' });
  } catch (err) {
    logger.error('Delete error:', err);
    res.status(500).json({ error: 'Erro ao deletar a viagem' });
  }
});

module.exports = router;
