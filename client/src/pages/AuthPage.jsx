import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, register } = useAuthStore()

  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' })

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email || form.username, form.password)
      } else {
        if (!form.username || !form.email || !form.password || !form.displayName) {
          setError('Заполните все поля')
          setLoading(false)
          return
        }
        await register(form.username, form.email, form.password, form.displayName)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Что-то пошло не так')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-wave-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-wave-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-wave-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-wave-600 mb-4 shadow-lg shadow-wave-600/30">
            <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
              <path d="M2 8c2-2 5-3 10-3M22 8c-2-2-5-3-10-3" opacity="0.5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">WaveChat</h1>
          <p className="text-slate-400 text-sm">Общайся. Играй. Создавай сообщества.</p>
        </div>

        {/* Form Card */}
        <div className="bg-dark-200 rounded-2xl p-8 border border-dark-border shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {mode === 'login' ? 'Добро пожаловать!' : 'Создать аккаунт'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm mb-4 animate-slide-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Отображаемое имя</label>
                  <input name="displayName" value={form.displayName} onChange={handleChange}
                    className="input-field" placeholder="Как тебя зовут?" autoComplete="name" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Имя пользователя</label>
                  <input name="username" value={form.username} onChange={handleChange}
                    className="input-field" placeholder="username (только буквы, цифры, _)" autoComplete="username" />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
                {mode === 'login' ? 'Email или имя пользователя' : 'Email'}
              </label>
              <input name="email" value={form.email} onChange={handleChange}
                className="input-field" placeholder={mode === 'login' ? 'email или username' : 'email@example.com'}
                autoComplete="email" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Пароль</label>
              <input name="password" type="password" value={form.password} onChange={handleChange}
                className="input-field" placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-base font-semibold mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === 'login' ? 'Входим...' : 'Регистрируемся...'}
                </span>
              ) : (mode === 'login' ? 'Войти' : 'Создать аккаунт')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
              <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                className="text-wave-400 hover:text-wave-300 font-medium transition-colors">
                {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
