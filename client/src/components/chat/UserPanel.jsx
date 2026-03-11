import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { getInitials, getStatusColor } from '../../utils/helpers'
import ProfileModal from './ProfileModal'

const STATUS_OPTIONS = [
  { value: 'online', label: '🟢 В сети', color: '#4ade80' },
  { value: 'away', label: '🟡 Отошёл', color: '#facc15' },
  { value: 'dnd', label: '🔴 Не беспокоить', color: '#f87171' },
  { value: 'offline', label: '⚫ Невидимый', color: '#6b7280' },
]

export default function UserPanel() {
  const { user, logout } = useAuthStore()
  const { emit } = useSocketStore()
  const [showProfile, setShowProfile] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  if (!user) return null

  const handleStatusChange = (status) => {
    emit('status:update', { status })
    useAuthStore.getState().updateUser({ status })
    setShowMenu(false)
  }

  const statusColor = getStatusColor(user.status)

  return (
    <div className="p-2 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 p-1.5 rounded-xl transition-all hover:bg-white/5 cursor-pointer">
        {/* Avatar */}
        <button onClick={() => setShowProfile(true)} className="relative flex-shrink-0">
          {user.avatar
            ? <img src={user.avatar} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10" alt="" />
            : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                {getInitials(user.display_name)}
              </div>
          }
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ borderColor: '#0a0c14', backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}80` }} />
        </button>

        {/* Name */}
        <button onClick={() => setShowProfile(true)} className="flex-1 min-w-0 text-left">
          <div className="text-xs font-semibold text-white truncate">{user.display_name}</div>
          <div className="text-[10px] text-slate-500 truncate">{user.custom_status || `@${user.username}`}</div>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={() => setShowMenu(p => !p)} title="Статус">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
          </IconBtn>
          <IconBtn onClick={logout} title="Выйти" danger>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </IconBtn>
        </div>
      </div>

      {/* Status menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute bottom-14 left-2 right-2 rounded-2xl py-1.5 z-50 animate-slide-in"
            style={{ background: 'rgba(13,15,25,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(40px)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <p className="text-xs text-slate-600 px-3 py-1.5 font-semibold uppercase tracking-wide">Мой статус</p>
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                <span>{opt.label}</span>
                {user.status === opt.value && <span className="ml-auto text-indigo-400 text-xs">✓</span>}
              </button>
            ))}
            <div className="my-1 mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <button onClick={() => { setShowProfile(true); setShowMenu(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" strokeLinecap="round"/>
              </svg>
              Профиль
            </button>
          </div>
        </>
      )}

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  )
}

function IconBtn({ onClick, title, children, danger }) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-lg transition-colors ${danger ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-white/10'}`}>
      {children}
    </button>
  )
}
