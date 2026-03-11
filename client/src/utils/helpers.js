import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export function formatMessageTime(timestamp) {
  const date = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp))
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return `Вчера в ${format(date, 'HH:mm')}`
  return format(date, 'd MMM в HH:mm', { locale: ru })
}

export function formatDateSeparator(timestamp) {
  const date = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp))
  if (isToday(date)) return 'Сегодня'
  if (isYesterday(date)) return 'Вчера'
  return format(date, 'd MMMM yyyy', { locale: ru })
}

export function formatLastSeen(timestamp) {
  if (!timestamp) return 'давно'
  const date = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp))
  return formatDistanceToNow(date, { addSuffix: true, locale: ru })
}

export function getAvatarUrl(avatar, name = '?') {
  if (avatar) return avatar.startsWith('http') ? avatar : avatar
  return null
}

export function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export function getStatusColor(status) {
  switch (status) {
    case 'online': return '#4ade80'
    case 'away': return '#facc15'
    case 'dnd': return '#f87171'
    default: return '#6b7280'
  }
}

export function shouldGroupMessages(msg1, msg2) {
  if (!msg1 || !msg2) return false
  if (msg1.author_id !== msg2.author_id) return false
  const diff = Math.abs(parseInt(msg2.created_at) - parseInt(msg1.created_at))
  return diff < 5 * 60 * 1000 // 5 minutes
}

export function parseChannelType(type) {
  switch (type) {
    case 'voice': return '🔊'
    case 'announcement': return '📢'
    default: return '#'
  }
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export const EMOJI_QUICK = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥']
