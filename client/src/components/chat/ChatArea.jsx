import { useEffect, useCallback, useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import MembersSidebar from './MembersSidebar'
import api from '../../utils/api'

export default function ChatArea({ onBack }) {
  const { activeChannel, activeConversation, activeServer } = useChatStore()
  const { user } = useAuthStore()
  const { emit } = useSocketStore()
  const [showMembers, setShowMembers] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showPins, setShowPins] = useState(false)
  const [pinnedMessages, setPinnedMessages] = useState([])
  const [calling, setCalling] = useState(false)

  const active = activeChannel || activeConversation

  useEffect(() => {
    setShowSearch(false); setSearchQuery(''); setSearchResults([])
    setShowPins(false)
  }, [active?.id])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !activeChannel) return
    try {
      const { data } = await api.get(`/messages/channel/${activeChannel.id}/search?q=${encodeURIComponent(searchQuery)}`)
      setSearchResults(data)
    } catch {}
  }, [searchQuery, activeChannel])

  const loadPins = useCallback(async () => {
    if (!activeChannel) return
    try {
      const { data } = await api.get(`/channels/${activeChannel.id}/pins`)
      setPinnedMessages(data); setShowPins(true)
    } catch {}
  }, [activeChannel])

  const handleCall = (type) => {
    if (!activeConversation) return
    const other = activeConversation.participants?.find(p => p.id !== user?.id)
    if (!other) return
    emit('call:invite', { targetUserId: other.id, type, conversationId: activeConversation.id })
    setCalling(type)
    setTimeout(() => setCalling(false), 30000) // reset after 30s
  }

  if (!active) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background:'rgba(255,255,255,0.01)' }}>
        <div className="text-center px-8">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)', backdropFilter:'blur(20px)' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-indigo-400" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Добро пожаловать!</h2>
          <p className="text-slate-600 text-sm">Выберите канал или начните беседу</p>
        </div>
      </div>
    )
  }

  const isConversation = !!activeConversation
  const otherUser = isConversation ? activeConversation.participants?.find(p => p.id !== user?.id) : null
  const title = activeChannel ? activeChannel.name : (activeConversation?.type === 'group' ? activeConversation.name : otherUser?.display_name || 'Беседа')
  const isGroup = activeConversation?.type === 'group'

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background:'rgba(255,255,255,0.02)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile back */}
            <button onClick={onBack} className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="text-slate-500 font-mono text-base">{activeChannel ? '#' : isGroup ? '👥' : '💬'}</span>
            <h1 className="font-bold text-white text-base truncate">{title}</h1>
            {activeChannel?.description && (
              <><div className="w-px h-4 hidden md:block" style={{ background:'rgba(255,255,255,0.1)' }} />
              <p className="text-sm text-slate-500 truncate hidden md:block">{activeChannel.description}</p></>
            )}
            {isGroup && (
              <span className="text-xs text-slate-600 ml-1 hidden md:block">{activeConversation.participants?.length} участников</span>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Call buttons for DMs */}
            {isConversation && !isGroup && (
              <>
                <HeaderBtn onClick={() => handleCall('voice')} title="Голосовой звонок" active={calling === 'voice'}>
                  {calling === 'voice' ? '📞' : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.63 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.46-.46a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" strokeLinecap="round"/>
                  </svg>}
                </HeaderBtn>
                <HeaderBtn onClick={() => handleCall('video')} title="Видеозвонок" active={calling === 'video'}>
                  {calling === 'video' ? '📹' : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M23 7l-7 5 7 5V7zM1 5h13a2 2 0 012 2v10a2 2 0 01-2 2H1a2 2 0 01-2-2V7a2 2 0 012-2z" strokeLinecap="round"/>
                  </svg>}
                </HeaderBtn>
              </>
            )}
            {activeChannel && (
              <>
                <HeaderBtn onClick={() => { setShowSearch(p=>!p); setShowPins(false) }} active={showSearch} title="Поиск">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
                  </svg>
                </HeaderBtn>
                <HeaderBtn onClick={loadPins} active={showPins} title="Закреплённые">📌</HeaderBtn>
                <HeaderBtn onClick={() => setShowMembers(p=>!p)} active={showMembers} title="Участники" className="hidden md:flex">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round"/>
                  </svg>
                </HeaderBtn>
              </>
            )}
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 py-2 flex gap-2 flex-shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
            <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Поиск сообщений..."
              className="flex-1 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none"
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }} />
            <button onClick={handleSearch} className="btn-primary py-1.5 text-xs">Найти</button>
            <button onClick={() => { setShowSearch(false); setSearchResults([]) }} className="btn-secondary py-1.5 text-xs">✕</button>
          </div>
        )}

        {/* Pins */}
        {showPins && (
          <div className="flex-shrink-0 max-h-48 overflow-y-auto" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(99,102,241,0.04)' }}>
            <div className="flex items-center justify-between px-4 py-2">
              <h3 className="font-semibold text-sm text-white">📌 Закреплённые</h3>
              <button onClick={() => setShowPins(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            {pinnedMessages.length === 0
              ? <p className="text-slate-600 text-sm px-4 pb-3">Нет закреплённых сообщений</p>
              : pinnedMessages.map(msg => (
                <div key={msg.id} className="px-4 py-2 border-t" style={{ borderColor:'rgba(255,255,255,0.04)' }}>
                  <p className="text-xs text-indigo-400 mb-0.5 font-medium">{msg.display_name}</p>
                  <p className="text-sm text-slate-300 truncate">{msg.content}</p>
                </div>
              ))}
          </div>
        )}

        {/* Calling indicator */}
        {calling && (
          <div className="px-4 py-2 flex items-center gap-2 text-sm flex-shrink-0" style={{ background:'rgba(74,222,128,0.08)', borderBottom:'1px solid rgba(74,222,128,0.15)', color:'#4ade80' }}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Вызов... <button onClick={() => { emit('call:end', {}); setCalling(false) }} className="ml-auto text-xs text-red-400 hover:text-red-300">Отменить</button>
          </div>
        )}

        <MessageList
          searchResults={searchResults.length > 0 ? searchResults : null}
          channelId={activeChannel?.id}
          conversationId={activeConversation?.id}
        />
        <MessageInput channelId={activeChannel?.id} conversationId={activeConversation?.id} />
      </div>

      {showMembers && activeServer && <MembersSidebar members={activeServer.members || []} />}
    </div>
  )
}

function HeaderBtn({ onClick, children, title, active, className = '' }) {
  return (
    <button onClick={onClick} title={title}
      className={`p-2 rounded-xl transition-all ${active ? 'text-indigo-400 bg-indigo-500/15' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'} ${className}`}>
      {children}
    </button>
  )
}
