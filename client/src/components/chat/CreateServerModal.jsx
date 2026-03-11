import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import api from '../../utils/api'

export default function CreateServerModal({ onClose }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { addServer, setActiveServer } = useChatStore()

  const handleCreate = async () => {
    if (!name.trim()) { setError('Введите название'); return }
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/servers', { name: name.trim(), description })
      addServer(data)
      setActiveServer(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания сервера')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="px-6 py-5 border-b border-dark-border">
          <h2 className="font-bold text-white text-lg">✨ Создать сервер</h2>
          <p className="text-sm text-slate-400 mt-1">Ваш сервер — ваши правила. Создайте сообщество!</p>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Название сервера *</label>
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="input-field" placeholder="Мой крутой сервер" maxLength={100} autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="input-field resize-none" rows={2} placeholder="О чём ваш сервер?" maxLength={500} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Отмена</button>
            <button onClick={handleCreate} disabled={loading || !name.trim()} className="btn-primary flex-1">
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
