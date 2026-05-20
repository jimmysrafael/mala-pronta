require('dotenv').config();
const { searchFlights } = require('./services/flightService');

async function cityIdTest() {
  // GRU (Airport) but using SAOA (City) ID
  const origin = { skyId: 'GRU', entityId: '27539772', iataCode: 'GRU' };
  // GIG (Airport) but using RIOA (City) ID
  const destination = { skyId: 'GIG', entityId: '27541837', iataCode: 'GIG' };
  
  console.log('--- TESTE CITY ID: GRU -> GIG ---');
  const res = await searchFlights({ origin, destination, days: 3, travelers: 1, startDate: '2026-10-01' });
  
  console.log('Status:', res.available ? '✅ SUCESSO' : '❌ FALHA');
  console.log('Motivo:', res.reason);
}

cityIdTest();
