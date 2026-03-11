import { useState, useEffect, useRef } from 'react'
import { useSocketStore } from '../../store/socketStore'
import { useWebRTC } from '../../hooks/useWebRTC'
import { getInitials } from '../../utils/helpers'

export default function CallModal({ call, onClose }) {
  const { emit, getSocket } = useSocketStore()
  const { getLocalStream, initiateCall, remoteStreams, cleanup } = useWebRTC()
  const [status, setStatus] = useState('ringing') // ringing | calling | active
  const audioRefs = useRef({})

  // Ringtone
  useEffect(() => {
    if (status !== 'ringing') return
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const beep = () => {
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 520
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
    }
    const id = setInterval(beep, 1800); beep()
    return () => { clearInterval(id); ctx.close() }
  }, [status])

  // Play remote audio streams
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([socketId, stream]) => {
      if (!audioRefs.current[socketId]) {
        const audio = new Audio()
        audio.srcObject = stream
        audio.autoplay = true
        audio.volume = 1
        audio.play().catch(() => {})
        audioRefs.current[socketId] = audio
      }
    })
    // Cleanup stale audio elements
    Object.keys(audioRefs.current).forEach(sid => {
      if (!remoteStreams[sid]) {
        audioRefs.current[sid].srcObject = null
        delete audioRefs.current[sid]
      }
    })
  }, [remoteStreams])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(a => { a.srcObject = null })
      audioRefs.current = {}
    }
  }, [])

  // Listen for call:accepted (callee side — when OTHER person accepted OUR call)
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handleAccepted = async ({ fromSocketId }) => {
      // Other side accepted — now initiate WebRTC from our side
      setStatus('active')
      await initiateCall(fromSocketId, call.conversationId)
    }
    socket.on('call:accepted', handleAccepted)
    return () => socket.off('call:accepted', handleAccepted)
  }, [call.conversationId, initiateCall, getSocket])

  // Listen for call ended/declined while active
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handleEnd = () => { cleanup(); onClose() }
    socket.on('call:ended', handleEnd)
    socket.on('call:declined', handleEnd)
    return () => {
      socket.off('call:ended', handleEnd)
      socket.off('call:declined', handleEnd)
    }
  }, [cleanup, onClose, getSocket])

  const handleAccept = async () => {
    try {
      await getLocalStream(call.type === 'video', true)
      // Tell caller we accepted — they will initiate WebRTC offer
      emit('call:accept', { fromSocketId: call.fromSocketId, type: call.type })
      setStatus('active')
    } catch {
      alert('Нет доступа к микрофону')
    }
  }

  const handleDecline = () => {
    emit('call:decline', { fromSocketId: call.fromSocketId })
    cleanup()
    onClose()
  }

  const handleEnd = () => {
    emit('call:end', { targetSocketId: call.fromSocketId })
    cleanup()
    onClose()
  }

  const from = call.from

  if (status === 'active') {
    return (
      <div className="call-overlay">
        <div className="call-box">
          <div className="relative inline-flex items-center justify-center mb-4">
            {from?.avatar
              ? <img src={from.avatar} className="w-16 h-16 rounded-full object-cover ring-2 ring-green-400/60" alt="" />
              : <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold ring-2 ring-green-400/60"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  {getInitials(from?.display_name)}
                </div>
            }
            {/* Green pulse = connected */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-[#06070f]" />
          </div>

          <p className="text-xs text-green-400 font-semibold mb-1">● Звонок активен</p>
          <h2 className="text-lg font-bold text-white mb-6">{from?.display_name}</h2>

          <button onClick={handleEnd}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl mx-auto transition-all hover:scale-110 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.45)' }}>
            📵
          </button>
          <p className="text-xs text-slate-500 mt-2">Завершить</p>
        </div>
      </div>
    )
  }

  return (
    <div className="call-overlay">
      <div className="call-box">
        {/* Ripple */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="absolute w-28 h-28 rounded-full animate-ring" style={{ background: 'rgba(74,222,128,0.15)' }} />
          <div className="absolute w-20 h-20 rounded-full animate-ring" style={{ background: 'rgba(74,222,128,0.2)', animationDelay: '0.4s' }} />
          {from?.avatar
            ? <img src={from.avatar} className="relative w-20 h-20 rounded-full object-cover z-10 ring-2 ring-green-400/60" alt="" />
            : <div className="relative w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold z-10 ring-2 ring-green-400/60"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                {getInitials(from?.display_name)}
              </div>
          }
        </div>

        <p className="text-sm text-slate-500 mb-1">
          Входящий {call.type === 'video' ? 'видео' : 'голосовой'} звонок
        </p>
        <h2 className="text-xl font-bold text-white mb-8">{from?.display_name}</h2>

        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <button onClick={handleDecline}
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl transition-all hover:scale-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.45)' }}>
              📵
            </button>
            <span className="text-xs text-slate-500">Отклонить</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={handleAccept}
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl transition-all hover:scale-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#4ade80,#22c55e)', boxShadow: '0 4px 20px rgba(74,222,128,0.45)' }}>
              {call.type === 'video' ? '📹' : '📞'}
            </button>
            <span className="text-xs text-slate-500">Принять</span>
          </div>
        </div>
      </div>
    </div>
  )
}
