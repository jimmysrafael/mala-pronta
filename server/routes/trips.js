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
const {
  consumeConsultation,
  getWalletStatus,
  refundConsultation,
} = require('../services/monetizationService');
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
const budgetDecisionPreviews = new Map();
const BUDGET_DECISION_THRESHOLD = 0.6;
const BUDGET_PREVIEW_TTL_MS = 10 * 60 * 1000;

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

function createBudgetPreviewToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupBudgetPreviewStore() {
  const now = Date.now();
  for (const [token, item] of budgetDecisionPreviews.entries()) {
    if (!item || item.expiresAt <= now) {
      budgetDecisionPreviews.delete(token);
    }
  }
}

function storeBudgetPreview(token, payload) {
  cleanupBudgetPreviewStore();
  budgetDecisionPreviews.set(token, {
    ...payload,
    expiresAt: Date.now() + BUDGET_PREVIEW_TTL_MS,
  });
}

function readBudgetPreview(token) {
  cleanupBudgetPreviewStore();
  const preview = budgetDecisionPreviews.get(token);
  if (!preview) return null;

  if (preview.expiresAt <= Date.now()) {
    budgetDecisionPreviews.delete(token);
    return null;
  }

  return preview;
}

function getTripBudgetUsage(flightResults, hotels, budget) {
  const flightCost = flightResults?.available && flightResults.data?.length > 0
    ? Number(flightResults.data[0]?.priceBRL || 0)
    : 0;
  const hotelCost = hotels?.available && hotels.data?.length > 0
    ? Number(hotels.data[0]?.totalPrice || 0)
    : 0;
  const total = flightCost + hotelCost;

  return {
    flightCost,
    hotelCost,
    total,
    usage: budget > 0 ? total / budget : 0,
    requiresDecision: total > 0 && budget > 0 && total / budget > BUDGET_DECISION_THRESHOLD,
  };
}

