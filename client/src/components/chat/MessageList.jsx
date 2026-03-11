import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { shouldGroupMessages, formatMessageTime, formatDateSeparator } from '../../utils/helpers'
import MessageItem from './MessageItem'

export default function MessageList({ channelId, conversationId, searchResults }) {
  const { messages, hasMore, loadMessages, loadingMessages, typing } = useChatStore()
  const { user } = useAuthStore()
  // Stable userId - use localStorage as fallback when user object loads lazily
  const currentUserId = user?.id || localStorage.getItem('wavechat_uid')
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const key = channelId || conversationId
  const msgs = searchResults || messages[key] || []
  const typingList = typing[key] || []

  // Load initial messages
  useEffect(() => {
    if (!key) return
    useChatStore.getState().clearMessages(key)
    loadMessages(channelId, conversationId)
  }, [key])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [msgs.length, typingList.length])

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Track if user is near bottom
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
    setAutoScroll(nearBottom)

    // Load more on top
    if (container.scrollTop < 100 && hasMore[key] && !loadingMessages && msgs.length > 0) {
      const oldest = msgs[0]
      loadMessages(channelId, conversationId, oldest.created_at)
    }
  }, [key, hasMore, loadingMessages, msgs])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  if (!key) return null

  // Group messages
  const groupedMsgs = msgs.reduce((acc, msg, i) => {
    const prev = msgs[i - 1]
    const grouped = shouldGroupMessages(prev, msg)
    const showDate = !prev || formatDateSeparator(prev.created_at) !== formatDateSeparator(msg.created_at)
    acc.push({ msg, grouped: grouped && !showDate, showDate })
    return acc
  }, [])

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-2 py-2 flex flex-col messages-container" style={{ scrollbarGutter: "stable" }}>
      {loadingMessages && (
        <div className="flex justify-center py-4">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-wave-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {!loadingMessages && !hasMore[key] && msgs.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-500">
            <div className="text-4xl mb-2">👋</div>
            <p className="font-medium text-slate-400">Начало истории</p>
            <p className="text-sm">Напишите первое сообщение!</p>
          </div>
        </div>
      )}

      {!loadingMessages && !hasMore[key] && msgs.length > 0 && (
        <div className="text-center py-4 text-slate-500 text-xs">
          Начало истории сообщений
        </div>
      )}

      <div className="mt-auto space-y-0">
        {groupedMsgs.map(({ msg, grouped, showDate }) => (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-dark-border" />
                <span className="text-xs text-slate-500 font-medium bg-dark-chat px-3">
                  {formatDateSeparator(msg.created_at)}
                </span>
                <div className="flex-1 h-px bg-dark-border" />
              </div>
            )}
            <MessageItem
              message={msg}
              grouped={grouped}
              isOwn={msg.author_id === currentUserId}
              channelId={channelId}
              conversationId={conversationId}
            />
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      {typingList.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-slate-400 animate-fade-in">
          <div className="flex gap-0.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <span>
            {typingList.length === 1
              ? `${typingList[0].displayName} печатает...`
              : typingList.length === 2
              ? `${typingList[0].displayName} и ${typingList[1].displayName} печатают...`
              : `${typingList.length} пользователей печатают...`}
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
