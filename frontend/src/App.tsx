import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useMe } from './hooks/useMe'
import { DayPage } from './pages/DayPage'
import { ExercisePage } from './pages/ExercisePage'
import { LoginPage } from './pages/LoginPage'

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-graphite-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-graphite-700 border-t-accent-500" />
    </div>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const me = useMe()

  if (pathname.startsWith('/login')) {
    if (me.isSuccess) return <Navigate to="/" replace />
    return <>{children}</>
  }

  if (me.isLoading) return <Splash />
  if (me.isError) return <Splash />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DayPage />} />
        <Route path="/date/:date" element={<DayPage />} />
        <Route path="/exercise/:id" element={<ExercisePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthGate>
  )
}
