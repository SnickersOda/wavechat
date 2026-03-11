const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 32 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6, max: 128 }),
  body('displayName').trim().isLength({ min: 1, max: 64 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const { username, email, password, displayName } = req.body;
  const db = getDB();

  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, email, passwordHash, displayName);

    const token = generateToken(userId);
    const user = db.prepare('SELECT id, username, email, display_name, avatar, status, bio, created_at FROM users WHERE id = ?').get(userId);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('login').trim().notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed' });
  }

  const { login, password } = req.body;
  const db = getDB();

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_banned) return res.status(403).json({ error: `Account banned: ${user.ban_reason || 'No reason provided'}` });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    db.prepare('UPDATE users SET status = ?, last_seen = ? WHERE id = ?').run('online', Date.now(), user.id);

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, username, email, display_name, avatar, bio, status, custom_status, last_seen, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Update profile
router.put('/me', authMiddleware, [
  body('displayName').optional().trim().isLength({ min: 1, max: 64 }),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('customStatus').optional().trim().isLength({ max: 128 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed' });

  const { displayName, bio, customStatus, avatar } = req.body;
  const db = getDB();

  const updates = [];
  const values = [];

  if (displayName !== undefined) { updates.push('display_name = ?'); values.push(displayName); }
  if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
  if (customStatus !== undefined) { updates.push('custom_status = ?'); values.push(customStatus); }
  if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT id, username, email, display_name, avatar, bio, status, custom_status, last_seen, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Change password
router.put('/password', authMiddleware, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6, max: 128 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed' });

  const { currentPassword, newPassword } = req.body;
  const db = getDB();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const newHash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

  res.json({ message: 'Password updated successfully' });
});

module.exports = router;
