import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#ffffff] text-amber-500">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    )
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
