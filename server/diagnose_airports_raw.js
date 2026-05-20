require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

async function diagnoseRaw(query) {
  console.log(`\n--- BUSCANDO: ${query} ---`);
  try {
    const res = await axios.get(`https://${HOST}/api/v1/flights/searchAirport`, {
      headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
      params: { query, locale: 'en-US' }
    });

    const data = res.data?.data || [];
    data.forEach((item, index) => {
      console.log(`\n[${index}] ${item.presentation?.suggestionTitle}`);
      console.log(`   SkyID: ${item.skyId}`);
      console.log(`   EntityID: ${item.entityId}`);
      console.log(`   EntityType: ${item.navigation?.entityType}`);
      console.log(`   Title: ${item.presentation?.title}`);
      console.log(`   Subtitle: ${item.presentation?.subtitle}`);
      console.log(`   Relevant Flight Params:`, JSON.stringify(item.navigation?.relevantFlightParams));
    });
  } catch (err) {
    console.error(`Erro ao buscar ${query}:`, err.message);
  }
}

async function run() {
  await diagnoseRaw('GRU');
  await diagnoseRaw('GIG');
  await diagnoseRaw('MAO');
  await diagnoseRaw('FLN');
}

run();
