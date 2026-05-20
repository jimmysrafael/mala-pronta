const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'malapronta.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    destination TEXT NOT NULL,
    days INTEGER NOT NULL,
    budget REAL NOT NULL,
    itinerary TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skyId TEXT UNIQUE NOT NULL,
    entityId TEXT NOT NULL,
    cityName TEXT NOT NULL,
    airportName TEXT NOT NULL,
    iataCode TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    cityNameNormalized TEXT,
    flightPlaceType TEXT,
    hotelEntityId TEXT
  );

  -- TABELAS DE CACHE PARA BLINDAGEM DE API
  CREATE TABLE IF NOT EXISTS trip_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    resultado_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flight_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    resultado_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS hotel_dest_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_name TEXT UNIQUE NOT NULL,
    dest_id TEXT NOT NULL,
    search_type TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS hotel_search_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    resultado_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attraction_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_name TEXT UNIQUE NOT NULL,
    resultado_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS weather_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_name TEXT UNIQUE NOT NULL,
    resultado_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT,
    provider TEXT,
    endpoint TEXT,
    cache_hit INTEGER DEFAULT 0,
    success INTEGER DEFAULT 1,
    status_code INTEGER,
    error_message TEXT,
    request_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_airports_search ON airports (cityName, iataCode, airportName);
  CREATE INDEX IF NOT EXISTS idx_trip_cache_key ON trip_cache (cache_key);
`);

// MIGRATION: Garantir que a coluna 'name' existe em hotel_dest_cache
try {
  const tableInfo = db.prepare("PRAGMA table_info(hotel_dest_cache)").all();
  const hasName = tableInfo.some(col => col.name === 'name');
  if (!hasName) {
    console.log('📦 Migração: Adicionando coluna "name" em hotel_dest_cache...');
    db.exec('ALTER TABLE hotel_dest_cache ADD COLUMN name TEXT NOT NULL DEFAULT ""');
    console.log('✅ Migração concluída.');
  }
} catch (err) {
  console.error('❌ Erro na migração do banco:', err.message);
}

// Carga inicial de aeroportos (Seed)
const commonAirports = [
  ['GRU', '95565050', 'São Paulo', 'Aeroporto Internacional de Guarulhos', 'GRU', 'Brasil'],
  ['CGH', '95565051', 'São Paulo', 'Aeroporto de Congonhas', 'CGH', 'Brasil'],
  ['GIG', '95673636', 'Rio de Janeiro', 'Aeroporto Internacional Tom Jobim', 'GIG', 'Brasil'],
  ['SDU', '95673635', 'Rio de Janeiro', 'Aeroporto Santos Dumont', 'SDU', 'Brasil'],
  ['BSB', '95673637', 'Brasília', 'Aeroporto Internacional de Brasília', 'BSB', 'Brasil'],
  ['CNF', '95673638', 'Belo Horizonte', 'Aeroporto Internacional de Confins', 'CNF', 'Brasil'],
  ['MAO', '95674366', 'Manaus', 'Aeroporto Internacional Eduardo Gomes', 'MAO', 'Brasil'],
  ['SSA', '95673640', 'Salvador', 'Aeroporto Internacional de Salvador', 'SSA', 'Brasil'],
  ['FOR', '95673641', 'Fortaleza', 'Aeroporto Internacional Pinto Martins', 'FOR', 'Brasil'],
  ['LIS', '95565052', 'Lisboa', 'Aeroporto Humberto Delgado', 'LIS', 'Portugal'],
  ['CDG', '95565053', 'Paris', 'Aeroporto Charles de Gaulle', 'CDG', 'França'],
  ['JFK', '95565054', 'Nova York', 'Aeroporto Internacional John F. Kennedy', 'JFK', 'EUA'],
  ['MIA', '95565055', 'Miami', 'Aeroporto Internacional de Miami', 'MIA', 'EUA'],
  ['MCO', '95565056', 'Orlando', 'Aeroporto Internacional de Orlando', 'MCO', 'EUA'],
  ['EZE', '95565040', 'Buenos Aires', 'Aeroporto Internacional Ezeiza', 'EZE', 'Argentina'],
  ['NRT', '95565034', 'Tóquio', 'Aeroporto Internacional Narita', 'NRT', 'Japão'],
];

const insertAirport = db.prepare('INSERT OR IGNORE INTO airports (skyId, entityId, cityName, airportName, iataCode, subtitle, cityNameNormalized, flightPlaceType, hotelEntityId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const count = db.prepare('SELECT COUNT(*) as count FROM airports').get();

const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

if (count.count === 0) {
  const transaction = db.transaction((airports) => {
    for (const airport of airports) {
      const normalized = normalize(airport[2]);
      // Seed data doesn't have flightPlaceType/hotelEntityId yet, so passing null or 'AIRPORT'
      insertAirport.run(...airport, normalized, 'AIRPORT', null);
    }
  });
  transaction(commonAirports);
  console.log('✅ Base de aeroportos inicializada com sucesso.');
}

module.exports = db;
