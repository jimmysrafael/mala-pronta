require('dotenv').config();
const axios = require('axios');
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function checkIds() {
  const query = async (q) => {
    const res = await axios.get(`https://${HOST}/api/v1/flights/searchAirport`, {
      headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
      params: { query: q, locale: 'en-US' }
    });
    return res.data.data;
  };

  const results = await query('Tom Jobim');
  console.log('Results:', JSON.stringify(results, null, 2));
}
checkIds();
