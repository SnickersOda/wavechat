import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import api from '../../utils/api'

export default function JoinServerModal({ onClose }) {
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { addServer, setActiveServer } = useChatStore()

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase()
    if (!code) { setError('Введите код приглашения'); return }
    setLoading(true); setError('')
    try {
      const { data } = await api.post(`/servers/join/${code}`)
      addServer(data)
      setActiveServer(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Неверный или истёкший код приглашения')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="px-6 py-5 border-b border-dark-border">
          <h2 className="font-bold text-white text-lg">🔗 Присоединиться к серверу</h2>
          <p className="text-sm text-slate-400 mt-1">Введите код приглашения</p>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Код приглашения</label>
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              className="input-field font-mono tracking-widest text-center text-lg uppercase"
              placeholder="XXXXXXXX" maxLength={20} autoFocus />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Отмена</button>
            <button onClick={handleJoin} disabled={loading || !inviteCode.trim()} className="btn-primary flex-1">
              {loading ? 'Присоединение...' : 'Войти'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
