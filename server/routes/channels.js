const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function checkServerMember(db, serverId, userId, roles = null) {
  const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ? AND is_banned = 0').get(serverId, userId);
  if (!member) return null;
  if (roles && !roles.includes(member.role)) return null;
  return member;
}

// Create channel
router.post('/', authMiddleware, [
  body('serverId').notEmpty(),
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('type').isIn(['text', 'voice', 'announcement'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed' });

  const { serverId, name, type, description, parentId } = req.body;
  const db = getDB();

  const member = checkServerMember(db, serverId, req.user.id, ['owner', 'admin']);
  if (!member) return res.status(403).json({ error: 'Insufficient permissions' });

  const channelId = uuidv4();
  const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM channels WHERE server_id = ?').get(serverId);
  const position = (maxPos?.maxPos || 0) + 1;

  db.prepare(`
    INSERT INTO channels (id, server_id, name, type, description, position, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(channelId, serverId, name.toLowerCase().replace(/\s+/g, '-'), type, description || '', position, parentId || null);

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
  res.status(201).json(channel);
});

// Update channel
router.put('/:channelId', authMiddleware, (req, res) => {
  const db = getDB();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const member = checkServerMember(db, channel.server_id, req.user.id, ['owner', 'admin']);
  if (!member) return res.status(403).json({ error: 'Insufficient permissions' });

  const { name, description, slowMode } = req.body;
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name.toLowerCase().replace(/\s+/g, '-')); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (slowMode !== undefined) { updates.push('slow_mode = ?'); values.push(slowMode); }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  values.push(req.params.channelId);
  db.prepare(`UPDATE channels SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId));
});

// Delete channel
router.delete('/:channelId', authMiddleware, (req, res) => {
  const db = getDB();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const member = checkServerMember(db, channel.server_id, req.user.id, ['owner', 'admin']);
  if (!member) return res.status(403).json({ error: 'Insufficient permissions' });

  db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.channelId);
  res.json({ message: 'Channel deleted' });
});

// Get pinned messages
router.get('/:channelId/pins', authMiddleware, (req, res) => {
  const db = getDB();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const member = checkServerMember(db, channel.server_id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const pinned = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar
    FROM messages m
    JOIN users u ON m.author_id = u.id
    WHERE m.channel_id = ? AND m.is_pinned = 1 AND m.is_deleted = 0
    ORDER BY m.created_at DESC
  `).all(req.params.channelId);

  res.json(pinned);
});

module.exports = router;
