require('dotenv').config();
const db = require('./db');

async function main() {
  try {
    const tableInfo = await db.many(
      `
      SELECT column_name AS name, data_type AS type
      FROM information_schema.columns
      WHERE table_name = 'hotel_dest_cache'
      ORDER BY ordinal_position
      `
    );

    console.log('--- Colunas em hotel_dest_cache ---');
    tableInfo.forEach((col) => {
      console.log(`Campo: ${col.name}, Tipo: ${col.type}`);
    });

    const airports = await db.many(
      'SELECT * FROM airports WHERE "iataCode" IN (?, ?)',
      ['MAO', 'FLN']
    );

    console.log('\n--- Aeroportos MAO e FLN no Banco ---');
    console.table(airports);
  } catch (err) {
    console.error('Erro ao verificar banco:', err.message);
  } finally {
    process.exit(0);
  }
}

main();
