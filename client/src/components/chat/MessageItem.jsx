import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import EmojiPicker from 'emoji-picker-react'
import { useSocketStore } from '../../store/socketStore'
import { useAuthStore } from '../../store/authStore'
import { formatMessageTime, getInitials, formatFileSize } from '../../utils/helpers'
import MediaPreview from '../ui/MediaPreview'

export default function MessageItem({ message: msg, grouped, isOwn }) {
  const { emit } = useSocketStore()
  const { user } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(msg.content)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [previewMedia, setPreviewMedia] = useState(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e) => e.key === 'Escape' && setContextMenu(null)
    setTimeout(() => {
      window.addEventListener('click', close)
      window.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

  const handleContextMenu = (e) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 240)
    const y = Math.min(e.clientY, window.innerHeight - 360)
    setContextMenu({ x, y })
  }

  // Long press for mobile
  let longPressTimer = null
  const handleTouchStart = (e) => {
    longPressTimer = setTimeout(() => {
      const touch = e.touches[0]
      const x = Math.min(touch.clientX, window.innerWidth - 240)
      const y = Math.min(touch.clientY, window.innerHeight - 360)
      setContextMenu({ x, y })
    }, 500)
  }
  const handleTouchEnd = () => clearTimeout(longPressTimer)

  const handleEdit = () => {
    if (!editContent.trim()) return
    emit('message:edit', { messageId: msg.id, content: editContent })
    setEditing(false)
  }

  const handleDelete = () => {
    if (confirm('Удалить это сообщение?')) emit('message:delete', { messageId: msg.id })
    setContextMenu(null)
  }

  const handleReact = (emoji) => {
    emit('message:react', { messageId: msg.id, emoji })
    setShowEmojiPicker(false)
    setContextMenu(null)
  }

  const handleReply = () => {
    window.dispatchEvent(new CustomEvent('reply-to-message', { detail: msg }))
    setContextMenu(null)
  }

  const handlePin = async () => {
    try { const { default: api } = await import('../../utils/api'); await api.put(`/messages/${msg.id}/pin`) } catch {}
    setContextMenu(null)
  }

  if (msg.is_deleted && !isOwn) return null
  const attachments = Array.isArray(msg.attachments) ? msg.attachments : []

  // ── OWN MESSAGE (right side, bubble style) ──
  if (isOwn) {
    return (
      <>
        <div
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`flex justify-end px-3 ${!grouped ? 'mt-3' : 'mt-0.5'} animate-msg-in-right group`}
        >
          <div className="flex flex-col items-end max-w-[70%] min-w-0">
            {!grouped && (
              <div className="flex items-center gap-2 mb-1 pr-1">
                <span className="text-[11px] text-slate-500 tabular-nums">{formatMessageTime(msg.created_at)}</span>
                <span className="text-xs font-semibold text-indigo-400">Вы</span>
              </div>
            )}

            {/* Reply */}
            {msg.reply_to && msg.reply_content && (
              <div className="mb-1 text-xs rounded-xl px-3 py-1.5 max-w-full"
                style={{ borderRight: '2px solid rgba(99,102,241,0.7)', background: 'rgba(99,102,241,0.08)', borderRadius: '12px 4px 4px 12px' }}>
                <span className="font-semibold text-indigo-400">{msg.reply_display_name} </span>
                <span className="text-slate-500 truncate">{msg.reply_content}</span>
              </div>
            )}

            {/* Bubble */}
            {editing ? (
              <div className="w-full">
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit() } if (e.key === 'Escape') setEditing(false) }}
                  className="w-full rounded-2xl px-3 py-2 text-sm text-slate-200 outline-none resize-none"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)' }}
                  rows={2} autoFocus />
                <div className="flex justify-end gap-2 mt-1.5">
                  <button onClick={() => setEditing(false)} className="btn-secondary py-1 text-xs">Отмена</button>
                  <button onClick={handleEdit} className="btn-primary py-1 text-xs">Сохранить</button>
                </div>
              </div>
            ) : (
              <div className={`px-4 py-2.5 rounded-3xl text-sm leading-relaxed break-words relative ${msg.is_deleted ? 'opacity-50 italic' : ''}`}
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.7) 0%, rgba(79,70,229,0.8) 100%)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(129,140,248,0.3)',
                  boxShadow: '0 2px 16px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.12)',
                  borderRadius: !grouped ? '22px 22px 6px 22px' : '22px 6px 6px 22px',
                }}>
                <div className="message-content text-white">
                  <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
                </div>
                {msg.is_edited && <span className="text-[10px] opacity-60 ml-2">ред.</span>}
                {msg.is_pinned && <span className="text-xs ml-1">📌</span>}
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 justify-end">
                {attachments.map((att, i) => <AttachmentPreview key={i} attachment={att} onClick={() => setPreviewMedia(att)} />)}
              </div>
            )}

            {/* Reactions */}
            {msg.reactions?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                {msg.reactions.map(r => (
                  <ReactionBubble key={r.emoji} reaction={r} userId={user?.id} onReact={handleReact} />
                ))}
              </div>
            )}
          </div>
        </div>

        {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} isOwn msg={msg}
          onReact={handleReact} onReply={handleReply} onEdit={() => { setEditing(true); setEditContent(msg.content); setContextMenu(null) }}
          onPin={handlePin} onDelete={handleDelete} onCopy={() => { navigator.clipboard.writeText(msg.content); setContextMenu(null) }}
          showEmojiPicker={showEmojiPicker} setShowEmojiPicker={setShowEmojiPicker} />}
        {previewMedia && <MediaPreview media={previewMedia} onClose={() => setPreviewMedia(null)} />}
      </>
    )
  }

  // ── OTHER'S MESSAGE (left side) ──
  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`flex gap-2.5 px-3 ${!grouped ? 'mt-3' : 'mt-0.5'} animate-msg-in group`}
      >
        {/* Avatar */}
        <div className="w-8 flex-shrink-0 flex flex-col justify-end pb-1">
          {!grouped ? (
            msg.avatar
              ? <img src={msg.avatar} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10" alt="" />
              : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  {getInitials(msg.display_name)}
                </div>
          ) : (
            <div className="w-8" />
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col items-start max-w-[70%] min-w-0">
          {!grouped && (
            <div className="flex items-center gap-2 mb-1 pl-1">
              <span className="text-xs font-semibold text-white">{msg.display_name}</span>
              <span className="text-[11px] text-slate-500 tabular-nums">{formatMessageTime(msg.created_at)}</span>
              {msg.is_pinned && <span className="text-xs">📌</span>}
            </div>
          )}

          {/* Reply */}
          {msg.reply_to && msg.reply_content && (
            <div className="mb-1 text-xs rounded-xl px-3 py-1.5 max-w-full"
              style={{ borderLeft: '2px solid rgba(99,102,241,0.7)', background: 'rgba(99,102,241,0.08)', borderRadius: '4px 12px 12px 4px' }}>
              <span className="font-semibold text-indigo-400">{msg.reply_display_name} </span>
              <span className="text-slate-500 truncate">{msg.reply_content}</span>
            </div>
          )}

          {/* Bubble */}
          <div className={`px-4 py-2.5 rounded-3xl text-sm leading-relaxed break-words ${msg.is_deleted ? 'opacity-50 italic' : ''}`}
            style={{
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.07)',
              borderRadius: !grouped ? '6px 22px 22px 22px' : '22px 22px 22px 6px',
            }}>
            <div className="message-content text-slate-100">
              <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
            </div>
            {msg.is_edited && <span className="text-[10px] text-slate-500 ml-2">ред.</span>}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {attachments.map((att, i) => <AttachmentPreview key={i} attachment={att} onClick={() => setPreviewMedia(att)} />)}
            </div>
          )}

          {/* Reactions */}
          {msg.reactions?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {msg.reactions.map(r => (
                <ReactionBubble key={r.emoji} reaction={r} userId={user?.id} onReact={handleReact} />
              ))}
            </div>
          )}
        </div>
      </div>

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} isOwn={false} msg={msg}
        onReact={handleReact} onReply={handleReply} onEdit={null}
        onPin={handlePin} onDelete={handleDelete} onCopy={() => { navigator.clipboard.writeText(msg.content); setContextMenu(null) }}
        showEmojiPicker={showEmojiPicker} setShowEmojiPicker={setShowEmojiPicker} />}
      {previewMedia && <MediaPreview media={previewMedia} onClose={() => setPreviewMedia(null)} />}
    </>
  )
}

