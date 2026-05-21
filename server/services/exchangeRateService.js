const axios = require('axios');
const logger = require('../utils/logger');

let cachedRate = null;
let lastFetch = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 horas
const FALLBACK_RATE = parseFloat(process.env.USD_BRL_FALLBACK) || 4.98;

async function getUSDBRLRate() {
  const now = Date.now();
  
  if (cachedRate && (now - lastFetch < CACHE_DURATION)) {
    return { rate: cachedRate, isFallback: false };
  }

  try {
    // Usando AwesomeAPI (pública e sem chave para USD-BRL)
    const response = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL', { timeout: 3000 });
    const rate = parseFloat(response.data.USDBRL.bid);
    
    if (rate && !isNaN(rate)) {
      cachedRate = rate;
      lastFetch = now;
      logger.debug(`[EXCHANGE] Cotação atualizada: 1 USD = ${rate} BRL`);
      return { rate, isFallback: false };
    }
  } catch (error) {
    logger.error('[EXCHANGE] Erro ao buscar cotação. Usando fallback.', error);
  }

  return { rate: FALLBACK_RATE, isFallback: true };
}

module.exports = { getUSDBRLRate };
