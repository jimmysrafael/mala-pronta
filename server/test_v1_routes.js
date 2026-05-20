require('dotenv').config();
const { searchFlights } = require('./services/flightService');

async function testRoutes() {
  const routes = [
    {
      label: 'GRU -> GIG',
      origin: { skyId: 'GRU', entityId: '95673332', iataCode: 'GRU', airportName: 'Guarulhos' },
      destination: { skyId: 'GIG', entityId: '95673347', iataCode: 'GIG', airportName: 'Galeão' }
    },
    {
      label: 'MAO -> FLN',
      origin: { skyId: 'MAO', entityId: '95674366', iataCode: 'MAO', airportName: 'Manaus' },
      destination: { skyId: 'FLN', entityId: '95673806', iataCode: 'FLN', airportName: 'Florianópolis' }
    }
  ];

  for (const route of routes) {
    console.log(`\n--- TESTANDO ROTA: ${route.label} ---`);
    const res = await searchFlights({ 
      origin: route.origin, 
      destination: route.destination, 
      days: 3, 
      travelers: 1, 
      startDate: '2026-10-01' 
    });

    console.log('Disponível:', res.available ? '✅ SIM' : '❌ NÃO');
    console.log('Motivo:', res.reason);
    if (res.available) {
      console.log('Ofertas:', res.data.length);
      console.log('Primeiro Preço:', res.data[0].formattedPrice);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

testRoutes();
