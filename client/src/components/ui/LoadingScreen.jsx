export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-wave-600 mb-4 shadow-lg shadow-wave-600/30 animate-pulse-slow">
          <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-white" stroke="currentColor" strokeWidth="2">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-1">WaveChat</h1>
        <div className="flex justify-center gap-1 mt-3">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-wave-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
