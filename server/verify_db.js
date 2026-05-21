require('dotenv').config();
const db = require('./db');

async function verify() {
  console.log('--- VERIFICANDO SCHEMA ---');
  const schema = await db.many(
    `
    SELECT column_name AS name, data_type AS type
    FROM information_schema.columns
    WHERE table_name = 'airports'
    ORDER BY ordinal_position
    `
  );
  schema.forEach((c) => console.log(`- ${c.name} (${c.type})`));

  console.log('\n--- VERIFICANDO DADOS (GRU, GIG, MAO, FLN) ---');
  const data = await db.many(
    'SELECT "iataCode", "skyId", "entityId", "cityName", "airportName", "flightPlaceType", "hotelEntityId" FROM airports WHERE "iataCode" IN (?, ?, ?, ?)',
    ['GRU', 'GIG', 'MAO', 'FLN']
  );

  data.forEach((r) => {
    console.log(`\nIATA: ${r.iataCode}`);
    console.log(`  skyId: ${r.skyId}`);
    console.log(`  entityId: ${r.entityId}`);
    console.log(`  Type: ${r.flightPlaceType}`);
    console.log(`  HotelID: ${r.hotelEntityId}`);
  });
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
