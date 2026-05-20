require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function testCityIds() {
  console.log('--- TESTANDO IDS DE CIDADE (SAOA -> RIOA) ---');
  
  const params = {
    originSkyId: 'SAOA',
    destinationSkyId: 'RIOA',
    originEntityId: '27539772',
    destinationEntityId: '27541837',
    date: '2026-10-01',
    adults: 1,
    currency: 'USD',
    market: 'en-US',
    countryCode: 'US'
  };

  try {
    const res = await axios.get(`https://${HOST}/api/v2/flights/searchFlights`, {
      headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
      params
    });

    console.log('RESPONSE:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('ERROR:', JSON.stringify(err.response?.data, null, 2));
  }
}

testCityIds();
