import { useEffect, useMemo, useRef } from 'react'
import { useSocketStore } from '../../store/socketStore'
import { useCallStore } from '../../store/callStore'
import { useWebRTC } from '../../hooks/useWebRTC'
import { getInitials } from '../../utils/helpers'

export default function DirectCallOverlay() {
  const { emit } = useSocketStore()
  const { activeCall, endCallLocal } = useCallStore()
  const { localStream, remoteStreams, getLocalStream, initiateCall, cleanup, toggleMute, toggleVideo, isMuted, isVideoOff } = useWebRTC()
  const startedRef = useRef(false)

  const peerStream = useMemo(() => {
    if (!activeCall?.peerSocketId) return null
    return remoteStreams[activeCall.peerSocketId] || null
  }, [activeCall?.peerSocketId, remoteStreams])

  // Start WebRTC on caller side once accepted
  useEffect(() => {
    if (!activeCall) return
    if (activeCall.status !== 'active') return
    if (!activeCall.isCaller) return
    if (!activeCall.peerSocketId) return
    if (startedRef.current) return

    startedRef.current = true
    ;(async () => {
      try {
        await getLocalStream(activeCall.type === 'video', true)
        await initiateCall(activeCall.peerSocketId, null)
      } catch (e) {
        emit('call:end', { conversationId: activeCall.conversationId })
        endCallLocal(activeCall.conversationId)
        cleanup()
      }
    })()
  }, [activeCall, cleanup, emit, endCallLocal, getLocalStream, initiateCall])

  // Cleanup when call ends
  useEffect(() => {
    if (!activeCall) {
      startedRef.current = false
      cleanup()
    }
  }, [activeCall, cleanup])

  if (!activeCall) return null

  const peerName = activeCall.peerUser?.display_name || activeCall.peerUser?.username || 'Собеседник'

  const endCall = () => {
    emit('call:end', { conversationId: activeCall.conversationId })
    endCallLocal(activeCall.conversationId)
    cleanup()
  }

  const acceptCall = async () => {
    try {
      await getLocalStream(activeCall.type === 'video', true)
      emit('call:accept', {
        conversationId: activeCall.conversationId,
        fromSocketId: activeCall.peerSocketId,
        type: activeCall.type,
      })
      // callee waits for offer; hook will answer automatically via webrtc:offer handler
    } catch {
      alert('Нет доступа к микрофону/камере')
    }
  }

  const declineCall = () => {
    emit('call:decline', { conversationId: activeCall.conversationId, fromSocketId: activeCall.peerSocketId })
    endCallLocal(activeCall.conversationId)
    cleanup()
  }

  return (
    <div className="call-overlay">
      <div className="call-box" style={{ width: activeCall.status === 'active' ? 520 : 320 }}>
        <div className="flex flex-col items-center">
          {activeCall.status !== 'active' && (
            <>
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="absolute w-28 h-28 rounded-full animate-ring" style={{ background: 'rgba(74,222,128,0.15)' }} />
                <div className="absolute w-20 h-20 rounded-full animate-ring" style={{ background: 'rgba(74,222,128,0.2)', animationDelay: '0.4s' }} />
                {activeCall.peerUser?.avatar ? (
                  <img
                    src={activeCall.peerUser.avatar}
                    className="relative w-20 h-20 rounded-full object-cover z-10 ring-2 ring-green-400/60"
                    alt=""
                  />
                ) : (
                  <div
                    className="relative w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold z-10 ring-2 ring-green-400/60"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                  >
                    {getInitials(peerName)}
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-500 mb-1">
                {activeCall.isCaller ? 'Исходящий' : 'Входящий'} {activeCall.type === 'video' ? 'видео' : 'голосовой'} звонок
              </p>
              <h2 className="text-xl font-bold text-white mb-8">{peerName}</h2>

              <div className="flex items-center justify-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={declineCall}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl transition-all hover:scale-110 active:scale-95"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.45)' }}
                  >
                    📵
                  </button>
                  <span className="text-xs text-slate-500">{activeCall.isCaller ? 'Отменить' : 'Отклонить'}</span>
                </div>

                {!activeCall.isCaller && (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={acceptCall}
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl transition-all hover:scale-110 active:scale-95"
                      style={{ background: 'linear-gradient(135deg,#4ade80,#22c55e)', boxShadow: '0 4px 20px rgba(74,222,128,0.45)' }}
                    >
                      {activeCall.type === 'video' ? '📹' : '📞'}
                    </button>
                    <span className="text-xs text-slate-500">Принять</span>
                  </div>
                )}
              </div>
            </>
          )}

          {activeCall.status === 'active' && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-500">Звонок с</p>
                  <p className="text-lg font-bold text-white">{peerName}</p>
                </div>
                <button onClick={endCall} className="btn-danger py-2 px-4 text-sm">
                  Завершить
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <VideoTile stream={peerStream} muted={false} label="Собеседник" />
                <VideoTile stream={localStream} muted label="Вы" />
              </div>

              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={toggleMute} className="btn-secondary py-2 px-4 text-sm">
                  {isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                </button>
                {activeCall.type === 'video' && (
                  <button onClick={toggleVideo} className="btn-secondary py-2 px-4 text-sm">
                    {isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function VideoTile({ stream, muted, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null
  }, [stream])

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', minHeight: 180 }}
    >
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">{label}: нет видео</div>
      )}
    </div>
  )
}

