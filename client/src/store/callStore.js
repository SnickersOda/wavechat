import { create } from 'zustand'

export const useCallStore = create((set) => ({
  activeCall: null, // { type, conversationId, fromUser, peerUser, status, isCaller, peerSocketId }

  startOutgoingCall: ({ conversationId, type, peerUser }) =>
    set({
      activeCall: {
        conversationId,
        type,
        fromUser: null,
        peerUser,
        status: 'ringing',
        isCaller: true,
        peerSocketId: null,
      },
    }),

  receiveIncomingCall: ({ conversationId, type, from, fromSocketId }) =>
    set({
      activeCall: {
        conversationId,
        type,
        fromUser: from,
        peerUser: from,
        status: 'ringing',
        isCaller: false,
        // for incoming calls we already know caller socketId
        peerSocketId: fromSocketId || null,
      },
    }),

  setCallAccepted: ({ conversationId, peerSocketId }) =>
    set((state) => {
      if (!state.activeCall || state.activeCall.conversationId !== conversationId) return state
      return {
        activeCall: {
          ...state.activeCall,
          status: 'active',
          peerSocketId: peerSocketId || state.activeCall.peerSocketId,
        },
      }
    }),

  setCallDeclined: (conversationId) =>
    set((state) => {
      if (!state.activeCall || state.activeCall.conversationId !== conversationId) return state
      return { activeCall: null }
    }),

  endCallLocal: (conversationId) =>
    set((state) => {
      if (!state.activeCall) return state
      if (conversationId && state.activeCall.conversationId !== conversationId) return state
      return { activeCall: null }
    }),
}))

