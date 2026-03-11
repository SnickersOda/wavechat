const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get user's DM conversations
router.get('/', authMiddleware, (req, res) => {
  const db = getDB();
  const conversations = db.prepare(`
    SELECT dc.*, dp.last_read_at,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = dc.id AND m.created_at > dp.last_read_at AND m.author_id != ? AND m.is_deleted = 0) as unread_count,
    (SELECT m.content FROM messages m WHERE m.conversation_id = dc.id AND m.is_deleted = 0 ORDER BY m.created_at DESC LIMIT 1) as last_message,
    (SELECT m.created_at FROM messages m WHERE m.conversation_id = dc.id AND m.is_deleted = 0 ORDER BY m.created_at DESC LIMIT 1) as last_message_at
    FROM dm_conversations dc
    JOIN dm_participants dp ON dc.id = dp.conversation_id
    WHERE dp.user_id = ?
    ORDER BY last_message_at DESC NULLS LAST
  `).all(req.user.id, req.user.id);

  const enriched = conversations.map(conv => {
    const participants = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.status, u.custom_status
      FROM dm_participants dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.conversation_id = ?
    `).all(conv.id);
    return { ...conv, participants };
  });

  res.json(enriched);
});

// Open or get DM with a user
router.post('/open/:userId', authMiddleware, (req, res) => {
  const db = getDB();
  const targetId = req.params.userId;

  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot DM yourself' });

  const target = db.prepare('SELECT id, username, display_name, avatar, status FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Find existing DM conversation
  const existing = db.prepare(`
    SELECT dc.* FROM dm_conversations dc
    WHERE dc.type = 'dm'
    AND EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = dc.id AND user_id = ?)
    AND EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = dc.id AND user_id = ?)
    AND (SELECT COUNT(*) FROM dm_participants WHERE conversation_id = dc.id) = 2
  `).get(req.user.id, targetId);

  if (existing) {
    const participants = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.status
      FROM dm_participants dp JOIN users u ON dp.user_id = u.id
      WHERE dp.conversation_id = ?
    `).all(existing.id);
    return res.json({ ...existing, participants });
  }

  // Create new DM
  const convId = uuidv4();
  const createDM = db.transaction(() => {
    db.prepare('INSERT INTO dm_conversations (id, type) VALUES (?, ?)').run(convId, 'dm');
    db.prepare('INSERT INTO dm_participants (conversation_id, user_id) VALUES (?, ?)').run(convId, req.user.id);
    db.prepare('INSERT INTO dm_participants (conversation_id, user_id) VALUES (?, ?)').run(convId, targetId);
  });
  createDM();

  const conv = db.prepare('SELECT * FROM dm_conversations WHERE id = ?').get(convId);
  const participants = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.status
    FROM dm_participants dp JOIN users u ON dp.user_id = u.id
    WHERE dp.conversation_id = ?
  `).all(convId);

  res.status(201).json({ ...conv, participants });
});

// Create group DM
router.post('/group', authMiddleware, (req, res) => {
  const { userIds, name } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length < 2) {
    return res.status(400).json({ error: 'At least 2 users required' });
  }

  const db = getDB();
  const convId = uuidv4();
  const allIds = [...new Set([req.user.id, ...userIds])];

  const createGroup = db.transaction(() => {
    db.prepare('INSERT INTO dm_conversations (id, type, name) VALUES (?, ?, ?)').run(convId, 'group', name || 'Group Chat');
    for (const uid of allIds) {
      db.prepare('INSERT INTO dm_participants (conversation_id, user_id) VALUES (?, ?)').run(convId, uid);
    }
  });
  createGroup();

  const conv = db.prepare('SELECT * FROM dm_conversations WHERE id = ?').get(convId);
  const participants = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, u.status
    FROM dm_participants dp JOIN users u ON dp.user_id = u.id
    WHERE dp.conversation_id = ?
  `).all(convId);

  res.status(201).json({ ...conv, participants });
});

// Get DM messages
router.get('/:convId/messages', authMiddleware, (req, res) => {
  const db = getDB();
  const participant = db.prepare('SELECT * FROM dm_participants WHERE conversation_id = ? AND user_id = ?').get(req.params.convId, req.user.id);
  if (!participant) return res.status(403).json({ error: 'Not a participant' });

  const { before, limit = 50 } = req.query;
  const actualLimit = Math.min(parseInt(limit), 100);

  let query = `
    SELECT m.*, u.username, u.display_name, u.avatar,
           rm.content as reply_content,
           ru.username as reply_username, ru.display_name as reply_display_name
    FROM messages m
    JOIN users u ON m.author_id = u.id
    LEFT JOIN messages rm ON m.reply_to = rm.id
    LEFT JOIN users ru ON rm.author_id = ru.id
    WHERE m.conversation_id = ? AND m.is_deleted = 0
  `;
  const params = [req.params.convId];

  if (before) { query += ' AND m.created_at < ?'; params.push(parseInt(before)); }
  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(actualLimit);

  const messages = db.prepare(query).all(...params);

  // Update last read
  db.prepare('UPDATE dm_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?').run(Date.now(), req.params.convId, req.user.id);

  const enriched = messages.map(msg => {
    const reactions = db.prepare(`
      SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
      FROM reactions WHERE message_id = ? GROUP BY emoji
    `).all(msg.id);
    return {
      ...msg,
      attachments: JSON.parse(msg.attachments || '[]'),
      mentions: JSON.parse(msg.mentions || '[]'),
      reactions: reactions.map(r => ({ emoji: r.emoji, count: r.count, userIds: r.user_ids ? r.user_ids.split(',') : [] }))
    };
  }).reverse();

  res.json({ messages: enriched, hasMore: messages.length === actualLimit });
});

// Send DM message
router.post('/:convId/messages', authMiddleware, (req, res) => {
  const db = getDB();
  const participant = db.prepare('SELECT * FROM dm_participants WHERE conversation_id = ? AND user_id = ?').get(req.params.convId, req.user.id);
  if (!participant) return res.status(403).json({ error: 'Not a participant' });

  const { content, replyTo, attachments, mentions } = req.body;
  if (!content && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Message must have content or attachments' });
  }

  const msgId = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, author_id, content, reply_to, attachments, mentions, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, req.params.convId, req.user.id, content || '', replyTo || null, JSON.stringify(attachments || []), JSON.stringify(mentions || []), now);

  const msg = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar
    FROM messages m JOIN users u ON m.author_id = u.id WHERE m.id = ?
  `).get(msgId);

  const message = {
    ...msg,
    attachments: JSON.parse(msg.attachments || '[]'),
    mentions: JSON.parse(msg.mentions || '[]'),
    reactions: []
  };

  res.status(201).json(message);
});

module.exports = router;
