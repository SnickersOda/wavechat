const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const MESSAGE_LIMIT = 50;

function getMessageWithDetails(db, messageId) {
  const msg = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar,
           rm.content as reply_content,
           ru.username as reply_username, ru.display_name as reply_display_name
    FROM messages m
    JOIN users u ON m.author_id = u.id
    LEFT JOIN messages rm ON m.reply_to = rm.id
    LEFT JOIN users ru ON rm.author_id = ru.id
    WHERE m.id = ?
  `).get(messageId);

  if (!msg) return null;

  const reactions = db.prepare(`
    SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
    FROM reactions WHERE message_id = ?
    GROUP BY emoji
  `).all(messageId);

  return {
    ...msg,
    attachments: JSON.parse(msg.attachments || '[]'),
    mentions: JSON.parse(msg.mentions || '[]'),
    reactions: reactions.map(r => ({ emoji: r.emoji, count: r.count, userIds: r.user_ids.split(',') }))
  };
}

// Get channel messages
router.get('/channel/:channelId', authMiddleware, (req, res) => {
  const db = getDB();
  const { before, after, limit = MESSAGE_LIMIT } = req.query;
  const actualLimit = Math.min(parseInt(limit), 100);

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  let query = `
    SELECT m.*, u.username, u.display_name, u.avatar,
           rm.content as reply_content, rm.id as reply_id,
           ru.username as reply_username, ru.display_name as reply_display_name
    FROM messages m
    JOIN users u ON m.author_id = u.id
    LEFT JOIN messages rm ON m.reply_to = rm.id
    LEFT JOIN users ru ON rm.author_id = ru.id
    WHERE m.channel_id = ? AND m.is_deleted = 0
  `;
  const params = [req.params.channelId];

  if (before) { query += ' AND m.created_at < ?'; params.push(parseInt(before)); }
  if (after) { query += ' AND m.created_at > ?'; params.push(parseInt(after)); }
  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(actualLimit);

  const messages = db.prepare(query).all(...params);

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

// Search messages
router.get('/channel/:channelId/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  const db = getDB();
  const messages = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar
    FROM messages m
    JOIN users u ON m.author_id = u.id
    WHERE m.channel_id = ? AND m.content LIKE ? AND m.is_deleted = 0
    ORDER BY m.created_at DESC LIMIT 50
  `).all(req.params.channelId, `%${q}%`);

  res.json(messages.map(m => ({ ...m, attachments: JSON.parse(m.attachments || '[]') })));
});

// Send message to channel
router.post('/channel/:channelId', authMiddleware, [
  body('content').optional().trim()
], (req, res) => {
  const db = getDB();
  const { content, replyTo, attachments, mentions } = req.body;

  if (!content && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Message must have content or attachments' });
  }

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const msgId = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO messages (id, channel_id, author_id, content, reply_to, attachments, mentions, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, req.params.channelId, req.user.id, content || '', replyTo || null, JSON.stringify(attachments || []), JSON.stringify(mentions || []), now);

  const message = getMessageWithDetails(db, msgId);
  res.status(201).json(message);
});

// Edit message
router.put('/:messageId', authMiddleware, [
  body('content').trim().notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Content required' });

  const db = getDB();
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.author_id !== req.user.id) return res.status(403).json({ error: 'Can only edit your own messages' });
  if (msg.is_deleted) return res.status(400).json({ error: 'Cannot edit deleted message' });

  db.prepare('UPDATE messages SET content = ?, is_edited = 1, edited_at = ? WHERE id = ?').run(req.body.content, Date.now(), req.params.messageId);
  const message = getMessageWithDetails(db, req.params.messageId);
  res.json(message);
});

// Delete message
router.delete('/:messageId', authMiddleware, (req, res) => {
  const db = getDB();
  const msg = db.prepare('SELECT m.*, c.server_id FROM messages m LEFT JOIN channels c ON m.channel_id = c.id WHERE m.id = ?').get(req.params.messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  let canDelete = msg.author_id === req.user.id;
  if (!canDelete && msg.server_id) {
    const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(msg.server_id, req.user.id);
    canDelete = member && ['owner', 'admin', 'moderator'].includes(member.role);
  }

  if (!canDelete) return res.status(403).json({ error: 'Cannot delete this message' });

  db.prepare('UPDATE messages SET is_deleted = 1, content = ? WHERE id = ?').run('[Message deleted]', req.params.messageId);
  res.json({ messageId: req.params.messageId, deleted: true });
});

// Add reaction
router.post('/:messageId/reactions', authMiddleware, (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  const db = getDB();
  const msg = db.prepare('SELECT id FROM messages WHERE id = ?').get(req.params.messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  try {
    db.prepare('INSERT INTO reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)').run(uuidv4(), req.params.messageId, req.user.id, emoji);
  } catch (e) {
    // Already reacted - remove it (toggle)
    db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(req.params.messageId, req.user.id, emoji);
  }

  const reactions = db.prepare(`
    SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
    FROM reactions WHERE message_id = ? GROUP BY emoji
  `).all(req.params.messageId);

  res.json(reactions.map(r => ({ emoji: r.emoji, count: r.count, userIds: r.user_ids ? r.user_ids.split(',') : [] })));
});

// Pin/unpin message
router.put('/:messageId/pin', authMiddleware, (req, res) => {
  const db = getDB();
  const msg = db.prepare('SELECT m.*, c.server_id FROM messages m LEFT JOIN channels c ON m.channel_id = c.id WHERE m.id = ?').get(req.params.messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  if (msg.server_id) {
    const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(msg.server_id, req.user.id);
    if (!member || !['owner', 'admin', 'moderator'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  }

  const newPinState = msg.is_pinned ? 0 : 1;
  db.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?').run(newPinState, req.params.messageId);
  res.json({ messageId: req.params.messageId, isPinned: !!newPinState });
});

module.exports = router;
