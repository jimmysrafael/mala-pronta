const db = require('./db');

function verify() {
  console.log('--- VERIFICANDO SCHEMA ---');
  const schema = db.prepare("PRAGMA table_info(airports)").all();
  schema.forEach(c => console.log(`- ${c.name} (${c.type})`));

  console.log('\n--- VERIFICANDO DADOS (GRU, GIG, MAO, FLN) ---');
  const data = db.prepare("SELECT iataCode, skyId, entityId, cityName, airportName, flightPlaceType, hotelEntityId FROM airports WHERE iataCode IN ('GRU', 'GIG', 'MAO', 'FLN')").all();
  data.forEach(r => {
    console.log(`\nIATA: ${r.iataCode}`);
    console.log(`  skyId: ${r.skyId}`);
    console.log(`  entityId: ${r.entityId}`);
    console.log(`  Type: ${r.flightPlaceType}`);
    console.log(`  HotelID: ${r.hotelEntityId}`);
  });
}

verify();
