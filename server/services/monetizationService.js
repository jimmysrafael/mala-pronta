const crypto = require('crypto');
const db = require('../db');

const REWARD_CREDITS_PER_SESSION = Number(process.env.REWARD_CREDITS_PER_SESSION || 2);
const REWARD_SESSION_TTL_MS = Number(process.env.REWARD_SESSION_TTL_MS || 15 * 60 * 1000);
const MONETIZATION_MODE = String(process.env.MONETIZATION_MODE || 'rewarded').toLowerCase();

const rewardSessions = new Map();

function getOwnerKeyFromRequest(req = {}) {
  if (req.userId) {
    return `user:${req.userId}`;
  }

  const visitorId = String(req.headers?.['x-visitor-id'] || '').trim();
  if (visitorId) {
    return `visitor:${visitorId}`;
  }

  const ip = String(req.ip || req.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  return `ip:${ip || 'unknown'}`;
}

function normalizeAccountRow(row) {
  if (!row) return null;

  return {
    ownerKey: row.owner_key,
    userId: row.user_id,
    freeConsultsRemaining: Number(row.free_consults_remaining || 0),
    rewardCredits: Number(row.reward_credits || 0),
    paidCredits: Number(row.paid_credits || 0),
    totalConsultations: Number(row.total_consultations || 0),
    totalRewardUnlocks: Number(row.total_reward_unlocks || 0),
    totalPaidCreditsAdded: Number(row.total_paid_credits_added || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getAvailableConsultations(account) {
  if (!account) return 0;
  return (
    Number(account.freeConsultsRemaining || 0) +
    Number(account.rewardCredits || 0) +
    Number(account.paidCredits || 0)
  );
}

async function ensureAccount(ownerKey, userId = null, tx = db) {
  await tx.run(
    `
      INSERT INTO monetization_accounts (owner_key, user_id)
      VALUES (?, ?)
      ON CONFLICT (owner_key) DO UPDATE SET
        user_id = COALESCE(EXCLUDED.user_id, monetization_accounts.user_id),
        updated_at = NOW()
    `,
    [ownerKey, userId]
  );

  const account = await tx.one(
    'SELECT * FROM monetization_accounts WHERE owner_key = ?',
    [ownerKey]
  );

  return normalizeAccountRow(account);
}

function cleanupRewardSessions() {
  const now = Date.now();
  for (const [sessionId, session] of rewardSessions.entries()) {
    if (!session || session.expiresAt <= now) {
      rewardSessions.delete(sessionId);
    }
  }
}

function createRewardSession(ownerKey, payload = {}) {
  cleanupRewardSessions();

  const sessionId = crypto.randomUUID();
  const session = {
    sessionId,
    ownerKey,
    unlockCredits: Number(payload.unlockCredits || REWARD_CREDITS_PER_SESSION),
    provider: String(payload.provider || MONETIZATION_MODE),
    createdAt: Date.now(),
    expiresAt: Date.now() + REWARD_SESSION_TTL_MS,
  };

  rewardSessions.set(sessionId, session);
  return {
    sessionId,
    unlockCredits: session.unlockCredits,
    provider: session.provider,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

function readRewardSession(sessionId) {
  cleanupRewardSessions();
  const session = rewardSessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    rewardSessions.delete(sessionId);
    return null;
  }

  return session;
}

function removeRewardSession(sessionId) {
  rewardSessions.delete(sessionId);
}

async function getWalletStatus(req) {
  const ownerKey = getOwnerKeyFromRequest(req);
  const userId = req.userId || null;
  const account = await ensureAccount(ownerKey, userId);

  return {
    ownerKey,
    mode: MONETIZATION_MODE,
    availableConsultations: getAvailableConsultations(account),
    account,
    offers: buildOffers(),
  };
}

function buildOffers() {
  const monthlyUrl = String(process.env.MONETIZATION_MONTHLY_URL || '').trim();
  const creditsUrl = String(process.env.MONETIZATION_CREDITS_URL || '').trim();

  return {
    rewarded: {
      label: 'Assistir anuncio',
      description: `Libera ${REWARD_CREDITS_PER_SESSION} consultas extras por recompensa.`,
      enabled: true,
      action: 'reward',
    },
    monthly: {
      label: 'Plano mensal',
      description: 'Acesso recorrente com mais consultas e menos atrito.',
      enabled: Boolean(monthlyUrl),
      url: monthlyUrl || '',
      action: monthlyUrl ? 'checkout' : 'coming_soon',
    },
    credits: {
      label: 'Pacote de consultas',
      description: 'Compre blocos extras para usar quando quiser.',
      enabled: Boolean(creditsUrl),
      url: creditsUrl || '',
      action: creditsUrl ? 'checkout' : 'coming_soon',
    },
  };
}

async function consumeConsultation(req) {
  const ownerKey = getOwnerKeyFromRequest(req);
  const userId = req.userId || null;

  return db.transaction(async (tx) => {
    const account = await ensureAccount(ownerKey, userId, tx);
    const current = await tx.one(
      'SELECT * FROM monetization_accounts WHERE owner_key = ? FOR UPDATE',
      [ownerKey]
    );

    if (!current) {
      throw new Error('Falha ao carregar o saldo de consultas.');
    }

    const normalized = normalizeAccountRow(current);

    let source = null;
    let updateSql = null;

    if (normalized.freeConsultsRemaining > 0) {
      source = 'free';
      updateSql = `
        UPDATE monetization_accounts
        SET free_consults_remaining = free_consults_remaining - 1,
            total_consultations = total_consultations + 1,
            updated_at = NOW()
        WHERE owner_key = ?
      `;
    } else if (normalized.rewardCredits > 0) {
      source = 'reward';
      updateSql = `
        UPDATE monetization_accounts
        SET reward_credits = reward_credits - 1,
            total_consultations = total_consultations + 1,
            updated_at = NOW()
        WHERE owner_key = ?
      `;
    } else if (normalized.paidCredits > 0) {
      source = 'paid';
      updateSql = `
        UPDATE monetization_accounts
        SET paid_credits = paid_credits - 1,
            total_consultations = total_consultations + 1,
            updated_at = NOW()
        WHERE owner_key = ?
      `;
    } else {
      return {
        allowed: false,
        ownerKey,
        account: normalized,
        availableConsultations: 0,
        offers: buildOffers(),
      };
    }

    await tx.run(updateSql, [ownerKey]);

    const updatedAccount = await tx.one(
      'SELECT * FROM monetization_accounts WHERE owner_key = ?',
      [ownerKey]
    );

    return {
      allowed: true,
      ownerKey,
      source,
      account: normalizeAccountRow(updatedAccount || account),
      availableConsultations: getAvailableConsultations(normalizeAccountRow(updatedAccount || account)),
      offers: buildOffers(),
    };
  });
}

async function refundConsultation(req, source) {
  if (!source) {
    return null;
  }

  const ownerKey = getOwnerKeyFromRequest(req);
  const userId = req.userId || null;

  return db.transaction(async (tx) => {
    await ensureAccount(ownerKey, userId, tx);

    const account = await tx.one(
      'SELECT * FROM monetization_accounts WHERE owner_key = ? FOR UPDATE',
      [ownerKey]
    );

    if (!account) {
      return null;
    }

    const sqlBySource = {
      free: `
        UPDATE monetization_accounts
        SET free_consults_remaining = free_consults_remaining + 1,
            total_consultations = GREATEST(total_consultations - 1, 0),
            updated_at = NOW()
        WHERE owner_key = ?
      `,
      reward: `
        UPDATE monetization_accounts
        SET reward_credits = reward_credits + 1,
            total_consultations = GREATEST(total_consultations - 1, 0),
            updated_at = NOW()
        WHERE owner_key = ?
      `,
      paid: `
        UPDATE monetization_accounts
        SET paid_credits = paid_credits + 1,
            total_consultations = GREATEST(total_consultations - 1, 0),
            updated_at = NOW()
        WHERE owner_key = ?
      `,
    };

    const sql = sqlBySource[source];
    if (!sql) {
      return null;
    }

    await tx.run(sql, [ownerKey]);

    const updatedAccount = await tx.one(
      'SELECT * FROM monetization_accounts WHERE owner_key = ?',
      [ownerKey]
    );

    return normalizeAccountRow(updatedAccount);
  });
}

async function claimRewardSession(req, sessionId, provider = MONETIZATION_MODE) {
  const ownerKey = getOwnerKeyFromRequest(req);
  const session = readRewardSession(sessionId);

  if (!session) {
    return { error: 'Sessao de recompensa expirada ou invalida.' };
  }

  if (session.ownerKey !== ownerKey) {
    return { error: 'Essa recompensa pertence a outro usuario.' };
  }

  if (provider && session.provider !== provider) {
    return { error: 'Fornecedor de recompensa invalido.' };
  }

  return db.transaction(async (tx) => {
    await ensureAccount(ownerKey, req.userId || null, tx);

    const account = await tx.one(
      'SELECT * FROM monetization_accounts WHERE owner_key = ? FOR UPDATE',
      [ownerKey]
    );

    if (!account) {
      return { error: 'Conta de monetizacao nao encontrada.' };
    }

    const unlockCredits = Number(session.unlockCredits || REWARD_CREDITS_PER_SESSION);

    await tx.run(
      `
        UPDATE monetization_accounts
        SET reward_credits = reward_credits + ?,
            total_reward_unlocks = total_reward_unlocks + 1,
            updated_at = NOW()
        WHERE owner_key = ?
      `,
      [unlockCredits, ownerKey]
    );

    removeRewardSession(sessionId);

    const updatedAccount = await tx.one(
      'SELECT * FROM monetization_accounts WHERE owner_key = ?',
      [ownerKey]
    );

    return {
      ownerKey,
      sessionId,
      unlockedCredits: unlockCredits,
      account: normalizeAccountRow(updatedAccount),
      availableConsultations: getAvailableConsultations(normalizeAccountRow(updatedAccount)),
      offers: buildOffers(),
    };
  });
}

function issueRewardSession(req, payload = {}) {
  const ownerKey = getOwnerKeyFromRequest(req);
  return createRewardSession(ownerKey, payload);
}

module.exports = {
  buildOffers,
  claimRewardSession,
  consumeConsultation,
  ensureAccount,
  getAvailableConsultations,
  getOwnerKeyFromRequest,
  getWalletStatus,
  issueRewardSession,
  refundConsultation,
};
