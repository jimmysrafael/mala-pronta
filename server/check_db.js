const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'malapronta.db');
const db = new Database(dbPath);

try {
    const tableInfo = db.prepare("PRAGMA table_info(hotel_dest_cache)").all();
    console.log('--- Colunas em hotel_dest_cache ---');
    tableInfo.forEach(col => {
        console.log(`Campo: ${col.name}, Tipo: ${col.type}`);
    });

    const airports = db.prepare("SELECT * FROM airports WHERE iataCode IN ('MAO', 'FLN')").all();
    console.log('\n--- Aeroportos MAO e FLN no Banco ---');
    console.table(airports);

} catch (err) {
    console.error('Erro ao verificar banco:', err.message);
}
