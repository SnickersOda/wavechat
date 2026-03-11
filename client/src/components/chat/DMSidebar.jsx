import { useState, useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { getInitials, getStatusColor, formatMessageTime } from '../../utils/helpers'
import CreateGroupModal from './CreateGroupModal'
import api from '../../utils/api'

export default function DMSidebar({ onSelect }) {
  const { conversations, activeConversation, setActiveConversation, addConversation, loadConversations, updateConversation } = useChatStore()
  const { user } = useAuthStore()
  const { connected } = useSocketStore()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showGroup, setShowGroup] = useState(false)

  useEffect(() => { if (connected) loadConversations() }, [connected])

  useEffect(() => {
    if (!activeConversation) return
    updateConversation(activeConversation.id, { unread_count: 0 })
  }, [activeConversation?.id])

  const handleSearch = async (q) => {
    setSearch(q)
    if (!q.trim() || q.length < 2) { setSearchResults([]); return }
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
      setSearchResults(data)
    } catch {}
  }

  const openDM = async (u) => {
    try {
      const { data } = await api.post(`/dm/open/${u.id}`)
      addConversation(data)
      setActiveConversation(data)
      setSearch(''); setSearchResults([])
      onSelect?.()
    } catch (e) { console.error(e) }
  }

  const handleSelect = (conv) => {
    setActiveConversation(conv)
    updateConversation(conv.id, { unread_count: 0 })
    onSelect?.()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 space-y-2" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Найти беседу..."
              className="w-full rounded-xl px-3 py-2 text-xs placeholder-slate-500 outline-none"
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#e2e8f0' }} />
            <svg className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
            </svg>
          </div>
          <button onClick={() => setShowGroup(true)} title="Создать группу"
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow:'0 2px 10px rgba(99,102,241,0.35)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
            {searchResults.map(u => (
              <button key={u.id} onClick={() => openDM(u)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left transition-colors">
                <Avatar user={u} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{u.display_name}</p>
                  <p className="text-xs text-slate-500">@{u.username}</p>
                </div>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getStatusColor(u.status) }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-2 mb-2">Беседы</p>

        {conversations.length === 0 && (
          <div className="text-center py-10 px-4">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-slate-600 text-sm">Нет бесед</p>
            <p className="text-slate-700 text-xs mt-1">Найди кого-нибудь выше или создай группу</p>
          </div>
        )}

        {conversations.map(conv => {
          const others = conv.participants?.filter(p => p.id !== user?.id) || []
          const other = others[0]
          const name = conv.type === 'group' ? conv.name : (other?.display_name || 'Неизвестно')
          const isActive = activeConversation?.id === conv.id
          const unread = isActive ? 0 : (conv.unread_count || 0)

          return (
            <button key={conv.id} onClick={() => handleSelect(conv)}
              className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl transition-all mb-0.5 text-left ${isActive ? 'bg-white/[0.07] ring-1 ring-white/10' : 'hover:bg-white/[0.04]'}`}>
              <div className="relative flex-shrink-0">
                {conv.type === 'group'
                  ? <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold" style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                      {getInitials(conv.name)}
                    </div>
                  : <Avatar user={other} size="lg" />
                }
                {conv.type !== 'group' && other && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ borderColor:'#06070f', backgroundColor: getStatusColor(other.status) }} />
                )}
                {conv.type === 'group' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px]" style={{ borderColor:'#06070f', background:'rgba(99,102,241,0.8)' }}>
                    {conv.participants?.length || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>{name}</span>
                  {conv.last_message_at && !isActive && (
                    <span className="text-[10px] text-slate-600 flex-shrink-0 ml-1 tabular-nums">{formatMessageTime(conv.last_message_at)}</span>
                  )}
                </div>
                {conv.last_message && (
                  <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-slate-400 font-medium' : 'text-slate-600'}`}>{conv.last_message}</p>
                )}
              </div>
              {unread > 0 && <div className="unread-badge">{unread > 99 ? '99+' : unread}</div>}
            </button>
          )
        })}
      </div>

      {showGroup && <CreateGroupModal onClose={() => setShowGroup(false)} />}
    </div>
  )
}

function Avatar({ user, size = 'md' }) {
  const cls = size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  if (!user) return <div className={`${cls} rounded-full bg-white/10`} />
  return user.avatar
    ? <img src={user.avatar} className={`${cls} rounded-full object-cover flex-shrink-0`} alt="" />
    : <div className={`${cls} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
        style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
        {getInitials(user.display_name || user.username)}
      </div>
}
