const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const db = require('../db');
const logger = require('../utils/logger');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  },
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function normalizeCredentials({ email, password }) {
  return {
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
  };
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const { email, password } = normalizeCredentials(req.body || {});

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (name.length < 2 || name.length > 120) {
      return res.status(400).json({ error: 'Nome invalido' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email invalido' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Senha deve ter entre 6 e 128 caracteres' });
    }

    const existing = await db.one('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.one(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?) RETURNING id',
      [name, email, hashedPassword]
    );

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      token,
      user: { id: user.id, name, email },
    });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = normalizeCredentials(req.body || {});

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    if (!isValidEmail(email) || password.length > 128) {
      return res.status(400).json({ error: 'Email ou senha invalidos' });
    }

    const user = await db.one('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
