import { useEffect, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { useSocketStore } from '../store/socketStore'
import ServerSidebar from '../components/chat/ServerSidebar'
import ChannelSidebar from '../components/chat/ChannelSidebar'
import ChatArea from '../components/chat/ChatArea'
import DMSidebar from '../components/chat/DMSidebar'
import VoicePanel from '../components/voice/VoicePanel'
import UserPanel from '../components/chat/UserPanel'
import CallModal from '../components/voice/CallModal'

export default function MainLayout() {
  const { loadServers, loadConversations, activeChannel, activeConversation, activeVoiceChannel } = useChatStore()
  const { connected, getSocket } = useSocketStore()
  const [view, setView] = useState('servers')
  const [mobileView, setMobileView] = useState('servers')
  const [incomingCall, setIncomingCall] = useState(null)

  // Fix mobile viewport height (address bar / keyboard)
  useEffect(() => {
    const updateVh = () => {
      const h = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${h}px`)
    }
    updateVh()
    window.addEventListener('resize', updateVh)
    window.visualViewport?.addEventListener('resize', updateVh)
    window.visualViewport?.addEventListener('scroll', updateVh)
    return () => {
      window.removeEventListener('resize', updateVh)
      window.visualViewport?.removeEventListener('resize', updateVh)
      window.visualViewport?.removeEventListener('scroll', updateVh)
    }
  }, [])

  useEffect(() => {
    loadServers()
    loadConversations()
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handleIncoming = (data) => setIncomingCall(data)
    socket.on('call:incoming', handleIncoming)
    socket.on('call:ended', () => setIncomingCall(null))
    socket.on('call:declined', () => setIncomingCall(null))
    return () => {
      socket.off('call:incoming', handleIncoming)
      socket.off('call:ended')
      socket.off('call:declined')
    }
  }, [connected])

  useEffect(() => {
    if (activeChannel || activeConversation) setMobileView('chat')
  }, [activeChannel?.id, activeConversation?.id])

  return (
    <div style={{
      display: 'flex', width: '100%',
      height: 'var(--app-height, 100dvh)',
      overflow: 'hidden', background: '#06070f',
    }}>

      {/* Server icon rail */}
      <div className={`flex-shrink-0 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        <ServerSidebar view={view} setView={setView} onNavigate={() => setMobileView('channels')} />
      </div>

      {/* Channel / DM sidebar */}
      <div className={`flex-shrink-0 flex flex-col ${mobileView === 'chat' ? 'hidden md:flex' : ''} md:flex`}
        style={{
          width: 240,
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'dms'
            ? <DMSidebar onSelect={() => setMobileView('chat')} />
            : <ChannelSidebar onSelect={() => setMobileView('chat')} />
          }
        </div>
        <UserPanel />
      </div>

      {/* Main chat area */}
      <div className={`flex-1 flex flex-col overflow-hidden ${mobileView !== 'chat' ? 'hidden md:flex' : 'flex'}`}>
        {!connected && (
          <div className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0"
            style={{ background: 'rgba(234,179,8,0.1)', borderBottom: '1px solid rgba(234,179,8,0.2)', color: '#facc15' }}>
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
            Переподключение...
          </div>
        )}
        <ChatArea onBack={() => setMobileView('channels')} />
        {activeVoiceChannel && <VoicePanel />}
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav md:hidden">
        <MobileNavBtn
          active={mobileView === 'servers' || mobileView === 'channels'}
          onClick={() => { setView('servers'); setMobileView('channels') }}
          label="Серверы"
          icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>}
        />
        <MobileNavBtn
          active={mobileView === 'dms' || (mobileView === 'chat' && !!activeConversation && !activeChannel)}
          onClick={() => { setView('dms'); setMobileView('dms') }}
          label="Беседы"
          icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>}
        />
        {(activeChannel || activeConversation) && (
          <MobileNavBtn
            active={mobileView === 'chat'}
            onClick={() => setMobileView('chat')}
            label="Чат"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round"/></svg>}
          />
        )}
      </nav>

      {incomingCall && <CallModal call={incomingCall} onClose={() => setIncomingCall(null)} />}
    </div>
  )
}

function MobileNavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '4px 16px', borderRadius: 12, transition: 'all 0.15s',
      color: active ? '#818cf8' : '#4b5563',
      background: active ? 'rgba(99,102,241,0.1)' : 'transparent'
    }}>
      {icon}
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
      {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6366f1' }} />}
    </button>
  )
}
