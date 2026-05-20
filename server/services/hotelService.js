const axios = require('axios');
const db = require('../db');
const { logApiUsage } = require('./apiLogger');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOTEL_HOST = 'booking-com15.p.rapidapi.com';

const headers = {
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': HOTEL_HOST,
};

async function searchDestination(city) {
  // 1. CHECK DESTINATION CACHE (PERMANENT)
  try {
    const cached = db.prepare('SELECT dest_id, search_type, name FROM hotel_dest_cache WHERE city_name = ?').get(city);
    if (cached) {
      console.log(`[CACHE HIT] tipo=hotel_dest_cache | key=${city}`);
      return cached;
    }
  } catch (err) {
    console.error('[hotel_dest] Cache check error:', err.message);
  }

  console.log(`[CACHE MISS] tipo=hotel_dest_cache | key=${city}`);

  // 2. API CALL
  try {
    const maskedKey = RAPIDAPI_KEY ? `****${RAPIDAPI_KEY.slice(-4)}` : 'MISSING';
    console.log(`[HOTEL DESTINATION] query=${city} | key=${maskedKey}`);
    
    const { data } = await axios.get(
      'https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination',
      {
        headers,
        params: { query: city },
      }
    );
    const result = data?.data?.[0];
    if (!result) {
      console.log(`[HOTEL DESTINATION FAIL] query=${city}`);
      return null;
    }

    const destData = {
      dest_id: result.dest_id,
      search_type: result.search_type || 'city',
      name: result.name || result.label || city,
    };
    console.log(`[HOTEL DESTINATION SUCCESS] city=${city} | dest_id=${destData.dest_id}`);

    // 3. SAVE DESTINATION CACHE
    db.prepare('INSERT OR REPLACE INTO hotel_dest_cache (city_name, dest_id, search_type, name) VALUES (?, ?, ?, ?)')
      .run(city, destData.dest_id, destData.search_type, destData.name);

    logApiUsage({
      service_name: 'hotel_destination',
      provider: 'Booking.com',
      endpoint: '/searchDestination',
      cache_hit: 0,
      success: 1,
      request_key: city
    });

    return destData;
  } catch (err) {
    console.error(`[HOTEL DESTINATION ERROR] ${city}: ${err.message}`);
    return null;
  }
}

function getRelativeDate(baseDate, days) {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function searchHotels({ destination, days, budget, startDate }) {
  const city = destination.split(',')[0].trim();
  const arrivalDate = startDate || getRelativeDate(null, 30);
  const departureDate = getRelativeDate(arrivalDate, parseInt(days));
  const cacheKey = `hotels-${city}-${arrivalDate}-${departureDate}-${budget}`;

  // 1. CHECK SEARCH CACHE (TTL 24h)
  try {
    const cached = db.prepare('SELECT resultado_json, created_at FROM hotel_search_cache WHERE cache_key = ?').get(cacheKey);
    if (cached) {
      const ageHours = (new Date() - new Date(cached.created_at)) / (1000 * 60 * 60);
      if (ageHours < 24) {
        console.log(`[CACHE HIT] tipo=hotel_search_cache | key=${cacheKey}`);
        return { available: true, data: JSON.parse(cached.resultado_json) };
      }
    }
  } catch (err) {
    console.error('[hotel_search] Cache check error:', err.message);
  }

  console.log(`[CACHE MISS] tipo=hotel_search_cache | key=${cacheKey}`);

  // 2. API CALL
  try {
    const dest = await searchDestination(city);
    if (!dest) {
      return { available: false, reason: 'Destino não encontrado no Booking', data: [] };
    }

    const budgetPerNight = (budget * 0.35) / days;

    console.log(`[HOTEL SEARCH] checkin=${arrivalDate} | checkout=${departureDate} | dest_id=${dest.dest_id}`);

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
    console.log(`[HOTEL SEARCH RESPONSE] total_results=${rawHotels.length}`);

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
        console.log(`[HOTEL ${i+1}] name=${hotelItem.name} | price=BRL ${hotelItem.totalPrice} | rating=${hotelItem.rating}`);
        return hotelItem;
      });

    // 3. SAVE SEARCH CACHE
    if (hotels.length > 0) {
      db.prepare('INSERT OR REPLACE INTO hotel_search_cache (cache_key, resultado_json, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
        .run(cacheKey, JSON.stringify(hotels));
    }

    logApiUsage({
      service_name: 'hotel_search',
      provider: 'Booking.com',
      endpoint: '/searchHotels',
      cache_hit: 0,
      success: 1,
      request_key: cacheKey
    });

    return { available: hotels.length > 0, data: hotels };
  } catch (err) {
    console.error(`[HOTEL SEARCH ERROR] ${city}: ${err.message}`);
    return { available: false, reason: 'Não foi possível consultar hotéis em tempo real. Usamos uma estimativa com base no orçamento.', data: [] };
  }
}

module.exports = { searchHotels };
