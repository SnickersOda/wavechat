import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'

export default function ServerSettingsModal({ server, onClose }) {
  const [activeTab, setActiveTab] = useState('general')
  const [form, setForm] = useState({ name: server.name, description: server.description || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [inviteCode, setInviteCode] = useState(server.invite_code || '')
  const [copied, setCopied] = useState(false)
  const { updateServer, removeServer } = useChatStore()
  const { user } = useAuthStore()

  const isOwner = server.owner_id === user?.id

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const { data } = await api.put(`/servers/${server.id}`, form)
      updateServer(server.id, data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const handleGetInvite = async () => {
    try {
      const { data } = await api.post(`/servers/${server.id}/invite`)
      setInviteCode(data.inviteCode)
    } catch {}
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeave = async () => {
    if (!confirm(`Покинуть сервер "${server.name}"?`)) return
    try {
      await api.post(`/servers/${server.id}/leave`)
      removeServer(server.id)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить сервер "${server.name}" навсегда? Это действие необратимо!`)) return
    try {
      await api.delete(`/servers/${server.id}`)
      removeServer(server.id)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления')
    }
  }

  const TABS = [
    { id: 'general', label: 'Общее' },
    { id: 'invite', label: 'Приглашения' },
    { id: 'members', label: 'Участники' },
    { id: 'danger', label: 'Опасная зона' }
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-xl w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="font-bold text-white text-lg">⚙️ Настройки сервера</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-dark-border overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                ? `text-wave-400 border-b-2 border-wave-400 ${tab.id === 'danger' ? 'text-red-400 border-red-400' : ''}`
                : `text-slate-400 hover:text-slate-200 ${tab.id === 'danger' ? 'hover:text-red-400' : ''}`}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm mb-4">{error}</div>}
          {success && <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-green-400 text-sm mb-4">✅ Сохранено!</div>}

          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Название сервера</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field" placeholder="Название сервера" maxLength={100} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Описание</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input-field resize-none" rows={3} placeholder="Описание сервера" maxLength={500} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="btn-secondary">Отмена</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'invite' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Поделитесь кодом, чтобы пригласить людей на сервер</p>
              <div className="flex gap-2">
                <input value={inviteCode} readOnly
                  className="input-field font-mono tracking-widest flex-1 text-center text-lg uppercase" />
                <button onClick={handleCopyInvite} className={`btn-primary px-4 ${copied ? 'bg-green-600' : ''}`}>
                  {copied ? '✓' : 'Копировать'}
                </button>
              </div>
              <button onClick={handleGetInvite} className="btn-secondary text-sm">
                🔄 Обновить код
              </button>
            </div>
          )}

          {activeTab === 'members' && (
            <MembersTab serverId={server.id} currentUserId={user?.id} isOwner={isOwner} />
          )}

          {activeTab === 'danger' && (
            <div className="space-y-4">
              {!isOwner && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <h3 className="font-semibold text-yellow-400 mb-1">Покинуть сервер</h3>
                  <p className="text-sm text-slate-400 mb-3">Вы покинете этот сервер и потеряете доступ ко всем каналам.</p>
                  <button onClick={handleLeave} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    Покинуть сервер
                  </button>
                </div>
              )}
              {isOwner && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <h3 className="font-semibold text-red-400 mb-1">Удалить сервер</h3>
                  <p className="text-sm text-slate-400 mb-3">Безвозвратное удаление сервера вместе со всеми каналами и сообщениями.</p>
                  <button onClick={handleDelete} className="btn-danger text-sm">
                    🗑️ Удалить сервер навсегда
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MembersTab({ serverId, currentUserId, isOwner }) {
  const [members, setMembers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const { data } = await api.get(`/servers/${serverId}`)
      setMembers(data.members || [])
      setLoaded(true)
    } catch { setError('Ошибка загрузки') }
  }

  if (!loaded) {
    return (
      <div className="text-center py-6">
        <button onClick={load} className="btn-secondary">Загрузить участников</button>
      </div>
    )
  }

  const handleKick = async (userId) => {
    if (!confirm('Исключить участника?')) return
    try {
      await api.delete(`/servers/${serverId}/members/${userId}`)
      setMembers(m => m.filter(mem => mem.id !== userId))
    } catch (err) { setError(err.response?.data?.error || 'Ошибка') }
  }

  const handleBan = async (userId) => {
    const reason = prompt('Причина бана (необязательно):')
    if (reason === null) return
    try {
      await api.post(`/servers/${serverId}/members/${userId}/ban`, { reason })
      setMembers(m => m.filter(mem => mem.id !== userId))
    } catch (err) { setError(err.response?.data?.error || 'Ошибка') }
  }

  const handleRoleChange = async (userId, role) => {
    try {
      await api.put(`/servers/${serverId}/members/${userId}/role`, { role })
      setMembers(m => m.map(mem => mem.id === userId ? { ...mem, role } : mem))
    } catch (err) { setError(err.response?.data?.error || 'Ошибка') }
  }

  return (
    <div className="space-y-2">
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>}
      <p className="text-xs text-slate-500 mb-3">Всего участников: {members.length}</p>
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-hover">
            <div className="w-8 h-8 rounded-full bg-wave-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {m.display_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{m.display_name}</p>
              <p className="text-xs text-slate-500">@{m.username}</p>
            </div>
            {m.id !== currentUserId && (
              <div className="flex items-center gap-1">
                {isOwner && (
                  <select value={m.role}
                    onChange={e => handleRoleChange(m.id, e.target.value)}
                    className="text-xs bg-dark-input border border-dark-border rounded px-1.5 py-1 text-slate-300 outline-none">
                    <option value="member">Участник</option>
                    <option value="moderator">Модератор</option>
                    <option value="admin">Администратор</option>
                  </select>
                )}
                <button onClick={() => handleKick(m.id)}
                  className="text-xs text-yellow-500 hover:text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/10 transition-colors">
                  Кик
                </button>
                <button onClick={() => handleBan(m.id)}
                  className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors">
                  Бан
                </button>
              </div>
            )}
            {m.id === currentUserId && (
              <span className="text-xs text-wave-400">Это вы</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
