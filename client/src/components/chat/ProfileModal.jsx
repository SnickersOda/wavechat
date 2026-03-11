import { useState, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../utils/helpers'
import api from '../../utils/api'

export default function ProfileModal({ onClose }) {
  const { user, updateProfile } = useAuthStore()
  const [form, setForm] = useState({ displayName: user?.display_name || '', bio: user?.bio || '', customStatus: user?.custom_status || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)
  const [tab, setTab] = useState('profile')
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const handleSave = async () => {
    setSaving(true); setError('')
    try { await updateProfile(form); setSuccess(true); setTimeout(() => setSuccess(false), 2500) }
    catch (e) { setError(e.response?.data?.error || 'Ошибка') }
    finally { setSaving(false) }
  }

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingAvatar(true)
    try {
      const fd = new FormData(); fd.append('avatar', file)
      const { data } = await api.post('/upload/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      useAuthStore.getState().updateUser({ avatar: data.avatar })
    } catch { setError('Ошибка загрузки') } finally { setUploadingAvatar(false) }
  }

  const handlePwChange = async () => {
    if (pw.newPassword !== pw.confirmPassword) { setError('Пароли не совпадают'); return }
    if (pw.newPassword.length < 6) { setError('Минимум 6 символов'); return }
    setSaving(true); setError('')
    try { await api.put('/auth/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }); setSuccess(true); setPw({ currentPassword: '', newPassword: '', confirmPassword: '' }); setTimeout(() => setSuccess(false), 2500) }
    catch (e) { setError(e.response?.data?.error || 'Ошибка') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-bold text-white text-lg">Настройки профиля</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {[['profile','Профиль'],['security','Безопасность']].map(([id,label]) => (
            <button key={id} onClick={() => { setTab(id); setError(''); setSuccess(false) }}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${tab===id?'text-white':'text-slate-500 hover:text-slate-300'}`}>
              {label}
              {tab===id && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />}
            </button>
          ))}
        </div>

        <div className="p-6">
          {error && <div className="rounded-2xl px-4 py-3 text-sm mb-4" style={{ background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.25)', color:'#fca5a5' }}>⚠️ {error}</div>}
          {success && <div className="rounded-2xl px-4 py-3 text-sm mb-4" style={{ background:'rgba(74,222,128,0.10)', border:'1px solid rgba(74,222,128,0.25)', color:'#86efac' }}>✅ Сохранено!</div>}

          {tab === 'profile' && (
            <div className="space-y-5">
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0 cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                  {user?.avatar
                    ? <img src={user.avatar} className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/10 hover:ring-indigo-500/50 transition-all" alt="" />
                    : <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold hover:scale-105 transition-transform" style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>{getInitials(user?.display_name)}</div>
                  }
                  {uploadingAvatar && <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ background:'rgba(0,0,0,0.6)' }}><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/></div>}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'2px solid #06070f' }}>✏️</div>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base truncate">{user?.display_name}</p>
                  <p className="text-sm text-slate-500 mt-0.5">@{user?.username}</p>
                  <p className="text-xs text-slate-600 mt-1">Нажмите на аватар чтобы изменить</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Отображаемое имя</label>
                <input value={form.displayName} onChange={e => setForm(f=>({...f,displayName:e.target.value}))} className="input-field" placeholder="Ваше имя" maxLength={64} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Кастомный статус</label>
                <input value={form.customStatus} onChange={e => setForm(f=>({...f,customStatus:e.target.value}))} className="input-field" placeholder="Чем занимаетесь? 🎮" maxLength={128} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">О себе</label>
                <textarea value={form.bio} onChange={e => setForm(f=>({...f,bio:e.target.value}))} className="input-field resize-none" rows={3} placeholder="Расскажите о себе..." maxLength={500} />
                <p className="text-xs text-slate-700 text-right mt-1">{form.bio.length}/500</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="btn-secondary flex-1">Отмена</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Сохранение...' : 'Сохранить'}</button>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Текущий пароль</label>
                <input type="password" value={pw.currentPassword} onChange={e=>setPw(f=>({...f,currentPassword:e.target.value}))} className="input-field" placeholder="••••••••" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Новый пароль</label>
                <input type="password" value={pw.newPassword} onChange={e=>setPw(f=>({...f,newPassword:e.target.value}))} className="input-field" placeholder="Минимум 6 символов" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Подтвердить пароль</label>
                <input type="password" value={pw.confirmPassword} onChange={e=>setPw(f=>({...f,confirmPassword:e.target.value}))} className="input-field" placeholder="Повторите новый пароль" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="btn-secondary flex-1">Отмена</button>
                <button onClick={handlePwChange} disabled={saving||!pw.currentPassword||!pw.newPassword} className="btn-primary flex-1">{saving?'Сохранение...':'Сменить пароль'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
