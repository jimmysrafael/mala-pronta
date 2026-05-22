const express = require('express');
const optionalAuth = require('../middleware/optionalAuth');
const {
  claimRewardSession,
  getWalletStatus,
  issueRewardSession,
} = require('../services/monetizationService');

const router = express.Router();

router.get('/status', optionalAuth, async (req, res) => {
  try {
    const status = await getWalletStatus(req);
    res.json(status);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao consultar saldo de consultas.' });
  }
});

router.post('/reward-session', optionalAuth, async (req, res) => {
  try {
    const unlockCredits = Number(req.body?.unlockCredits || 2);
    const session = issueRewardSession(req, {
      unlockCredits: Number.isFinite(unlockCredits) && unlockCredits > 0 ? unlockCredits : 2,
      provider: req.body?.provider,
    });

    res.status(201).json({
      ...session,
      message: 'Sessao de recompensa criada com sucesso.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Nao foi possivel iniciar a recompensa.' });
  }
});

router.post('/reward-claim', optionalAuth, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    const provider = String(req.body?.provider || '').trim();

    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId e obrigatorio.' });
    }

    const result = await claimRewardSession(req, sessionId, provider);

    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      ...result,
      message: `Recompensa confirmada. ${result.unlockedCredits} consultas foram liberadas.`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Nao foi possivel validar a recompensa.' });
  }
});

module.exports = router;
