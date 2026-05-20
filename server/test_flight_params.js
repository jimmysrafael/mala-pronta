require('dotenv').config();
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HOST = 'sky-scrapper.p.rapidapi.com';

const configs = [
  { name: 'A) Defaults (USD/US)', currency: 'USD', market: 'en-US', countryCode: 'US' },
  { name: 'B) BRL + en-US/US', currency: 'BRL', market: 'en-US', countryCode: 'US' },
  { name: 'C) Brasil (BRL/pt-BR/BR)', currency: 'BRL', market: 'pt-BR', countryCode: 'BR' }
];

const routes = [
  { from: 'SAOA', fromId: '27539772', to: 'MAO', toId: '95674366', label: 'Sao Paulo -> Manaus' }
];

async function runTests() {
  const date = '2026-10-01';

  for (const route of routes) {
    console.log(`\n\n==== TESTANDO ROTA: ${route.label} ====`);
    
    for (const config of configs) {
      console.log(`\n--- Testando Config: ${config.name} ---`);
      
      const params = {
        originSkyId: route.from,
        destinationSkyId: route.to,
        originEntityId: route.fromId,
        destinationEntityId: route.toId,
        date,
        adults: 1,
        currency: config.currency,
        market: config.market,
        countryCode: config.countryCode
      };

      try {
        const res = await axios.get(`https://${HOST}/api/v2/flights/searchFlights`, {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': HOST
          },
          params,
          timeout: 10000
        });

        console.log(`Status: ${res.status}`);
        console.log(`Body Status: ${res.data?.status}`);
        console.log(`Body Message: ${res.data?.message || 'N/A'}`);
        
        const itineraries = res.data?.data?.itineraries || [];
        console.log(`Itinerários: ${itineraries.length}`);
        
        if (itineraries.length > 0) {
          console.log(`✅ SUCESSO! Preço: ${JSON.stringify(itineraries[0].price)}`);
        } else {
          console.log(`❌ FALHA: Nenhum itinerário.`);
        }

      } catch (err) {
        console.log(`❌ ERRO: ${err.response?.status} - ${JSON.stringify(err.response?.data) || err.message}`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

runTests();
