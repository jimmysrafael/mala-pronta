require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function testV1() {
  console.log('--- TESTANDO API V1 ---');
  
  const params = {
    originSkyId: 'GRU',
    destinationSkyId: 'GIG',
    date: '2026-10-01',
    adults: 1,
    currency: 'USD'
  };

  try {
    const res = await axios.get(`https://${HOST}/api/v1/flights/searchFlights`, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': HOST
      },
      params
    });

    console.log(`Status: ${res.status}`);
    console.log(`Itineraries: ${res.data?.data?.itineraries?.length || 0}`);
    console.log(`Message: ${res.data?.message || 'N/A'}`);
  } catch (err) {
    console.log(`Erro: ${err.message}`);
  }
}

testV1();
