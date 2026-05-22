require('dotenv').config();

const { Pool } = require('pg');
const logger = require('./utils/logger');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL (ou POSTGRES_URL) precisa estar configurada para usar Postgres.');
}

function shouldUseSsl(url) {
  const mode = String(process.env.PGSSLMODE || process.env.DATABASE_SSL || '').toLowerCase();
  if (mode === 'disable' || mode === 'false' || mode === '0') return false;
  if (mode === 'require' || mode === 'true' || mode === '1') return { rejectUnauthorized: false };
  if (/localhost|127\.0\.0\.1|::1/.test(url)) return false;
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString,
  ssl: shouldUseSsl(connectionString),
  max: Number(process.env.PGPOOL_MAX || 10),
});

pool.on('error', (err) => {
  logger.error('[PG POOL ERROR]', err);
});

function toPgSql(sql) {
  let index = 0;
  return String(sql).replace(/\?/g, () => `$${++index}`);
}

async function query(sql, params = [], client = pool) {
  const text = toPgSql(sql);
  return client.query(text, params);
}

async function many(sql, params = [], client = pool) {
  const result = await query(sql, params, client);
  return result.rows;
}

async function one(sql, params = [], client = pool) {
  const result = await query(sql, params, client);
  return result.rows[0] || null;
}

async function run(sql, params = [], client = pool) {
  const result = await query(sql, params, client);
  return {
    rowCount: result.rowCount,
    lastInsertRowid: result.rows[0]?.id ?? null,
    rows: result.rows,
  };
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = {
      query: (sql, params = []) => query(sql, params, client),
      many: (sql, params = []) => many(sql, params, client),
      one: (sql, params = []) => one(sql, params, client),
      run: (sql, params = []) => run(sql, params, client),
    };
    const result = await work(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackErr) {
      // ignore rollback failures
    }
    throw err;
  } finally {
    client.release();
  }
}

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

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function createSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trips (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      destination TEXT NOT NULL,
      days INTEGER NOT NULL,
      budget DOUBLE PRECISION NOT NULL,
      itinerary JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS monetization_accounts (
      owner_key TEXT PRIMARY KEY,
      user_id BIGINT UNIQUE,
      free_consults_remaining INTEGER NOT NULL DEFAULT 1,
      reward_credits INTEGER NOT NULL DEFAULT 0,
      paid_credits INTEGER NOT NULL DEFAULT 0,
      total_consultations INTEGER NOT NULL DEFAULT 0,
      total_reward_unlocks INTEGER NOT NULL DEFAULT 0,
      total_paid_credits_added INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS airports (
      id BIGSERIAL PRIMARY KEY,
      "skyId" TEXT UNIQUE NOT NULL,
      "entityId" TEXT NOT NULL,
      "cityName" TEXT NOT NULL,
      "airportName" TEXT NOT NULL,
      "iataCode" TEXT NOT NULL UNIQUE,
      subtitle TEXT NOT NULL,
      "cityNameNormalized" TEXT,
      "flightPlaceType" TEXT,
      "hotelEntityId" TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trip_cache (
      id BIGSERIAL PRIMARY KEY,
      cache_key TEXT UNIQUE NOT NULL,
      resultado_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS flight_cache (
      id BIGSERIAL PRIMARY KEY,
      cache_key TEXT UNIQUE NOT NULL,
      resultado_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS hotel_dest_cache (
      id BIGSERIAL PRIMARY KEY,
      city_name TEXT UNIQUE NOT NULL,
      dest_id TEXT NOT NULL,
      search_type TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS hotel_search_cache (
      id BIGSERIAL PRIMARY KEY,
      cache_key TEXT UNIQUE NOT NULL,
      resultado_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS attraction_cache (
      id BIGSERIAL PRIMARY KEY,
      city_name TEXT UNIQUE NOT NULL,
      resultado_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS weather_cache (
      id BIGSERIAL PRIMARY KEY,
      city_name TEXT UNIQUE NOT NULL,
      resultado_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id BIGSERIAL PRIMARY KEY,
      service_name TEXT,
      provider TEXT,
      endpoint TEXT,
      cache_hit INTEGER DEFAULT 0,
      success INTEGER DEFAULT 1,
      status_code INTEGER,
      error_message TEXT,
      request_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_airports_search ON airports ("cityName", "iataCode", "airportName")`);
  await query(`CREATE INDEX IF NOT EXISTS idx_airports_normalized ON airports ("cityNameNormalized")`);
  await query(`CREATE INDEX IF NOT EXISTS idx_trip_cache_key ON trip_cache (cache_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_flight_cache_key ON flight_cache (cache_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_hotel_search_cache_key ON hotel_search_cache (cache_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_monetization_accounts_user_id ON monetization_accounts (user_id)`);
}

async function seedAirportsIfNeeded() {
  const countRow = await one('SELECT COUNT(*)::int AS count FROM airports');
  if ((countRow?.count || 0) > 0) {
    return;
  }

  const insertAirportSql = `
    INSERT INTO airports (
      "skyId",
      "entityId",
      "cityName",
      "airportName",
      "iataCode",
      subtitle,
      "cityNameNormalized",
      "flightPlaceType",
      "hotelEntityId"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT ("skyId") DO UPDATE SET
      "entityId" = EXCLUDED."entityId",
      "cityName" = EXCLUDED."cityName",
      "airportName" = EXCLUDED."airportName",
      "iataCode" = EXCLUDED."iataCode",
      subtitle = EXCLUDED.subtitle,
      "cityNameNormalized" = EXCLUDED."cityNameNormalized",
      "flightPlaceType" = EXCLUDED."flightPlaceType",
      "hotelEntityId" = EXCLUDED."hotelEntityId"
  `;

  await transaction(async (tx) => {
    for (const airport of commonAirports) {
      await tx.run(insertAirportSql, [
        airport[0],
        airport[1],
        airport[2],
        airport[3],
        airport[4],
        airport[5],
        normalize(airport[2]),
        'AIRPORT',
        null,
      ]);
    }
  });

  logger.info('Base de aeroportos inicializada com sucesso.');
}

let initPromise = null;

async function initDb() {
  if (!initPromise) {
    initPromise = (async () => {
      await createSchema();
      await seedAirportsIfNeeded();
    })();
  }

  return initPromise;
}

module.exports = {
  pool,
  query,
  many,
  one,
  run,
  transaction,
  initDb,
};
