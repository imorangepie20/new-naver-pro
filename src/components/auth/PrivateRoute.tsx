import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

interface PrivateRouteProps {
  children: React.ReactNode
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { isAuthenticated, isLoading, authChecked, checkAuth } = useAuthStore()

  useEffect(() => {
    if (!authChecked) {
      void checkAuth()
    }
  }, [authChecked, checkAuth])

  if (!authChecked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-hud-text-muted">
        인증 상태 확인 중...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default PrivateRoute
