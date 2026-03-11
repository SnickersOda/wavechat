import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import api from '../../utils/api'

export default function CreateChannelModal({ serverId, onClose }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('text')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { addChannel } = useChatStore()

  const handleCreate = async () => {
    if (!name.trim()) { setError('Введите название'); return }
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/channels', { serverId, name: name.trim(), type })
      addChannel(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания канала')
    } finally { setLoading(false) }
  }

  const TYPES = [
    { value: 'text', label: '# Текстовый', desc: 'Обычный чат с текстом и файлами' },
    { value: 'voice', label: '🔊 Голосовой', desc: 'Голосовой и видеочат' },
    { value: 'announcement', label: '📢 Объявления', desc: 'Только для администраторов' },
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="px-6 py-5 border-b border-dark-border">
          <h2 className="font-bold text-white text-lg">Создать канал</h2>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Тип канала</label>
            <div className="space-y-2">
              {TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${type === t.value ? 'border-wave-500 bg-wave-600/10' : 'border-dark-border hover:border-dark-border/80 hover:bg-dark-hover'}`}>
                  <div className="font-medium text-sm text-white">{t.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{t.desc}</div>
                  {type === t.value && <div className="ml-auto text-wave-400">✓</div>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Название канала</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{type === 'voice' ? '🔊' : '#'}</span>
              <input value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="input-field pl-8" placeholder={type === 'voice' ? 'general-voice' : 'general'} maxLength={100} autoFocus />
            </div>
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
