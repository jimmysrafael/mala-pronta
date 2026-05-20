const express = require('express');
const { searchAirports } = require('../services/airportService');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();
router.use(optionalAuth);

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    
    const results = await searchAirports(q);
    res.json(results);
  } catch (err) {
    console.error('[Route Error] /airports/search:', err.message);
    res.json([]);
  }
});

module.exports = router;
