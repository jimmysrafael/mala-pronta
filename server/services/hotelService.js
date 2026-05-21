const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');
const logger = require('../utils/logger');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOTEL_HOST = 'booking-com15.p.rapidapi.com';

const headers = {
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': HOTEL_HOST,
};

async function searchDestination(city) {
  try {
    const cached = await db.one('SELECT dest_id, search_type, name FROM hotel_dest_cache WHERE city_name = ?', [city]);
    if (cached) {
      logger.debug(`[CACHE HIT] tipo=hotel_dest_cache | key=${city}`);
      return cached;
    }
  } catch (err) {
    logger.error('[hotel_dest] Cache check error:', err);
  }

  logger.debug(`[CACHE MISS] tipo=hotel_dest_cache | key=${city}`);

  try {
    const maskedKey = RAPIDAPI_KEY ? `****${RAPIDAPI_KEY.slice(-4)}` : 'MISSING';
    logger.debug(`[HOTEL DESTINATION] query=${city} | key=${maskedKey}`);

    const { data } = await axios.get(
      'https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination',
      {
        headers,
        params: { query: city },
      }
    );

    const result = data?.data?.[0];
    if (!result) {
      logger.debug(`[HOTEL DESTINATION FAIL] query=${city}`);
      return null;
    }

    const destData = {
      dest_id: result.dest_id,
      search_type: result.search_type || 'city',
      name: result.name || result.label || city,
    };

    logger.debug(`[HOTEL DESTINATION SUCCESS] city=${city} | dest_id=${destData.dest_id}`);

    await db.run(
      'INSERT INTO hotel_dest_cache (city_name, dest_id, search_type, name, created_at) VALUES (?, ?, ?, ?, NOW()) ON CONFLICT (city_name) DO UPDATE SET dest_id = EXCLUDED.dest_id, search_type = EXCLUDED.search_type, name = EXCLUDED.name, created_at = NOW()',
      [city, destData.dest_id, destData.search_type, destData.name]
    );

    logApiUsage({
      service_name: 'hotel_destination',
      provider: 'Booking.com',
      endpoint: '/searchDestination',
      cache_hit: 0,
      success: 1,
      request_key: city,
    });

    return destData;
  } catch (err) {
    logger.error(`[HOTEL DESTINATION ERROR] ${city}:`, err);
    return null;
  }
}

function getRelativeDate(baseDate, days) {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function normalizeCityLabel(value) {
  return String(value || '')
    .split(',')[0]
    .replace(/\s*\([^)]+\)\s*$/g, '')
    .replace(/\s*-\s*[A-Za-zÀ-ÿ'’\. ]+$/g, '')
    .trim();
}

async function searchHotels({ destination, days, budget, startDate }) {
  const destinationObj = typeof destination === 'object' && destination ? destination : null;
  const city = normalizeCityLabel(
    destinationObj?.cityName ||
    destinationObj?.airportName ||
    destination
  );
  const arrivalDate = startDate || getRelativeDate(null, 30);
  const departureDate = getRelativeDate(arrivalDate, parseInt(days));
  const cacheKey = `hotels-${destinationObj?.hotelEntityId || city}-${arrivalDate}-${departureDate}-${budget}`;

  try {
    const cached = await db.one('SELECT resultado_json, created_at FROM hotel_search_cache WHERE cache_key = ?', [cacheKey]);
    if (cached) {
      const ageHours = (new Date() - new Date(cached.created_at)) / (1000 * 60 * 60);
      if (ageHours < 24) {
        logger.debug(`[CACHE HIT] tipo=hotel_search_cache | key=${cacheKey}`);
        return { available: true, data: JSON.parse(cached.resultado_json) };
      }
    }
  } catch (err) {
    logger.error('[hotel_search] Cache check error:', err);
  }

  logger.debug(`[CACHE MISS] tipo=hotel_search_cache | key=${cacheKey}`);

  try {
    const dest = destinationObj?.hotelEntityId
      ? {
          dest_id: destinationObj.hotelEntityId,
          search_type: destinationObj.hotelSearchType || (destinationObj.flightPlaceType === 'AIRPORT' ? 'airport' : 'city'),
          name: city,
        }
      : await searchDestination(city);

    if (!dest) {
      return { available: false, reason: 'Destino não encontrado no Booking', data: [] };
    }

    const budgetPerNight = (budget * 0.35) / days;

    logger.debug(`[HOTEL SEARCH] checkin=${arrivalDate} | checkout=${departureDate} | dest_id=${dest.dest_id}`);

    const { data } = await axios.get(
      'https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels',
      {
        headers,
        params: {
          dest_id: dest.dest_id,
          search_type: dest.search_type,
          arrival_date: arrivalDate,
          departure_date: departureDate,
          adults: 1,
          room_qty: 1,
          currency_code: 'BRL',
          languagecode: 'pt-br',
          sort_by: 'popularity',
        },
      }
    );

    const rawHotels = data?.data?.hotels || [];
    logger.debug(`[HOTEL SEARCH RESPONSE] total_results=${rawHotels.length}`);

    const hotels = rawHotels
      .filter((h) => {
        const price = h.property?.priceBreakdown?.grossPrice?.value;
        return price && price <= (budgetPerNight * days);
      })
      .slice(0, 3)
      .map((h, i) => {
        const hotelItem = {
          provider: 'booking',
          name: h.property?.name || 'Hotel',
          totalPrice: Math.round(h.property?.priceBreakdown?.grossPrice?.value || 0),
          nightlyRate: Math.round((h.property?.priceBreakdown?.grossPrice?.value || 0) / days),
          currency: 'BRL',
          rating: h.property?.reviewScore || null,
          reviewWord: h.property?.reviewScoreWord || null,
          neighborhood: h.property?.wishlistName || null,
          checkIn: arrivalDate,
          checkOut: departureDate,
        };
        logger.debug(`[HOTEL ${i + 1}] name=${hotelItem.name} | price=BRL ${hotelItem.totalPrice} | rating=${hotelItem.rating}`);
        return hotelItem;
      });

    if (hotels.length > 0) {
      await db.run(
        'INSERT INTO hotel_search_cache (cache_key, resultado_json, created_at) VALUES (?, ?, NOW()) ON CONFLICT (cache_key) DO UPDATE SET resultado_json = EXCLUDED.resultado_json, created_at = NOW()',
        [cacheKey, JSON.stringify(hotels)]
      );
    }

    logApiUsage({
      service_name: 'hotel_search',
      provider: 'Booking.com',
      endpoint: '/searchHotels',
      cache_hit: 0,
      success: 1,
      request_key: cacheKey,
    });

    return { available: hotels.length > 0, data: hotels };
  } catch (err) {
    logger.error(`[HOTEL SEARCH ERROR] ${city}:`, err);
    return { available: false, reason: 'Não foi possível consultar hotéis em tempo real. Usamos uma estimativa com base no orçamento.', data: [] };
  }
}

module.exports = { searchHotels };
