import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../utils/helpers'
import CreateServerModal from './CreateServerModal'
import JoinServerModal from './JoinServerModal'

export default function ServerSidebar({ view, setView, onNavigate }) {
  const { servers, activeServer, setActiveServer } = useChatStore()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="w-[72px] flex-shrink-0 flex flex-col items-center py-3 gap-2 overflow-y-auto no-scrollbar"
      style={{ background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      {/* DMs button */}
      <button
        onClick={() => { setView('dms'); useChatStore.getState().setActiveServer(null) }}
        className={`sidebar-icon text-white/90 ${view === 'dms' && !activeServer ? 'active' : 'bg-dark-300 hover:bg-wave-600'}`}
        title="Личные сообщения"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      </button>

      {/* Separator */}
      <div className="w-8 h-0.5 bg-dark-border rounded-full" />

      {/* Server icons */}
      {servers.map(server => (
        <ServerIcon
          key={server.id}
          server={server}
          isActive={activeServer?.id === server.id}
          onClick={() => { setView('servers'); setActiveServer(server); onNavigate?.() }}
        />
      ))}

      {/* Add server */}
      <div className="relative">
        <button
          onClick={() => setShowAdd(prev => !prev)}
          className="sidebar-icon bg-dark-300 text-green-400 hover:bg-green-500 hover:text-white"
          title="Добавить сервер"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>

        {showAdd && (
          <div className="absolute left-16 top-0 bg-dark-200 border border-dark-border rounded-xl shadow-2xl w-48 py-2 z-50 animate-slide-in">
            <button onClick={() => { setShowCreate(true); setShowAdd(false) }}
              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-dark-hover hover:text-white transition-colors">
              ✨ Создать сервер
            </button>
            <button onClick={() => { setShowJoin(true); setShowAdd(false) }}
              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-dark-hover hover:text-white transition-colors">
              🔗 Присоединиться
            </button>
          </div>
        )}
      </div>

      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinServerModal onClose={() => setShowJoin(false)} />}
    </div>
  )
}

function ServerIcon({ server, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative sidebar-icon transition-all duration-200 overflow-hidden ${
        isActive ? 'rounded-xl shadow-lg shadow-wave-600/30' : 'bg-dark-300'
      }`}
      title={server.name}
    >
      {isActive && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-white rounded-r-full" />
      )}
      {server.icon ? (
        <img src={server.icon} alt={server.name} className="w-12 h-12 rounded-2xl object-cover" />
      ) : (
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm ${
          isActive ? 'bg-wave-600' : 'bg-dark-300 hover:bg-wave-600'
        }`}>
          {getInitials(server.name)}
        </div>
      )}
    </button>
  )
}
