import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useSocketStore } from './store/socketStore'
import { usePushNotifications } from './hooks/usePushNotifications'
import AuthPage from './pages/AuthPage'
import MainLayout from './pages/MainLayout'
import LoadingScreen from './components/ui/LoadingScreen'

function ProtectedRoute({ children }) {
  const { user, initialized } = useAuthStore()
  if (!initialized) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, initialized } = useAuthStore()
  if (!initialized) return <LoadingScreen />
  if (user) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  const { initialize, user } = useAuthStore()
  const { connect, disconnect } = useSocketStore()
  usePushNotifications()

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (user) {
      connect()
    } else {
      disconnect()
    }
    return () => { if (!user) disconnect() }
  }, [user])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
        <Route path="/app/*" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