// ── Reaction bubble ──
function ReactionBubble({ reaction: r, userId, onReact }) {
  const mine = r.userIds?.includes(userId)
  return (
    <button onClick={() => onReact(r.emoji)}
      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm transition-all hover:scale-110 active:scale-95"
      style={{
        background: mine ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${mine ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
        backdropFilter: 'blur(12px)',
      }}>
      <span>{r.emoji}</span>
      <span className={`text-xs font-semibold ${mine ? 'text-indigo-300' : 'text-slate-400'}`}>{r.count}</span>
    </button>
  )
}

// ── Context menu ──
function ContextMenu({ x, y, isOwn, msg, onReact, onReply, onEdit, onPin, onDelete, onCopy, showEmojiPicker, setShowEmojiPicker }) {
  return (
    <div className="fixed z-[100] context-menu" style={{ left: x, top: y }} onClick={e => e.stopPropagation()}>
      {/* Quick emoji row */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {['👍','❤️','😂','🔥','😮','🎉','💯','😢'].map(emoji => (
          <button key={emoji} onClick={() => onReact(emoji)}
            className="text-xl leading-none hover:scale-130 active:scale-95 transition-transform p-0.5">
            {emoji}
          </button>
        ))}
        <div className="relative ml-1">
          <button onClick={e => { e.stopPropagation(); setShowEmojiPicker(p => !p) }}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold">
            +
          </button>
          {showEmojiPicker && (
            <div className="absolute right-0 top-9 z-[110]">
              <div className="fixed inset-0" onClick={() => setShowEmojiPicker(false)} />
              <div className="relative z-10">
                <EmojiPicker onEmojiClick={e => onReact(e.emoji)} theme="dark" height={380} searchPlaceholder="Поиск..." />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="py-1 px-1.5 space-y-0.5">
        <CMenuItem icon="↩️" onClick={onReply}>Ответить</CMenuItem>
        {isOwn && onEdit && <CMenuItem icon="✏️" onClick={onEdit}>Редактировать</CMenuItem>}
        <CMenuItem icon="📌" onClick={onPin}>{msg.is_pinned ? 'Открепить' : 'Закрепить'}</CMenuItem>
        <CMenuItem icon="📋" onClick={onCopy}>Копировать текст</CMenuItem>
        {isOwn && (
          <>
            <div className="my-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <CMenuItem icon="🗑️" onClick={onDelete} danger>Удалить</CMenuItem>
          </>
        )}
      </div>
    </div>
  )
}

function CMenuItem({ icon, onClick, children, danger }) {
  return (
    <button onClick={onClick}
      className={`context-menu-item w-full rounded-xl ${danger ? 'danger' : ''}`}>
      <span className="text-base leading-none w-5 text-center">{icon}</span>
      <span>{children}</span>
    </button>
  )
}

function AttachmentPreview({ attachment, onClick }) {
  if (attachment.type === 'image') {
    return <img src={attachment.url} alt={attachment.name} onClick={onClick} className="attachment-image" loading="lazy" />
  }
  if (attachment.type === 'video') {
    return <video src={attachment.url} controls className="max-w-xs max-h-48 rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
  }
  if (attachment.type === 'audio') {
    return (
      <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-2xl">🎵</span>
        <div>
          <p className="text-sm text-white truncate max-w-40">{attachment.name}</p>
          <audio src={attachment.url} controls className="mt-1 h-8" />
        </div>
      </div>
    )
  }
  return (
    <a href={attachment.url} download={attachment.name} target="_blank" rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/10 transition-colors"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="text-2xl">📄</span>
      <div>
        <p className="text-sm text-white font-medium truncate max-w-40">{attachment.name}</p>
        <p className="text-xs text-slate-500">{formatFileSize(attachment.size)}</p>
      </div>
    </a>
  )
}
