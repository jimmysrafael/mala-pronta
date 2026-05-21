require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const airportRoutes = require('./routes/airports');

function parseAllowedOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function originMatchesAllowedOrigin(origin, allowedOrigin) {
  if (allowedOrigin === '*') {
    return true;
  }

  if (!allowedOrigin.includes('*')) {
    return origin === allowedOrigin;
  }

  try {
    const originUrl = new URL(origin);
    const wildcardPrefix = allowedOrigin.includes('://*.') ? `${allowedOrigin.split('://*.')[0]}://*.` : null;
    if (!wildcardPrefix) {
      return false;
    }

    const allowedHostSuffix = allowedOrigin.split('://*.')[1];
    if (!allowedHostSuffix) {
      return false;
    }

    const expectedProtocol = wildcardPrefix.split('://')[0];
    if (originUrl.protocol !== `${expectedProtocol}:`) {
      return false;
    }

    const originHost = originUrl.hostname;
    return originHost.endsWith(`.${allowedHostSuffix}`);
  } catch (_err) {
    return false;
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowedOrigins = parseAllowedOrigins(
  process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173'
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.some((allowedOrigin) => originMatchesAllowedOrigin(origin, allowedOrigin))) {
        return callback(null, true);
      }
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    service: 'malapronta-api',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/airports', airportRoutes);

app.use((err, _req, res, _next) => {
  console.error('[API ERROR]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;
