const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/wavechat.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');
  }
  return db;
}

async function initDB() {
  const db = getDB();

  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT,
      bio TEXT DEFAULT '',
      status TEXT DEFAULT 'offline',
      custom_status TEXT DEFAULT '',
      last_seen INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      is_banned INTEGER DEFAULT 0,
      ban_reason TEXT
    );

    -- Servers (communities/guilds)
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      icon TEXT,
      banner TEXT,
      owner_id TEXT NOT NULL,
      invite_code TEXT UNIQUE,
      is_public INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Server members
    CREATE TABLE IF NOT EXISTS server_members (
      server_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      nickname TEXT,
      joined_at INTEGER DEFAULT (unixepoch()),
      is_muted INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      ban_reason TEXT,
      PRIMARY KEY (server_id, user_id),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Roles
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#99AAB5',
      permissions TEXT DEFAULT '{}',
      position INTEGER DEFAULT 0,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    -- User roles
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    -- Channels
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      description TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      is_private INTEGER DEFAULT 0,
      slow_mode INTEGER DEFAULT 0,
      parent_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    -- Direct message conversations
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'dm',
      name TEXT,
      icon TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- DM participants
    CREATE TABLE IF NOT EXISTS dm_participants (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      last_read_at INTEGER DEFAULT 0,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Messages
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT,
      conversation_id TEXT,
      author_id TEXT NOT NULL,
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'text',
      reply_to TEXT,
      is_edited INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      attachments TEXT DEFAULT '[]',
      mentions TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch()),
      edited_at INTEGER,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
    );

    -- Message reactions
    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Pinned messages
    CREATE TABLE IF NOT EXISTS pinned_messages (
      channel_id TEXT,
      conversation_id TEXT,
      message_id TEXT NOT NULL,
      pinned_by TEXT NOT NULL,
      pinned_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      data TEXT DEFAULT '{}',
      is_read INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Friend requests / relationships
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(user_id, target_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Voice rooms state (ephemeral, just for reference)
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      is_muted INTEGER DEFAULT 0,
      is_deafened INTEGER DEFAULT 0,
      joined_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id);
    CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
    CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON dm_participants(user_id);
  `);

  console.log('✅ Database initialized');
  return db;
}

module.exports = { getDB, initDB };
