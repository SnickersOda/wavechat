import { getInitials, getStatusColor, formatLastSeen } from '../../utils/helpers'
import { useChatStore } from '../../store/chatStore'

export default function MembersSidebar({ members }) {
  const { memberStatuses } = useChatStore()

  const online = members.filter(m => {
    const cached = memberStatuses[m.id]
    const status = cached?.status || m.status
    return status !== 'offline'
  })
  const offline = members.filter(m => {
    const cached = memberStatuses[m.id]
    const status = cached?.status || m.status
    return status === 'offline'
  })

  return (
    <div className="w-56 flex-shrink-0 bg-dark-sidebar border-l border-dark-border flex flex-col overflow-hidden">
      <div className="p-3 border-b border-dark-border">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Участники — {members.length}</h3>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {online.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-500 px-2 py-1 uppercase tracking-wide">В сети — {online.length}</p>
            {online.map(m => <MemberItem key={m.id} member={m} memberStatuses={memberStatuses} />)}
          </>
        )}
        {offline.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-600 px-2 py-1 mt-2 uppercase tracking-wide">Не в сети — {offline.length}</p>
            {offline.map(m => <MemberItem key={m.id} member={m} memberStatuses={memberStatuses} offline />)}
          </>
        )}
      </div>
    </div>
  )
}

function MemberItem({ member: m, memberStatuses, offline }) {
  const cached = memberStatuses[m.id] || {}
  const status = cached.status || m.status
  const displayName = m.nickname || m.display_name

  const roleColors = {
    owner: 'text-yellow-400',
    admin: 'text-red-400',
    moderator: 'text-blue-400',
    member: ''
  }

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-hover cursor-pointer transition-colors ${offline ? 'opacity-50' : ''}`}>
      <div className="relative flex-shrink-0">
        {m.avatar ? (
          <img src={m.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-wave-600 flex items-center justify-center text-white text-xs font-bold">
            {getInitials(displayName)}
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-dark-sidebar"
          style={{ backgroundColor: getStatusColor(status) }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${roleColors[m.role] || 'text-slate-300'}`}>
          {displayName}
        </p>
        {cached.customStatus && (
          <p className="text-xs text-slate-600 truncate">{cached.customStatus}</p>
        )}
      </div>
      {m.role !== 'member' && (
        <span className="text-xs">
          {m.role === 'owner' ? '👑' : m.role === 'admin' ? '🔧' : m.role === 'moderator' ? '🛡️' : ''}
        </span>
      )}
    </div>
  )
}
