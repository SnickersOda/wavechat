const express = require('express');
const { getDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Search users
router.get('/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  const db = getDB();
  const users = db.prepare(`
    SELECT id, username, display_name, avatar, status, bio
    FROM users
    WHERE (username LIKE ? OR display_name LIKE ?) AND id != ? AND is_banned = 0
    LIMIT 20
  `).all(`%${q}%`, `%${q}%`, req.user.id);

  res.json(users);
});

// Get user profile
router.get('/:userId', authMiddleware, (req, res) => {
  const db = getDB();
  const user = db.prepare(`
    SELECT id, username, display_name, avatar, bio, status, custom_status, last_seen, created_at
    FROM users WHERE id = ? AND is_banned = 0
  `).get(req.params.userId);

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Get friends / relationships
router.get('/me/friends', authMiddleware, (req, res) => {
  const db = getDB();
  const friends = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.status, u.custom_status, r.type
    FROM relationships r
    JOIN users u ON (r.target_id = u.id OR r.user_id = u.id)
    WHERE (r.user_id = ? OR r.target_id = ?) AND r.type = 'friend' AND u.id != ?
  `).all(req.user.id, req.user.id, req.user.id);

  res.json(friends);
});

// Send friend request
router.post('/:userId/friend', authMiddleware, (req, res) => {
  const db = getDB();
  const targetId = req.params.userId;

  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot friend yourself' });

  const existing = db.prepare('SELECT * FROM relationships WHERE (user_id = ? AND target_id = ?) OR (user_id = ? AND target_id = ?)').get(req.user.id, targetId, targetId, req.user.id);
  if (existing) return res.status(409).json({ error: 'Relationship already exists' });

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  db.prepare('INSERT INTO relationships (id, user_id, target_id, type) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, targetId, 'pending');
  res.json({ message: 'Friend request sent' });
});

// Accept/decline friend request
router.put('/:userId/friend', authMiddleware, (req, res) => {
  const { action } = req.body;
  const db = getDB();

  const rel = db.prepare('SELECT * FROM relationships WHERE user_id = ? AND target_id = ? AND type = ?').get(req.params.userId, req.user.id, 'pending');
  if (!rel) return res.status(404).json({ error: 'Friend request not found' });

  if (action === 'accept') {
    db.prepare('UPDATE relationships SET type = ? WHERE id = ?').run('friend', rel.id);
  } else {
    db.prepare('DELETE FROM relationships WHERE id = ?').run(rel.id);
  }

  res.json({ message: `Friend request ${action}ed` });
});

// Block user
router.post('/:userId/block', authMiddleware, (req, res) => {
  const db = getDB();
  const targetId = req.params.userId;

  db.prepare('DELETE FROM relationships WHERE (user_id = ? AND target_id = ?) OR (user_id = ? AND target_id = ?)').run(req.user.id, targetId, targetId, req.user.id);
  db.prepare('INSERT OR REPLACE INTO relationships (id, user_id, target_id, type) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, targetId, 'blocked');

  res.json({ message: 'User blocked' });
});

// Get notifications
router.get('/me/notifications', authMiddleware, (req, res) => {
  const db = getDB();
  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json(notifications);
});

// Mark notifications read
router.put('/me/notifications/read', authMiddleware, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Notifications marked as read' });
});

module.exports = router;
