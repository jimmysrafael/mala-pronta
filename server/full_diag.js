require('dotenv').config();
const axios = require('axios');
const key = process.env.RAPIDAPI_KEY;
const host = 'sky-scrapper.p.rapidapi.com';

async function test() {
  try {
    const res = await axios.get('https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport', {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host },
      params: { query: 'GRU', locale: 'en-US' }
    });
    console.log('Response Keys:', Object.keys(res.data));
    console.log('Data:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
    if (e.response) console.log('Response Data:', e.response.data);
  }
}
test();
