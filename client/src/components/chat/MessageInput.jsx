import { useState, useRef, useEffect, useCallback } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { useSocketStore } from '../../store/socketStore'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'

export default function MessageInput({ channelId, conversationId }) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const { emit } = useSocketStore()
  const { user } = useAuthStore()
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const key = channelId || conversationId

  // Listen for reply events
  useEffect(() => {
    const handler = (e) => setReplyTo(e.detail)
    window.addEventListener('reply-to-message', handler)
    return () => window.removeEventListener('reply-to-message', handler)
  }, [])

  // Drag and drop
  useEffect(() => {
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
    const handleDragLeave = () => setIsDragging(false)
    const handleDrop = (e) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length) uploadFiles(files)
    }
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  const handleTyping = () => {
    emit('typing:start', { channelId, conversationId })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      emit('typing:stop', { channelId, conversationId })
    }, 3000)
  }

  const uploadFiles = async (files) => {
    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      const { data } = await api.post('/upload/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setAttachments(prev => [...prev, ...data.files])
    } catch (err) {
      alert('Ошибка загрузки файла')
    } finally {
      setUploading(false)
    }
  }

  const handleSend = useCallback(() => {
    const rawValue = textareaRef.current?.value ?? content
    const trimmed = rawValue.trim()

    if (!trimmed && attachments.length === 0) return
    if (!key) return

    emit('message:send', {
      channelId,
      conversationId,
      content: trimmed,
      replyTo: replyTo?.id || null,
      attachments,
      mentions: []
    }, (response) => {
      if (response?.error) console.error(response.error)
    })

    setContent('')
    setAttachments([])
    setReplyTo(null)
    emit('typing:stop', { channelId, conversationId })
    clearTimeout(typingTimeoutRef.current)
    textareaRef.current?.focus()
  }, [content, attachments, replyTo, channelId, conversationId, key])

  const handleKeyDown = (e) => {
    if (e.isComposing || e.nativeEvent?.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e) => {
    setContent(e.target.value)
    handleTyping()
    // Auto-resize textarea
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'
  }

  if (!key) return null

  const placeholder = channelId ? `Написать в #${channelId}` : 'Написать сообщение...'

  return (
    <div className={`px-3 pt-2 transition-all ${isDragging ? 'opacity-50' : ''}`} style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
      {isDragging && (
        <div className="absolute inset-0 border-2 border-dashed border-wave-500 rounded-xl bg-wave-500/10 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-2">📎</div>
            <p className="text-wave-400 font-semibold">Отпустите для загрузки</p>
          </div>
        </div>
      )}

      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 bg-dark-hover rounded-t-lg px-3 py-2 text-xs text-slate-400 border-b border-dark-border">
          <span className="text-wave-400">↩️</span>
          <span>Ответ для <strong className="text-slate-300">{replyTo.display_name}</strong>: </span>
          <span className="truncate flex-1">{replyTo.content}</span>
          <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 bg-dark-hover px-3 py-2 rounded-t-lg border-b border-dark-border">
          {attachments.map((att, i) => (
            <div key={i} className="relative">
              {att.type === 'image' ? (
                <img src={att.url} className="h-16 w-16 rounded object-cover" alt="" />
              ) : (
                <div className="h-16 w-24 rounded bg-dark-300 flex items-center justify-center text-xs text-slate-400 px-1 text-center">
                  📄 {att.name?.slice(0, 15)}
                </div>
              )}
              <button onClick={() => setAttachments(a => a.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className={`flex items-end gap-2 bg-dark-input rounded-xl px-3 py-2 border border-dark-border focus-within:border-wave-500/50 transition-colors ${replyTo || attachments.length > 0 ? 'rounded-t-none' : ''}`}>
        {/* File upload button */}
        <button onClick={() => fileInputRef.current?.click()}
          className="text-slate-400 hover:text-wave-400 transition-colors p-1 flex-shrink-0 mb-0.5" title="Прикрепить файл">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt"
          onChange={e => { if (e.target.files?.length) uploadFiles(Array.from(e.target.files)); e.target.value = '' }} />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Загрузка файлов...' : placeholder}
          disabled={uploading}
          rows={1}
          className="msg-input flex-1 min-h-[24px] max-h-[150px] overflow-y-auto"
          style={{ resize: 'none' }}
        />

        {/* Emoji button */}
        <div className="relative flex-shrink-0 mb-0.5">
          <button onClick={() => setShowEmoji(p => !p)}
            className="text-slate-400 hover:text-yellow-400 transition-colors p-1" title="Эмодзи">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" strokeLinecap="round"/>
            </svg>
          </button>
          {showEmoji && (
            <div className="absolute bottom-10 right-0 z-50">
              <div className="fixed inset-0" onClick={() => setShowEmoji(false)} />
              <div className="relative z-10">
                <EmojiPicker
                  onEmojiClick={(e) => { setContent(c => c + e.emoji); setShowEmoji(false); textareaRef.current?.focus() }}
                  theme="dark"
                  searchPlaceholder="Поиск эмодзи..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Send button */}
        <button onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0) || uploading}
          className="bg-wave-600 hover:bg-wave-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg p-2 transition-colors flex-shrink-0 mb-0.5">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>

      <p className="text-xs text-slate-600 mt-1 px-1">
        Enter — отправить · Shift+Enter — новая строка · Markdown поддерживается
      </p>
    </div>
  )
}
