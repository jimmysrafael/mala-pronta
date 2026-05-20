require('dotenv').config();
const axios = require('axios');
const key = process.env.RAPIDAPI_KEY;
const host = 'sky-scrapper.p.rapidapi.com';

async function getFLN() {
  const res = await axios.get('https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport', {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host },
    params: { query: 'FLN', locale: 'pt-BR' }
  });
  console.log(JSON.stringify(res.data.data[0], null, 2));
}
getFLN();
