import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useSocketStore } from '../../store/socketStore'
import { useWebRTC } from '../../hooks/useWebRTC'
import { getInitials } from '../../utils/helpers'
import { useAuthStore } from '../../store/authStore'

export default function VoicePanel() {
  const { activeVoiceChannel, voiceParticipants, setActiveVoiceChannel } = useChatStore()
  const { emit, getSocket } = useSocketStore()
  const { user } = useAuthStore()
  const { localStream, remoteStreams, isMuted, isVideoOff, isScreenSharing, getLocalStream, initiateCall, toggleMute, toggleVideo, startScreenShare, stopScreenShare, cleanup } = useWebRTC()
  const [showVideo, setShowVideo] = useState(false)
  const localVideoRef = useRef(null)
  const channelId = activeVoiceChannel?.id
  const participants = voiceParticipants[channelId] || []

  useEffect(() => {
    if (!channelId) return
    getLocalStream(false, true).catch(() => {})
    return () => cleanup()
  }, [channelId])

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    const socket = getSocket(); if (!socket) return
    const handle = async ({ socketId, userId: uid }) => {
      if (uid === user?.id) return
      setTimeout(() => initiateCall(socketId, channelId), 500)
    }
    socket.on('voice:user_joined', handle)
    return () => socket.off('voice:user_joined', handle)
  }, [channelId])

  const handleLeave = () => { emit('voice:leave', { channelId }); setActiveVoiceChannel(null); cleanup() }
  const handleMute  = () => { toggleMute(); emit('voice:toggle_mute', { channelId }) }
  const handleVideo = async () => {
    if (isVideoOff || !localStream?.getVideoTracks().length) { await getLocalStream(true, true); setShowVideo(true) }
    else toggleVideo()
    emit('voice:toggle_mute', { channelId })
  }

  if (!activeVoiceChannel) return null

  return (
    <div className="voice-bar flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-semibold">Голос</span>
        </div>
        <span className="text-xs text-slate-400 truncate">🔊 {activeVoiceChannel.name}</span>
        {/* Participant dots */}
        <div className="flex -space-x-1 ml-1">
          {participants.slice(0,5).map(p => (
            <div key={p.userId} title={p.displayName} className="relative">
              {p.avatar
                ? <img src={p.avatar} className="w-5 h-5 rounded-full object-cover ring-1 ring-black" alt="" />
                : <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold ring-1 ring-black" style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>{getInitials(p.displayName)}</div>
              }
              {p.muted && <div className="absolute -bottom-0.5 -right-0.5 text-[8px]">🔇</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <VBtn onClick={handleMute}      active={isMuted}         danger={isMuted}    title={isMuted?'Включить микрофон':'Выключить'}>
          {isMuted ? '🔇' : '🎙️'}
        </VBtn>
        <VBtn onClick={handleVideo}     active={isVideoOff}      danger={isVideoOff} title="Видео">📹</VBtn>
        <VBtn onClick={isScreenSharing ? stopScreenShare : startScreenShare} active={isScreenSharing} title="Экран">🖥️</VBtn>
        <button onClick={handleLeave}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-105 ml-1"
          style={{ background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'white', boxShadow:'0 2px 10px rgba(239,68,68,0.35)' }}>
          Выйти
        </button>
      </div>

      {showVideo && (
        <div className="fixed bottom-16 right-4 flex flex-wrap gap-2 z-30">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-36 h-24 rounded-2xl object-cover" style={{ background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)' }} />
          {Object.entries(remoteStreams).map(([sid, stream]) => (
            <video key={sid} autoPlay playsInline ref={el=>{ if(el) el.srcObject=stream }}
              className="w-36 h-24 rounded-2xl object-cover" style={{ background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)' }} />
          ))}
        </div>
      )}
    </div>
  )
}

function VBtn({ onClick, children, title, active, danger }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all hover:scale-110 ${
        danger && active ? 'bg-red-500/20 text-red-400' : active ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-white/10'
      }`}>
      {children}
    </button>
  )
}
