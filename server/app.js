require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const monetizationRoutes = require('./routes/monetization');
const airportRoutes = require('./routes/airports');
const logger = require('./utils/logger');

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
app.use(helmet());

const isProduction = process.env.NODE_ENV === 'production';
const allowPreviewOrigins = process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true';
const corsCredentials = process.env.CORS_CREDENTIALS === 'true';

const allowedOrigins = [
  ...parseAllowedOrigins(process.env.CORS_ORIGIN),
  ...parseAllowedOrigins(process.env.CLIENT_URL),
  ...(isProduction ? ['https://mala-pronta-eight.vercel.app'] : ['http://localhost:5173']),
].filter((origin, index, origins) => origins.indexOf(origin) === index);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.some((allowedOrigin) => {
        if (isProduction && allowedOrigin.includes('*') && !allowPreviewOrigins) {
          return false;
        }

        return originMatchesAllowedOrigin(origin, allowedOrigin);
      })) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: corsCredentials,
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'mala-pronta-api',
    message: 'API online',
  });
});

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
app.use('/api/monetization', monetizationRoutes);
app.use('/api/airports', airportRoutes);

app.use((err, _req, res, _next) => {
  logger.error('[API ERROR]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;
