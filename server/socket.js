const { socketAuth } = require('./middleware/auth');
const { getDB } = require('./db');
const { v4: uuidv4 } = require('uuid');

// Track online users, voice rooms and active calls
const onlineUsers = new Map(); // userId -> Set of socketIds
const typingUsers = new Map(); // channelId/convId -> Map<userId, timeout>
const voiceRooms = new Map(); // channelId -> Map<userId, {socketId, muted, deafened}>
const activeCalls = new Map(); // conversationId -> { callerSocketId, calleeSocketId, type }

function setupSocketHandlers(io) {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`🔌 User connected: ${socket.user.username} (${socket.id})`);

    // Track online status
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Update DB status
    const db = getDB();
    db.prepare('UPDATE users SET status = ?, last_seen = ? WHERE id = ?').run('online', Date.now(), userId);

    // Join user's servers and DMs
    const userServers = db.prepare('SELECT server_id FROM server_members WHERE user_id = ? AND is_banned = 0').all(userId);
    userServers.forEach(({ server_id }) => socket.join(`server:${server_id}`));

    const userConvs = db.prepare('SELECT conversation_id FROM dm_participants WHERE user_id = ?').all(userId);
    userConvs.forEach(({ conversation_id }) => socket.join(`conv:${conversation_id}`));

    // Broadcast online status
    socket.broadcast.emit('user:online', { userId, status: 'online' });

    // ======= CHANNEL MESSAGING =======
    socket.on('channel:join', (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('channel:leave', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    // Join DM conversation room explicitly (helps after creating new DM without reload)
    socket.on('conv:join', (conversationId) => {
      if (conversationId) socket.join(`conv:${conversationId}`);
    });

    socket.on('message:send', async (data, callback) => {
      try {
        const { channelId, conversationId, content, replyTo, attachments, mentions } = data;
        if (!content && (!attachments || attachments.length === 0)) {
          return callback?.({ error: 'Empty message' });
        }

        const db = getDB();
        const msgId = uuidv4();
        const now = Date.now();

        if (channelId) {
          db.prepare(`
            INSERT INTO messages (id, channel_id, author_id, content, reply_to, attachments, mentions, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(msgId, channelId, userId, content || '', replyTo || null, JSON.stringify(attachments || []), JSON.stringify(mentions || []), now);
        } else if (conversationId) {
          db.prepare(`
            INSERT INTO messages (id, conversation_id, author_id, content, reply_to, attachments, mentions, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(msgId, conversationId, userId, content || '', replyTo || null, JSON.stringify(attachments || []), JSON.stringify(mentions || []), now);
        } else {
          return callback?.({ error: 'No channel or conversation specified' });
        }

        const msg = db.prepare(`
          SELECT m.*, u.username, u.display_name, u.avatar,
                 rm.content as reply_content,
                 ru.username as reply_username, ru.display_name as reply_display_name
          FROM messages m
          JOIN users u ON m.author_id = u.id
          LEFT JOIN messages rm ON m.reply_to = rm.id
          LEFT JOIN users ru ON rm.author_id = ru.id
          WHERE m.id = ?
        `).get(msgId);

        const message = {
          ...msg,
          attachments: JSON.parse(msg.attachments || '[]'),
          mentions: JSON.parse(msg.mentions || '[]'),
          reactions: []
        };

        // Emit to appropriate room (including sender)
        const room = channelId ? `channel:${channelId}` : `conv:${conversationId}`;
        io.to(room).emit('message:new', message);
        // Also emit to sender directly (fixes first DM message disappearing bug)
        socket.emit('message:new', message);

        // Create notifications for mentions
        if (mentions && mentions.length > 0) {
          mentions.forEach(mentionedId => {
            if (mentionedId !== userId) {
              createNotification(db, mentionedId, 'mention', `${socket.user.display_name} mentioned you`, content?.substring(0, 100));
              io.to(`user:${mentionedId}`).emit('notification:new', { type: 'mention' });
            }
          });
        }

        callback?.({ success: true, messageId: msgId });
      } catch (err) {
        console.error('Message send error:', err);
        callback?.({ error: 'Failed to send message' });
      }
    });

    socket.on('message:edit', (data) => {
      const { messageId, content } = data;
      if (!content?.trim()) return;

      const db = getDB();
      const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND author_id = ?').get(messageId, userId);
      if (!msg) return;

      db.prepare('UPDATE messages SET content = ?, is_edited = 1, edited_at = ? WHERE id = ?').run(content, Date.now(), messageId);

      const room = msg.channel_id ? `channel:${msg.channel_id}` : `conv:${msg.conversation_id}`;
      io.to(room).emit('message:edited', { messageId, content, editedAt: Date.now() });
    });

    socket.on('message:delete', (data) => {
      const { messageId } = data;
      const db = getDB();

      const msg = db.prepare(`
        SELECT m.*, c.server_id FROM messages m
        LEFT JOIN channels c ON m.channel_id = c.id
        WHERE m.id = ?
      `).get(messageId);

      if (!msg) return;

      let canDelete = msg.author_id === userId;
      if (!canDelete && msg.server_id) {
        const member = db.prepare('SELECT role FROM server_members WHERE server_id = ? AND user_id = ?').get(msg.server_id, userId);
        canDelete = member && ['owner', 'admin', 'moderator'].includes(member.role);
      }
      if (!canDelete) return;

      db.prepare('UPDATE messages SET is_deleted = 1, content = ? WHERE id = ?').run('[Message deleted]', messageId);

      const room = msg.channel_id ? `channel:${msg.channel_id}` : `conv:${msg.conversation_id}`;
      io.to(room).emit('message:deleted', { messageId });
    });

    socket.on('message:react', (data) => {
      const { messageId, emoji } = data;
      if (!emoji) return;

      const db = getDB();
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      if (!msg) return;

      try {
        db.prepare('INSERT INTO reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)').run(uuidv4(), messageId, userId, emoji);
      } catch {
        db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(messageId, userId, emoji);
      }

      const reactions = db.prepare(`
        SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
        FROM reactions WHERE message_id = ? GROUP BY emoji
      `).all(messageId);

      const room = msg.channel_id ? `channel:${msg.channel_id}` : `conv:${msg.conversation_id}`;
      io.to(room).emit('message:reactions', {
        messageId,
        reactions: reactions.map(r => ({ emoji: r.emoji, count: r.count, userIds: r.user_ids ? r.user_ids.split(',') : [] }))
      });
    });

    // ======= TYPING INDICATORS =======
    socket.on('typing:start', ({ channelId, conversationId }) => {
      const room = channelId ? `channel:${channelId}` : `conv:${conversationId}`;
      const key = channelId || conversationId;

      if (!typingUsers.has(key)) typingUsers.set(key, new Map());
      const typing = typingUsers.get(key);

      // Clear existing timeout
      if (typing.has(userId)) clearTimeout(typing.get(userId).timeout);

      const timeout = setTimeout(() => {
        typing.delete(userId);
        socket.to(room).emit('typing:stop', { userId, channelId, conversationId });
      }, 5000);

      typing.set(userId, { timeout, user: socket.user });
      socket.to(room).emit('typing:start', { userId, username: socket.user.username, displayName: socket.user.display_name, channelId, conversationId });
    });

    socket.on('typing:stop', ({ channelId, conversationId }) => {
      const key = channelId || conversationId;
      const room = channelId ? `channel:${channelId}` : `conv:${conversationId}`;

      if (typingUsers.has(key)) {
        const typing = typingUsers.get(key);
        if (typing.has(userId)) {
          clearTimeout(typing.get(userId).timeout);
          typing.delete(userId);
        }
      }
      socket.to(room).emit('typing:stop', { userId, channelId, conversationId });
    });

    // ======= VOICE/VIDEO CALLS =======
    socket.on('voice:join', ({ channelId }) => {
      if (!voiceRooms.has(channelId)) voiceRooms.set(channelId, new Map());
      const room = voiceRooms.get(channelId);

      room.set(userId, { socketId: socket.id, muted: false, deafened: false, user: socket.user });
      socket.join(`voice:${channelId}`);

      const participants = Array.from(room.entries()).map(([uid, data]) => ({
        userId: uid, socketId: data.socketId, muted: data.muted, deafened: data.deafened,
        username: data.user.username, displayName: data.user.display_name, avatar: data.user.avatar
      }));

      socket.to(`voice:${channelId}`).emit('voice:user_joined', {
        userId, socketId: socket.id, username: socket.user.username,
        displayName: socket.user.display_name, avatar: socket.user.avatar
      });

      socket.emit('voice:participants', { channelId, participants });

      // Update DB
      const db = getDB();
      db.prepare('INSERT OR REPLACE INTO voice_sessions (id, channel_id, user_id) VALUES (?, ?, ?)').run(uuidv4(), channelId, userId);
    });

    socket.on('voice:leave', ({ channelId }) => {
      leaveVoiceChannel(socket, channelId, userId, io);
    });

    socket.on('voice:toggle_mute', ({ channelId }) => {
      if (voiceRooms.has(channelId) && voiceRooms.get(channelId).has(userId)) {
        const data = voiceRooms.get(channelId).get(userId);
        data.muted = !data.muted;
        io.to(`voice:${channelId}`).emit('voice:user_updated', { userId, muted: data.muted, deafened: data.deafened });
      }
    });

    socket.on('voice:toggle_deafen', ({ channelId }) => {
      if (voiceRooms.has(channelId) && voiceRooms.get(channelId).has(userId)) {
        const data = voiceRooms.get(channelId).get(userId);
        data.deafened = !data.deafened;
        io.to(`voice:${channelId}`).emit('voice:user_updated', { userId, muted: data.muted, deafened: data.deafened });
      }
    });

    // WebRTC signaling
    socket.on('webrtc:offer', ({ targetSocketId, offer, channelId }) => {
      io.to(targetSocketId).emit('webrtc:offer', { fromSocketId: socket.id, offer, channelId, fromUser: socket.user });
    });

    socket.on('webrtc:answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('webrtc:answer', { fromSocketId: socket.id, answer });
    });

    socket.on('webrtc:ice_candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc:ice_candidate', { fromSocketId: socket.id, candidate });
    });

    // Direct call signaling (DM)
    socket.on('call:invite', ({ targetUserId, type, conversationId }) => {
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets && targetSockets.size > 0) {
        const targetSocketId = [...targetSockets][0];
        io.to(targetSocketId).emit('call:incoming', {
          from: socket.user, type, conversationId, fromSocketId: socket.id
        });

        if (conversationId) {
          activeCalls.set(conversationId, {
            callerSocketId: socket.id,
            calleeSocketId: targetSocketId,
            type
          });
        }
      }
    });

    socket.on('call:accept', ({ fromSocketId, type, conversationId }) => {
      // Resolve active call by conversationId if possible
      let callEntry = conversationId ? activeCalls.get(conversationId) : null;
      if (!callEntry && conversationId) {
        callEntry = { callerSocketId: fromSocketId, calleeSocketId: socket.id, type };
        activeCalls.set(conversationId, callEntry);
      } else if (callEntry) {
        callEntry.calleeSocketId = socket.id;
        callEntry.type = type || callEntry.type;
      }

      const payload = {
        conversationId: conversationId || null,
        type,
        fromSocketId: socket.id
      };

      // Notify caller
      if (fromSocketId) {
        io.to(fromSocketId).emit('call:accepted', {
          ...payload,
          peerSocketId: socket.id
        });
      }

      // Notify callee (current socket)
      socket.emit('call:accepted', {
        ...payload,
        peerSocketId: fromSocketId || (callEntry ? callEntry.callerSocketId : null)
      });
    });

    socket.on('call:decline', ({ fromSocketId, conversationId }) => {
      if (conversationId && activeCalls.has(conversationId)) {
        const callEntry = activeCalls.get(conversationId);
        const { callerSocketId, calleeSocketId } = callEntry;

        [callerSocketId, calleeSocketId].forEach((sid) => {
          if (sid) {
            io.to(sid).emit('call:declined', { conversationId });
          }
        });

        activeCalls.delete(conversationId);
        return;
      }

      if (fromSocketId) {
        io.to(fromSocketId).emit('call:declined', { fromSocketId: socket.id });
      }
    });

    socket.on('call:end', ({ targetSocketId, conversationId }) => {
      if (conversationId && activeCalls.has(conversationId)) {
        const { callerSocketId, calleeSocketId } = activeCalls.get(conversationId);
        [callerSocketId, calleeSocketId].forEach((sid) => {
          if (sid) {
            io.to(sid).emit('call:ended', { conversationId });
          }
        });
        activeCalls.delete(conversationId);
        return;
      }

      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ended', { conversationId: conversationId || null });
      }
    });

    // ======= USER STATUS =======
    socket.on('status:update', ({ status, customStatus }) => {
      const db = getDB();
      if (status) db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
      if (customStatus !== undefined) db.prepare('UPDATE users SET custom_status = ? WHERE id = ?').run(customStatus, userId);
      io.emit('user:status_updated', { userId, status, customStatus });
    });

    // Join user-specific room for targeted events
    socket.join(`user:${userId}`);

    // ======= DISCONNECT =======
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          const db = getDB();
          db.prepare('UPDATE users SET status = ?, last_seen = ? WHERE id = ?').run('offline', Date.now(), userId);
          io.emit('user:offline', { userId, lastSeen: Date.now() });
        }
      }

      // End any active DM calls involving this socket
      activeCalls.forEach((call, conversationId) => {
        if (call.callerSocketId === socket.id || call.calleeSocketId === socket.id) {
          const otherSocketId = call.callerSocketId === socket.id ? call.calleeSocketId : call.callerSocketId;
          if (otherSocketId) {
            io.to(otherSocketId).emit('call:ended', { conversationId });
          }
          activeCalls.delete(conversationId);
        }
      });

      // Leave all voice channels
      voiceRooms.forEach((room, channelId) => {
        if (room.has(userId)) leaveVoiceChannel(socket, channelId, userId, io);
      });

      // Clear typing
      typingUsers.forEach((typing, key) => {
        if (typing.has(userId)) {
          clearTimeout(typing.get(userId).timeout);
          typing.delete(userId);
        }
      });

      console.log(`🔌 User disconnected: ${socket.user.username}`);
    });
  });

  return io;
}

function leaveVoiceChannel(socket, channelId, userId, io) {
  if (voiceRooms.has(channelId)) {
    voiceRooms.get(channelId).delete(userId);
    if (voiceRooms.get(channelId).size === 0) voiceRooms.delete(channelId);
  }
  socket.leave(`voice:${channelId}`);
  io.to(`voice:${channelId}`).emit('voice:user_left', { userId, channelId });

  const db = getDB();
  db.prepare('DELETE FROM voice_sessions WHERE channel_id = ? AND user_id = ?').run(channelId, userId);
}

function createNotification(db, userId, type, title, body) {
  try {
    db.prepare('INSERT INTO notifications (id, user_id, type, title, body) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), userId, type, title, body || '');
  } catch (e) {
    console.error('Notification error:', e);
  }
}

module.exports = { setupSocketHandlers, onlineUsers, voiceRooms };
