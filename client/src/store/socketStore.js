import { create } from 'zustand'
import { io } from 'socket.io-client'
import { useChatStore } from './chatStore'

let socketInstance = null

export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,

  connect: () => {
    const token = localStorage.getItem('wavechat_token')
    if (!token) return
    if (socketInstance) {
      if (!socketInstance.connected) socketInstance.connect()
      return
    }

    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    })

    socketInstance = socket

    socket.on('connect', () => {
      console.log('✅ Socket connected')
      set({ socket, connected: true })
    })

    socket.on('disconnect', () => {
      set({ connected: false })
    })

    socket.on('connect_error', (err) => {
      console.error('Socket error:', err.message)
      set({ connected: false })
    })

    // Message events
    socket.on('message:new', (message) => {
      useChatStore.getState().addMessage(message)
      window.dispatchEvent(new CustomEvent('wavechat:new-message', { detail: message }))
    })

    socket.on('message:edited', ({ messageId, content, editedAt }) => {
      useChatStore.getState().editMessage(messageId, content, editedAt)
    })

    socket.on('message:deleted', ({ messageId }) => {
      useChatStore.getState().deleteMessage(messageId)
    })

    socket.on('message:reactions', ({ messageId, reactions }) => {
      useChatStore.getState().updateReactions(messageId, reactions)
    })

    // Typing
    socket.on('typing:start', (data) => useChatStore.getState().addTyping(data))
    socket.on('typing:stop',  (data) => useChatStore.getState().removeTyping(data))

    // User status
    socket.on('user:online',  ({ userId }) => useChatStore.getState().updateUserStatus(userId, 'online'))
    socket.on('user:offline', ({ userId, lastSeen }) => useChatStore.getState().updateUserStatus(userId, 'offline', lastSeen))
    socket.on('user:status_updated', ({ userId, status, customStatus }) => useChatStore.getState().updateUserStatus(userId, status, null, customStatus))

    // Voice
    socket.on('voice:participants', ({ channelId, participants }) => useChatStore.getState().setVoiceParticipants(channelId, participants))
    socket.on('voice:user_joined',  (user) => useChatStore.getState().addVoiceParticipant(user))
    socket.on('voice:user_left',    ({ userId, channelId }) => useChatStore.getState().removeVoiceParticipant(channelId, userId))
    socket.on('voice:user_updated', ({ userId, muted, deafened }) => useChatStore.getState().updateVoiceParticipant(userId, { muted, deafened }))

    // Notifications
    socket.on('notification:new', () => useChatStore.getState().incrementNotifications())

    set({ socket })
  },

  disconnect: () => {
    if (socketInstance) {
      socketInstance.disconnect()
      socketInstance = null
    }
    set({ socket: null, connected: false })
  },

  getSocket: () => socketInstance,

  emit: (event, data, callback) => {
    if (socketInstance?.connected) {
      socketInstance.emit(event, data, callback)
    }
  }
}))