function uniqStrings(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function normalizeItineraryFromPlan(itinerary, tripPlan) {
  const dayCount = tripPlan.days || itinerary.totalDays || 0;
  const activitiesCount = tripPlan.daysFramework?.reduce((sum, day) => sum + (day.suggestedAttractions?.length || 0), 0) || 0;

  return {
    ...itinerary,
    destination: itinerary.destination || tripPlan.destination,
    totalDays: dayCount,
    totalBudget: tripPlan.budgetBreakdown?.total || itinerary.totalBudget || tripPlan.budget,
    totalActivities: itinerary.totalActivities || activitiesCount,
    budgetBreakdown: tripPlan.budgetBreakdown || itinerary.budgetBreakdown,
    flightSummary: tripPlan.flightSummary || itinerary.flightSummary,
    hotelSummary: tripPlan.hotelSummary || itinerary.hotelSummary,
    warnings: uniqStrings([...(tripPlan.warnings || []), ...(itinerary.warnings || [])]),
  };
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
    return { error: 'Orçamento deve ser um valor entre 100 e 100000' };
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

    const {
      origin,
      destination,
      days,
      budget,
      travelers,
      startDate,
      date,
      returnDate,
      interests,
    } = validation.value;

    const budgetDecision = String(req.body.budgetDecision || '').trim();
    const previewToken = String(req.body.previewToken || '').trim();

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

    const baseCacheKey = `trip-live-v2-${originCity}-${destinationCity}-${days}-${budget}-${travelers}-${departureDate}-${tripReturnDate}-${interests}`
      .toLowerCase()
      .replace(/\s+/g, '_');

    const inFlightKey = budgetDecision
      ? `${baseCacheKey}-${budgetDecision}`
      : `${baseCacheKey}-preview`;

    if (inFlightRequests.has(inFlightKey)) {
      logger.info('[TRACKING] Requisicao identica em andamento. Aguardando...');
      const result = await inFlightRequests.get(inFlightKey);
      return res.json(result);
    }

    const processTrip = async () => {
      const consultation = await consumeConsultation(req);
      if (!consultation.allowed) {
        return {
          paymentRequired: true,
          error: 'Limite de consultas atingido.',
          monetization: {
            ...consultation,
            wallet: await getWalletStatus(req),
          },
        };
      }

      const cacheKey = budgetDecision ? `${baseCacheKey}-${budgetDecision}` : baseCacheKey;
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

      if (budgetDecision) {
        if (budgetDecision !== 'adapt_without_api' && budgetDecision !== 'use_real_values') {
          await refundConsultation(req, consultation.source);
          return { error: 'Modo de planejamento invalido' };
        }

        let tripPlan;
        if (budgetDecision === 'use_real_values') {
          if (!previewToken) {
            await refundConsultation(req, consultation.source);
            return { error: 'Token de planejamento ausente' };
          }

          const preview = readBudgetPreview(previewToken);
          if (!preview) {
            await refundConsultation(req, consultation.source);
            return { error: 'Avaliação de orçamento expirada. Gere o roteiro novamente.' };
          }

          tripPlan = buildFeasiblePlan({
            destination: preview.destination,
            days: preview.days,
            budget: preview.budget,
            flights: preview.flightResults,
            hotels: preview.hotels,
            attractions: preview.attractions,
            weather: preview.weather,
            budgetMode: 'real_values',
          });
        } else {
          tripPlan = buildFeasiblePlan({
            destination,
            days,
            budget,
            flights: { available: false, data: [], reason: 'Modo sem valores reais selecionado pelo usuario.' },
            hotels: { available: false, data: [], reason: 'Modo sem valores reais selecionado pelo usuario.' },
            attractions: { available: false, data: [] },
            weather: { data: null },
            budgetMode: 'estimate',
          });
        }

        const itinerary = normalizeItineraryFromPlan(
          await generateAIItinerary(tripPlan),
          tripPlan
        );

        await db.run(
          'INSERT INTO trip_cache (cache_key, resultado_json, created_at) VALUES (?, ?, NOW()) ON CONFLICT (cache_key) DO UPDATE SET resultado_json = EXCLUDED.resultado_json, created_at = NOW()',
          [cacheKey, JSON.stringify(itinerary)]
        );

        return itinerary;
      }

      logger.info('[TRIP] Iniciando busca de dados...');
      let flightResults = await searchFlights({ origin, destination, days, travelers, startDate, date, returnDate });

      if (flightResults.needsRefresh) {
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
        budgetMode: 'estimate',
      });

      const budgetUsage = getTripBudgetUsage(flightResults, hotels, budget);
      if (budgetUsage.requiresDecision) {
        const previewTokenValue = createBudgetPreviewToken();
        storeBudgetPreview(previewTokenValue, {
          destination,
          days,
          budget,
          flightResults,
          hotels,
          attractions,
          weather,
        });

        return {
          needsBudgetDecision: true,
          previewToken: previewTokenValue,
          budgetUsage: {
            thresholdPercent: Math.round(BUDGET_DECISION_THRESHOLD * 100),
            usagePercent: Math.round(budgetUsage.usage * 100),
            flightCost: budgetUsage.flightCost,
            hotelCost: budgetUsage.hotelCost,
            total: budgetUsage.total,
            budget,
          },
          decisionOptions: [
            {
              id: 'adapt_without_api',
              label: 'Adaptar sem valores reais',
              description: 'Usa estimativas e evita novas consultas de passagem e hotel.',
            },
            {
              id: 'use_real_values',
              label: 'Usar valores reais encontrados',
              description: 'Mantem os valores encontrados agora e ajusta o roteiro com base neles.',
            },
          ],
          preview: {
            destination,
            days,
            budget,
            chosenFlight: tripPlan.chosenFlight,
            chosenHotel: tripPlan.chosenHotel,
            warnings: tripPlan.warnings,
          },
          message: 'Passagem e hospedagem ultrapassaram o limite de segurança do orçamento. Escolha como deseja continuar.',
        };
      }

      const itinerary = normalizeItineraryFromPlan(
        await generateAIItinerary(tripPlan),
        tripPlan
      );

      await db.run(
        'INSERT INTO trip_cache (cache_key, resultado_json, created_at) VALUES (?, ?, NOW()) ON CONFLICT (cache_key) DO UPDATE SET resultado_json = EXCLUDED.resultado_json, created_at = NOW()',
        [baseCacheKey, JSON.stringify(itinerary)]
      );

      return itinerary;
    };

    const tripPromise = processTrip();
    inFlightRequests.set(inFlightKey, tripPromise);

    try {
      const result = await tripPromise;
      if (result?.error) {
        if (result.paymentRequired) {
          return res.status(402).json({
            error: result.error,
            paymentRequired: true,
            monetization: result.monetization,
          });
        }
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } finally {
      inFlightRequests.delete(inFlightKey);
    }
  } catch (err) {
    logger.error('Generate error:', err);
    if (err.status === 401 || err.code === 'invalid_api_key') {
      return res.status(500).json({ error: 'Chave da API OpenAI invalida.' });
    }
    res.status(500).json({ error: 'Erro ao gerar o roteiro. Tente novamente.' });
  }
});

// POST /api/trips/save - Protegido
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { destination, days, budget, itinerary } = req.body;

    if (!destination || !days || !budget || !itinerary) {
      return res.status(400).json({ error: 'Todos os campos sao obrigatorios' });
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
      return res.status(404).json({ error: 'Viagem nao encontrada' });
    }

    await db.run('DELETE FROM trips WHERE id = ?', [req.params.id]);

    res.json({ message: 'Viagem deletada com sucesso' });
  } catch (err) {
    logger.error('Delete error:', err);
    res.status(500).json({ error: 'Erro ao deletar a viagem' });
  }
});

module.exports = router;
