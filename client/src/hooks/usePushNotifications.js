import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

export function usePushNotifications() {
  const { user } = useAuthStore()
  const permissionRef = useRef(null)

  useEffect(() => {
    if (!user) return
    registerServiceWorker()
  }, [user])

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return

    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      console.log('✅ SW registered')

      // Request permission
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission()
        permissionRef.current = perm
      } else {
        permissionRef.current = Notification.permission
      }
    } catch (err) {
      console.warn('SW registration failed:', err)
    }
  }

  function sendLocalNotification(title, body, options = {}) {
    if (Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return // Don't notify if app is focused

    try {
      const n = new Notification(title, {
        body,
        icon: '/wave.svg',
        badge: '/wave.svg',
        silent: false,
        ...options
      })
      n.onclick = () => { window.focus(); n.close() }
      setTimeout(() => n.close(), 5000)
    } catch {}
  }

  return { sendLocalNotification }
}

// Hook to show notifications for incoming messages
export function useMessageNotifications() {
  const { user } = useAuthStore()
  const { sendLocalNotification } = usePushNotifications()

  useEffect(() => {
    const handleNewMessage = (e) => {
      const msg = e.detail
      if (!msg || !user) return
      if (msg.author_id === user.id) return // don't notify own messages
      if (document.visibilityState === 'visible') return

      sendLocalNotification(
        msg.display_name || 'WaveChat',
        msg.content || '📎 Вложение',
        { tag: `msg-${msg.id}` }
      )
    }

    window.addEventListener('wavechat:new-message', handleNewMessage)
    return () => window.removeEventListener('wavechat:new-message', handleNewMessage)
  }, [user])
}
