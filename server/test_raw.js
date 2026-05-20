require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function testRaw() {
  const params = {
    originSkyId: 'GRU',
    destinationSkyId: 'GIG',
    originEntityId: '95673332',
    destinationEntityId: '95674257',
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
    console.log('RAW RESPONSE:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('ERROR:', JSON.stringify(err.response?.data, null, 2));
  }
}
testRaw();
