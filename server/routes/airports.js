const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { searchAirports } = require('../services/airportService');
const optionalAuth = require('../middleware/optionalAuth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(optionalAuth);

const airportSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req, res) => (req.userId ? String(req.userId) : ipKeyGenerator(req, res)),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Muitas buscas. Tente novamente em instantes.' });
  },
});

router.get('/search', airportSearchLimiter, async (req, res) => {
  try {
    const { q } = req.query;
    const query = String(q || '').trim();
    if (query.length < 2) return res.json([]);
    if (query.length > 80) {
      return res.status(400).json({ error: 'Busca muito longa' });
    }
    
    const results = await searchAirports(query);
    res.json(results);
  } catch (err) {
    logger.error('[Route Error] /airports/search:', err);
    res.json([]);
  }
});

module.exports = router;
