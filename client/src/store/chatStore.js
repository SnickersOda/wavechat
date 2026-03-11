import { create } from 'zustand'
import api from '../utils/api'

export const useChatStore = create((set, get) => ({
  // Servers
  servers: [],
  activeServer: null,

  // Channels
  channels: [],
  activeChannel: null,

  // DMs
  conversations: [],
  activeConversation: null,

  // Messages
  messages: {},  // channelId/convId -> messages[]
  hasMore: {},   // channelId/convId -> bool
  loadingMessages: false,

  // Typing
  typing: {},    // channelId/convId -> [{userId, displayName}]

  // Voice
  voiceParticipants: {}, // channelId -> participants[]
  activeVoiceChannel: null,

  // Members online status cache
  memberStatuses: {}, // userId -> {status, lastSeen, customStatus}

  // Unread
  unreadCounts: {}, // channelId/convId -> count
  totalNotifications: 0,

  // UI
  rightPanelOpen: false,
  searchQuery: '',

  // ===== SERVERS =====
  loadServers: async () => {
    const { data } = await api.get('/servers')
    set({ servers: data })
    return data
  },

  setActiveServer: async (server) => {
    set({ activeServer: server, activeConversation: null })
    if (server) {
      const { data } = await api.get(`/servers/${server.id}`)
      set({ channels: data.channels || [], activeServer: data })
    }
  },

  addServer: (server) => set(s => ({ servers: [...s.servers, server] })),

  removeServer: (serverId) => set(s => ({
    servers: s.servers.filter(sv => sv.id !== serverId),
    activeServer: s.activeServer?.id === serverId ? null : s.activeServer,
    channels: s.activeServer?.id === serverId ? [] : s.channels
  })),

  updateServer: (serverId, updates) => set(s => ({
    servers: s.servers.map(sv => sv.id === serverId ? { ...sv, ...updates } : sv),
    activeServer: s.activeServer?.id === serverId ? { ...s.activeServer, ...updates } : s.activeServer
  })),

  // ===== CHANNELS =====
  setActiveChannel: (channel) => {
    set({ activeChannel: channel, activeConversation: null })
  },

  addChannel: (channel) => set(s => ({
    channels: [...s.channels, channel]
  })),

  removeChannel: (channelId) => set(s => ({
    channels: s.channels.filter(c => c.id !== channelId),
    activeChannel: s.activeChannel?.id === channelId ? null : s.activeChannel
  })),

  // ===== CONVERSATIONS (DMs) =====
  loadConversations: async () => {
    const { data } = await api.get('/dm')
    set({ conversations: data })
    return data
  },

  setActiveConversation: (conv) => {
    set({ activeConversation: conv, activeServer: null, activeChannel: null, channels: [] })
  },

  addConversation: (conv) => set(s => {
    const exists = s.conversations.find(c => c.id === conv.id)
    if (exists) return s
    return { conversations: [conv, ...s.conversations] }
  }),

  updateConversation: (convId, updates) => set(s => ({
    conversations: s.conversations.map(c => c.id === convId ? { ...c, ...updates } : c)
  })),

  // ===== MESSAGES =====
  loadMessages: async (channelId, convId, before = null) => {
    const key = channelId || convId
    set({ loadingMessages: true })
    try {
      let url, params = {}
      if (channelId) {
        url = `/messages/channel/${channelId}`
      } else {
        url = `/dm/${convId}/messages`
      }
      if (before) params.before = before

      const { data } = await api.get(url, { params })
      const existing = get().messages[key] || []

      if (before) {
        set(s => ({
          messages: { ...s.messages, [key]: [...data.messages, ...existing] },
          hasMore: { ...s.hasMore, [key]: data.hasMore },
          loadingMessages: false
        }))
      } else {
        set(s => ({
          messages: { ...s.messages, [key]: data.messages },
          hasMore: { ...s.hasMore, [key]: data.hasMore },
          loadingMessages: false
        }))
      }
      return data
    } catch (err) {
      set({ loadingMessages: false })
      throw err
    }
  },

  addMessage: (message) => {
    const key = message.channel_id || message.conversation_id
    set(s => {
      const existing = s.messages[key] || []
      // Avoid duplicates
      if (existing.find(m => m.id === message.id)) return s
      return { messages: { ...s.messages, [key]: [...existing, message] } }
    })
  },

  editMessage: (messageId, content, editedAt) => {
    set(s => {
      const newMessages = {}
      Object.entries(s.messages).forEach(([key, msgs]) => {
        newMessages[key] = msgs.map(m => m.id === messageId ? { ...m, content, is_edited: 1, edited_at: editedAt } : m)
      })
      return { messages: newMessages }
    })
  },

  deleteMessage: (messageId) => {
    set(s => {
      const newMessages = {}
      Object.entries(s.messages).forEach(([key, msgs]) => {
        newMessages[key] = msgs.map(m => m.id === messageId ? { ...m, is_deleted: 1, content: '[Message deleted]' } : m)
      })
      return { messages: newMessages }
    })
  },

  updateReactions: (messageId, reactions) => {
    set(s => {
      const newMessages = {}
      Object.entries(s.messages).forEach(([key, msgs]) => {
        newMessages[key] = msgs.map(m => m.id === messageId ? { ...m, reactions } : m)
      })
      return { messages: newMessages }
    })
  },

  clearMessages: (key) => set(s => ({
    messages: { ...s.messages, [key]: [] }
  })),

  // ===== TYPING =====
  addTyping: ({ userId, displayName, channelId, conversationId }) => {
    const key = channelId || conversationId
    set(s => {
      const existing = s.typing[key] || []
      if (existing.find(t => t.userId === userId)) return s
      return { typing: { ...s.typing, [key]: [...existing, { userId, displayName }] } }
    })
  },

  removeTyping: ({ userId, channelId, conversationId }) => {
    const key = channelId || conversationId
    set(s => ({
      typing: { ...s.typing, [key]: (s.typing[key] || []).filter(t => t.userId !== userId) }
    }))
  },

  // ===== VOICE =====
  setVoiceParticipants: (channelId, participants) => set(s => ({
    voiceParticipants: { ...s.voiceParticipants, [channelId]: participants }
  })),

  addVoiceParticipant: (user) => set(s => {
    const existing = s.voiceParticipants[user.channelId] || []
    if (existing.find(p => p.userId === user.userId)) return s
    return { voiceParticipants: { ...s.voiceParticipants, [user.channelId]: [...existing, user] } }
  }),

  removeVoiceParticipant: (channelId, userId) => set(s => ({
    voiceParticipants: {
      ...s.voiceParticipants,
      [channelId]: (s.voiceParticipants[channelId] || []).filter(p => p.userId !== userId)
    }
  })),

  updateVoiceParticipant: (userId, updates) => set(s => {
    const newVoice = {}
    Object.entries(s.voiceParticipants).forEach(([key, participants]) => {
      newVoice[key] = participants.map(p => p.userId === userId ? { ...p, ...updates } : p)
    })
    return { voiceParticipants: newVoice }
  }),

  setActiveVoiceChannel: (channel) => set({ activeVoiceChannel: channel }),

  // ===== STATUS =====
  updateUserStatus: (userId, status, lastSeen = null, customStatus = null) => set(s => ({
    memberStatuses: {
      ...s.memberStatuses,
      [userId]: { ...s.memberStatuses[userId], status, ...(lastSeen && { lastSeen }), ...(customStatus !== null && { customStatus }) }
    }
  })),

  incrementNotifications: () => set(s => ({ totalNotifications: s.totalNotifications + 1 })),
  clearNotifications: () => set({ totalNotifications: 0 }),

  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))
