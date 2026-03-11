import { create } from 'zustand'
import api from '../utils/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  initialized: false,

  initialize: async () => {
    const token = localStorage.getItem('wavechat_token')
    if (!token) {
      set({ initialized: true })
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data, token, initialized: true })
    } catch {
      localStorage.removeItem('wavechat_token')
      set({ user: null, token: null, initialized: true })
    }
  },

  login: async (login, password) => {
    const { data } = await api.post('/auth/login', { login, password })
    localStorage.setItem('wavechat_token', data.token)
    if (data.user?.id) localStorage.setItem('wavechat_uid', data.user.id)
    set({ user: data.user, token: data.token })
    return data
  },

  register: async (username, email, password, displayName) => {
    const { data } = await api.post('/auth/register', { username, email, password, displayName })
    localStorage.setItem('wavechat_token', data.token)
    if (data.user?.id) localStorage.setItem('wavechat_uid', data.user.id)
    set({ user: data.user, token: data.token })
    return data
  },

  logout: () => {
    localStorage.removeItem('wavechat_token')
    localStorage.removeItem('wavechat_uid')
    set({ user: null, token: null })
  },

  updateUser: (updates) => {
    set(state => ({ user: { ...state.user, ...updates } }))
  },

  updateProfile: async (updates) => {
    const { data } = await api.put('/auth/me', updates)
    set({ user: data })
    return data
  }
}))
