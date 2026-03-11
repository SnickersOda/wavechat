const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Get user's servers
router.get('/', authMiddleware, (req, res) => {
  const db = getDB();
  const servers = db.prepare(`
    SELECT s.*, sm.role
    FROM servers s
    JOIN server_members sm ON s.id = sm.server_id
    WHERE sm.user_id = ? AND sm.is_banned = 0
    ORDER BY s.created_at ASC
  `).all(req.user.id);

  res.json(servers);
});

// Create server
router.post('/', authMiddleware, [
  body('name').trim().isLength({ min: 1, max: 100 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed' });

  const { name, description, icon } = req.body;
  const db = getDB();
  const serverId = uuidv4();
  const inviteCode = generateInviteCode();

  const createServer = db.transaction(() => {
    db.prepare(`
      INSERT INTO servers (id, name, description, icon, owner_id, invite_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(serverId, name, description || '', icon || null, req.user.id, inviteCode);

    // Add owner as member
    db.prepare(`
      INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)
    `).run(serverId, req.user.id, 'owner');

    // Create default channels
    const generalId = uuidv4();
    const generalVoiceId = uuidv4();

    db.prepare(`
      INSERT INTO channels (id, server_id, name, type, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(generalId, serverId, 'general', 'text', 0);

    db.prepare(`
      INSERT INTO channels (id, server_id, name, type, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(generalVoiceId, serverId, 'General Voice', 'voice', 1);

    return db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  });

  const server = createServer();
  res.status(201).json(server);
});

// Get server details
router.get('/:serverId', authMiddleware, (req, res) => {
  const db = getDB();
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.serverId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC').all(req.params.serverId);
  const members = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.status, sm.role, sm.nickname, sm.is_muted
    FROM server_members sm
    JOIN users u ON sm.user_id = u.id
    WHERE sm.server_id = ? AND sm.is_banned = 0
    ORDER BY sm.role = 'owner' DESC, sm.role = 'admin' DESC, u.username ASC
  `).all(req.params.serverId);

  res.json({ ...server, channels, members });
});

// Update server
router.put('/:serverId', authMiddleware, (req, res) => {
  const db = getDB();
  const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.serverId, req.user.id);
  if (!member || !['owner', 'admin'].includes(member.role)) return res.status(403).json({ error: 'Insufficient permissions' });

  const { name, description, icon, banner } = req.body;
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
  if (banner !== undefined) { updates.push('banner = ?'); values.push(banner); }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.params.serverId);
  db.prepare(`UPDATE servers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.serverId));
});

// Delete server
router.delete('/:serverId', authMiddleware, (req, res) => {
  const db = getDB();
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND owner_id = ?').get(req.params.serverId, req.user.id);
  if (!server) return res.status(403).json({ error: 'Only the owner can delete the server' });

  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.serverId);
  res.json({ message: 'Server deleted' });
});

// Join server via invite
router.post('/join/:inviteCode', authMiddleware, (req, res) => {
  const db = getDB();
  const server = db.prepare('SELECT * FROM servers WHERE invite_code = ?').get(req.params.inviteCode);
  if (!server) return res.status(404).json({ error: 'Invalid invite code' });

  const existingMember = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(server.id, req.user.id);
  if (existingMember) {
    if (existingMember.is_banned) return res.status(403).json({ error: 'You are banned from this server' });
    return res.status(409).json({ error: 'Already a member', server });
  }

  db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(server.id, req.user.id, 'member');
  const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC').all(server.id);
  res.json({ ...server, channels });
});

// Leave server
router.post('/:serverId/leave', authMiddleware, (req, res) => {
  const db = getDB();
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (server.owner_id === req.user.id) return res.status(400).json({ error: 'Transfer ownership before leaving' });

  db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(req.params.serverId, req.user.id);
  res.json({ message: 'Left server' });
});

// Get/regenerate invite
router.post('/:serverId/invite', authMiddleware, (req, res) => {
  const db = getDB();
  const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.serverId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const server = db.prepare('SELECT invite_code FROM servers WHERE id = ?').get(req.params.serverId);
  res.json({ inviteCode: server.invite_code });
});

// Update member role
router.put('/:serverId/members/:userId/role', authMiddleware, (req, res) => {
  const db = getDB();
  const myMember = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.serverId, req.user.id);
  if (!myMember || !['owner', 'admin'].includes(myMember.role)) return res.status(403).json({ error: 'Insufficient permissions' });

  const { role } = req.body;
  if (!['member', 'moderator', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const targetServer = db.prepare('SELECT owner_id FROM servers WHERE id = ?').get(req.params.serverId);
  if (targetServer.owner_id === req.params.userId) return res.status(400).json({ error: 'Cannot change owner role' });

  db.prepare('UPDATE server_members SET role = ? WHERE server_id = ? AND user_id = ?').run(role, req.params.serverId, req.params.userId);
  res.json({ message: 'Role updated' });
});

// Kick member
router.delete('/:serverId/members/:userId', authMiddleware, (req, res) => {
  const db = getDB();
  const myMember = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.serverId, req.user.id);
  if (!myMember || !['owner', 'admin', 'moderator'].includes(myMember.role)) return res.status(403).json({ error: 'Insufficient permissions' });

  db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(req.params.serverId, req.params.userId);
  res.json({ message: 'Member kicked' });
});

// Ban member
router.post('/:serverId/members/:userId/ban', authMiddleware, (req, res) => {
  const db = getDB();
  const myMember = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.serverId, req.user.id);
  if (!myMember || !['owner', 'admin', 'moderator'].includes(myMember.role)) return res.status(403).json({ error: 'Insufficient permissions' });

  const { reason } = req.body;
  db.prepare('UPDATE server_members SET is_banned = 1, ban_reason = ? WHERE server_id = ? AND user_id = ?').run(reason || 'No reason', req.params.serverId, req.params.userId);
  res.json({ message: 'Member banned' });
});

module.exports = router;
