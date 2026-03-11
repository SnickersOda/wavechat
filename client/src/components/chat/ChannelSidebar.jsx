import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useSocketStore } from '../../store/socketStore'
import { parseChannelType, getStatusColor } from '../../utils/helpers'
import CreateChannelModal from './CreateChannelModal'
import ServerSettingsModal from './ServerSettingsModal'

export default function ChannelSidebar({ onSelect }) {
  const { activeServer, channels, activeChannel, setActiveChannel, voiceParticipants } = useChatStore()
  const { emit } = useSocketStore()
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [collapsed, setCollapsed] = useState({})

  if (!activeServer) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-slate-500 text-sm text-center">
        <div>
          <div className="text-4xl mb-2">🌊</div>
          Выберите сервер
        </div>
      </div>
    )
  }

  const textChannels = channels.filter(c => c.type === 'text' || c.type === 'announcement')
  const voiceChannels = channels.filter(c => c.type === 'voice')

  const handleChannelClick = (channel) => {
    if (channel.type === 'voice') return
    setActiveChannel(channel)
    emit('channel:join', channel.id)
    onSelect?.()
  }

  const isAdmin = ['owner', 'admin'].includes(activeServer.role)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Server header */}
      <button
        onClick={() => isAdmin && setShowServerSettings(true)}
        className="flex items-center justify-between px-4 py-3 border-b border-dark-border hover:bg-dark-hover transition-colors group"
      >
        <h2 className="font-bold text-white text-sm truncate">{activeServer.name}</h2>
        {isAdmin && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-500 group-hover:text-slate-300">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {/* Text channels */}
        <CategoryHeader
          label="Текстовые каналы"
          onAdd={isAdmin ? () => setShowCreateChannel(true) : null}
          collapsed={collapsed.text}
          onToggle={() => setCollapsed(c => ({ ...c, text: !c.text }))}
        />
        {!collapsed.text && textChannels.map(ch => (
          <div key={ch.id}
            onClick={() => handleChannelClick(ch)}
            className={`channel-item ${activeChannel?.id === ch.id ? 'active bg-dark-hover text-white' : ''}`}>
            <span className="text-slate-500 font-mono text-xs">{parseChannelType(ch.type)}</span>
            <span className="flex-1 truncate">{ch.name}</span>
            {ch.type === 'announcement' && (
              <span className="text-xs bg-wave-600/20 text-wave-300 px-1.5 py-0.5 rounded-full">объявления</span>
            )}
          </div>
        ))}

        {/* Voice channels */}
        <div className="mt-2" />
        <CategoryHeader
          label="Голосовые каналы"
          onAdd={isAdmin ? () => setShowCreateChannel(true) : null}
          collapsed={collapsed.voice}
          onToggle={() => setCollapsed(c => ({ ...c, voice: !c.voice }))}
        />
        {!collapsed.voice && voiceChannels.map(ch => {
          const participants = voiceParticipants[ch.id] || []
          return (
            <div key={ch.id}>
              <VoiceChannelItem channel={ch} participants={participants} />
            </div>
          )
        })}
      </div>

      {showCreateChannel && (
        <CreateChannelModal serverId={activeServer.id} onClose={() => setShowCreateChannel(false)} />
      )}
      {showServerSettings && (
        <ServerSettingsModal server={activeServer} onClose={() => setShowServerSettings(false)} />
      )}
    </div>
  )
}

function CategoryHeader({ label, onAdd, collapsed, onToggle }) {
  return (
    <div className="flex items-center gap-1 px-1 py-1 group">
      <button onClick={onToggle} className="flex items-center gap-1 flex-1 text-left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`w-3 h-3 text-slate-500 transition-transform ${collapsed ? '-rotate-90' : ''}`}>
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </button>
      {onAdd && (
        <button onClick={onAdd} className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

function VoiceChannelItem({ channel, participants }) {
  const { activeVoiceChannel, setActiveVoiceChannel } = useChatStore()
  const { emit } = useSocketStore()
  const isActive = activeVoiceChannel?.id === channel.id

  const handleClick = async () => {
    if (isActive) {
      emit('voice:leave', { channelId: channel.id })
      setActiveVoiceChannel(null)
    } else {
      // Check if already in another channel
      if (activeVoiceChannel) {
        emit('voice:leave', { channelId: activeVoiceChannel.id })
      }
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        emit('voice:join', { channelId: channel.id })
        setActiveVoiceChannel(channel)
      } catch {
        alert('Нет доступа к микрофону')
      }
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className={`channel-item ${isActive ? 'active text-green-400' : ''}`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-500 flex-shrink-0">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <span className="flex-1 truncate">{channel.name}</span>
        {participants.length > 0 && (
          <span className="text-xs text-slate-500">{participants.length}</span>
        )}
      </div>
      {participants.map(p => (
        <div key={p.userId} className="flex items-center gap-2 pl-8 py-0.5 text-xs text-slate-400">
          <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0">
            {p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" /> :
              <div className="w-full h-full bg-wave-600 flex items-center justify-center text-white text-xs font-bold">{p.displayName?.[0]}</div>}
          </div>
          <span className="truncate">{p.displayName}</span>
          {p.muted && <span className="text-red-400">🔇</span>}
        </div>
      ))}
    </div>
  )
}
