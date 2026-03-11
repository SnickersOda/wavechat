import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../utils/helpers'
import api from '../../utils/api'

export default function CreateGroupModal({ onClose }) {
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { addConversation, setActiveConversation } = useChatStore()
  const { user } = useAuthStore()

  const handleSearch = async (q) => {
    setSearch(q)
    if (!q.trim() || q.length < 2) { setSearchResults([]); return }
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
      setSearchResults(data.filter(u => u.id !== user?.id && !selected.find(s => s.id === u.id)))
    } catch {}
  }

  const toggleUser = (u) => {
    setSelected(s => s.find(x => x.id === u.id) ? s.filter(x => x.id !== u.id) : [...s, u])
  }

  const handleCreate = async () => {
    if (selected.length < 2) { setError('Добавьте минимум 2 участников'); return }
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/dm/group', {
        name: name.trim() || `${user?.display_name} и ещё ${selected.length}`,
        participantIds: selected.map(u => u.id)
      })
      addConversation(data)
      setActiveConversation(data)
      onClose()
    } catch (e) { setError(e.response?.data?.error || 'Ошибка') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-bold text-white text-lg">👥 Новая группа</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white" style={{ background:'rgba(255,255,255,0.06)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="rounded-2xl px-4 py-3 text-sm" style={{ background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.25)', color:'#fca5a5' }}>⚠️ {error}</div>}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Название группы</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Название (необязательно)" maxLength={64} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Добавить участников</label>
            <input value={search} onChange={e => handleSearch(e.target.value)} className="input-field" placeholder="Найти по имени или @username" />
          </div>

          {/* Selected */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map(u => (
                <div key={u.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm" style={{ background:'rgba(99,102,241,0.18)', border:'1px solid rgba(99,102,241,0.30)' }}>
                  <span className="text-white font-medium">{u.display_name}</span>
                  <button onClick={() => toggleUser(u)} className="text-indigo-300 hover:text-white ml-1 leading-none">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)' }}>
              {searchResults.map(u => (
                <button key={u.id} onClick={() => { toggleUser(u); setSearch(''); setSearchResults([]) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors">
                  {u.avatar
                    ? <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                    : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>{getInitials(u.display_name)}</div>
                  }
                  <div>
                    <p className="text-sm text-white font-medium">{u.display_name}</p>
                    <p className="text-xs text-slate-500">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Отмена</button>
            <button onClick={handleCreate} disabled={loading || selected.length < 2} className="btn-primary flex-1">
              {loading ? 'Создание...' : `Создать (${selected.length + 1})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
