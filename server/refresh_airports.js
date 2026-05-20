require('dotenv').config();
const db = require('./db');
const { searchAirports } = require('./services/airportService');

async function refresh() {
  console.log('🗑️ Removendo aeroportos antigos do banco...');
  db.prepare("DELETE FROM airports WHERE iataCode IN ('GRU', 'GIG', 'MAO', 'FLN')").run();
  
  const targets = ['GRU', 'GIG', 'MAO', 'FLN'];
  for (const t of targets) {
    console.log(`\n🔍 Buscando ${t} via API...`);
    const results = await searchAirports(t);
    if (results.length > 0) {
      const best = results[0];
      console.log(`✅ ${t} -> ID: ${best.entityId} (${best.airportName})`);
      console.log(`   Type: ${best.type} | HotelID: ${best.hotelEntityId}`);
    } else {
      console.log(`❌ ${t} não encontrado.`);
    }
    // Delay para evitar rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✨ Refresh concluído!');
}

refresh();
