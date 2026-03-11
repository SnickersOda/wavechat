import { useRef, useState, useCallback, useEffect } from 'react'
import { useSocketStore } from '../store/socketStore'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}

export function useWebRTC() {
  const { getSocket } = useSocketStore()
  const localStreamRef = useRef(null)
  const peerConnectionsRef = useRef({})
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({})
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const getLocalStream = useCallback(async (video = false, audio = true) => {
    // Reuse existing stream if already have one
    if (localStreamRef.current) {
      const hasAudio = localStreamRef.current.getAudioTracks().length > 0
      const hasVideo = localStreamRef.current.getVideoTracks().length > 0
      if ((!audio || hasAudio) && (!video || hasVideo)) return localStreamRef.current
      // Stop old tracks before getting new ones
      localStreamRef.current.getTracks().forEach(t => t.stop())
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video })
      localStreamRef.current = stream
      setLocalStream(stream)
      return stream
    } catch (err) {
      console.error('Failed to get media:', err)
      throw err
    }
  }, [])

  const createPeerConnection = useCallback((targetSocketId) => {
    const socket = getSocket()

    // Close existing PC for this target if any
    if (peerConnectionsRef.current[targetSocketId]) {
      peerConnectionsRef.current[targetSocketId].close()
    }

    const pc = new RTCPeerConnection(ICE_SERVERS)

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:ice_candidate', { targetSocketId, candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0]
      if (stream) {
        setRemoteStreams(prev => ({ ...prev, [targetSocketId]: stream }))
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`WebRTC [${targetSocketId}] state:`, pc.connectionState)
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStreams(prev => {
          const next = { ...prev }
          delete next[targetSocketId]
          return next
        })
        delete peerConnectionsRef.current[targetSocketId]
      }
    }

    // Add local tracks to PC BEFORE creating offer/answer
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    peerConnectionsRef.current[targetSocketId] = pc
    return pc
  }, [getSocket])

  // Caller side: send offer
  const initiateCall = useCallback(async (targetSocketId, channelOrConvId) => {
    const socket = getSocket()
    if (!socket) return

    // Make sure we have local stream before creating PC
    if (!localStreamRef.current) {
      await getLocalStream(false, true)
    }

    const pc = createPeerConnection(targetSocketId)
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false })
    await pc.setLocalDescription(offer)
    socket.emit('webrtc:offer', { targetSocketId, offer, channelId: channelOrConvId })
  }, [createPeerConnection, getSocket, getLocalStream])

  // Callee side: receive offer, send answer
  const handleOffer = useCallback(async (fromSocketId, offer) => {
    const socket = getSocket()
    if (!socket) return

    // Make sure we have local stream
    if (!localStreamRef.current) {
      try { await getLocalStream(false, true) } catch { console.warn('No mic') }
    }

    const pc = createPeerConnection(fromSocketId)
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socket.emit('webrtc:answer', { targetSocketId: fromSocketId, answer })
  }, [createPeerConnection, getSocket, getLocalStream])

  const handleAnswer = useCallback(async (fromSocketId, answer) => {
    const pc = peerConnectionsRef.current[fromSocketId]
    if (pc && pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }
  }, [])

  const handleIceCandidate = useCallback(async (fromSocketId, candidate) => {
    const pc = peerConnectionsRef.current[fromSocketId]
    if (pc) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
      setIsMuted(prev => !prev)
    }
  }, [])

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
      setIsVideoOff(prev => !prev)
    }
  }, [])

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const videoTrack = screenStream.getVideoTracks()[0]
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(videoTrack)
      })
      setIsScreenSharing(true)
      videoTrack.onended = () => stopScreenShare()
    } catch (err) { console.error('Screen share failed:', err) }
  }, [])

  const stopScreenShare = useCallback(async () => {
    if (localStreamRef.current) {
      const camTrack = localStreamRef.current.getVideoTracks()[0]
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender && camTrack) sender.replaceTrack(camTrack)
      })
    }
    setIsScreenSharing(false)
  }, [])

  const cleanup = useCallback(() => {
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close())
    peerConnectionsRef.current = {}
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    setLocalStream(null)
    setRemoteStreams({})
    setIsMuted(false)
    setIsVideoOff(false)
    setIsScreenSharing(false)
  }, [])

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onOffer = ({ fromSocketId, offer }) => handleOffer(fromSocketId, offer)
    const onAnswer = ({ fromSocketId, answer }) => handleAnswer(fromSocketId, answer)
    const onIce = ({ fromSocketId, candidate }) => handleIceCandidate(fromSocketId, candidate)

    socket.on('webrtc:offer', onOffer)
    socket.on('webrtc:answer', onAnswer)
    socket.on('webrtc:ice_candidate', onIce)

    return () => {
      socket.off('webrtc:offer', onOffer)
      socket.off('webrtc:answer', onAnswer)
      socket.off('webrtc:ice_candidate', onIce)
    }
  }, [getSocket, handleOffer, handleAnswer, handleIceCandidate])

  return {
    localStream, remoteStreams,
    isMuted, isVideoOff, isScreenSharing,
    getLocalStream, initiateCall,
    toggleMute, toggleVideo,
    startScreenShare, stopScreenShare,
    cleanup
  }
}
