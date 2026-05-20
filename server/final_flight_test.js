require('dotenv').config();
const { searchFlights } = require('./services/flightService');

async function finalTest() {
  const origin = { skyId: 'GRU', entityId: '95673332', iataCode: 'GRU' };
  const destination = { skyId: 'GIG', entityId: '95673347', iataCode: 'GIG' };
  
  console.log('--- TESTE FINAL: GRU -> GIG ---');
  const res = await searchFlights({ origin, destination, days: 3, travelers: 1, startDate: '2026-10-01' });
  
  console.log('Status Final:', res.available ? '✅ SUCESSO' : '❌ FALHA');
  console.log('Motivo:', res.reason);
  if (res.available) {
    console.log('Preço do primeiro voo:', res.data[0].price.formatted);
  }
}

finalTest();
