import { useEffect } from 'react'

export default function MediaPreview({ media, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="relative max-w-5xl max-h-[90vh] animate-bounce-in">
        <button onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white text-xl font-light">
          ✕ Закрыть
        </button>
        {media.type === 'image' && (
          <img src={media.url} alt={media.name}
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
        )}
        {media.type === 'video' && (
          <video src={media.url} controls autoPlay
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" />
        )}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-white/70 text-sm truncate">{media.name}</p>
          <a href={media.url} download={media.name} target="_blank" rel="noreferrer"
            className="text-wave-400 hover:text-wave-300 text-sm ml-4 whitespace-nowrap">
            ⬇️ Скачать
          </a>
        </div>
      </div>
    </div>
  )
}
