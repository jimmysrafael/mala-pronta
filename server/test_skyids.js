require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function testOnlySkyIds() {
  console.log('--- TESTANDO APENAS SKY IDS ---');
  
  const params = {
    originSkyId: 'GRU',
    destinationSkyId: 'GIG',
    date: '2026-10-01',
    adults: 1,
    currency: 'USD',
    market: 'en-US',
    countryCode: 'US'
  };

  try {
    const res = await axios.get(`https://${HOST}/api/v2/flights/searchFlights`, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': HOST
      },
      params
    });

    console.log(`Status: ${res.status}`);
    console.log(`Body Status: ${res.data?.status}`);
    console.log(`Body Message: ${res.data?.message || 'N/A'}`);
    console.log(`Itineraries: ${res.data?.data?.itineraries?.length || 0}`);
  } catch (err) {
    console.log(`Erro: ${err.message}`);
  }
}

testOnlySkyIds();
