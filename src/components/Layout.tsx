import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AskPanel } from '@/components/AskPanel'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { TourOverlay } from '@/components/TourOverlay'
import { TourProvider } from '@/contexts/TourContext'
import { AskProvider, useAsk } from '@/contexts/AskContext'
import { CrmProvider } from '@/contexts/CrmContext'
import { cn } from '@/lib/utils'

export default function Layout() {
  return (
    <CrmProvider>
      <AskProvider>
        <AppFrame />
      </AskProvider>
    </CrmProvider>
  )
}
function AppFrame() {
  const { setOpen } = useAsk()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1025)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const resize = () => {
      if (window.innerWidth < 1025) setCollapsed(true)
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    let waitingForRoute = false
    let timer = 0
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable=true]')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'g' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        waitingForRoute = true
        window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          waitingForRoute = false
        }, 900)
        return
      }
      if (waitingForRoute) {
        const routes: Record<string, string> = {
          a: '/ask',
          d: '/dashboard',
          p: '/pipeline',
          r: '/recuperacao',
          n: '/negocios',
          c: '/contatos',
          e: '/empresas',
        }
        if (routes[key]) {
          event.preventDefault()
          navigate(routes[key])
        }
        waitingForRoute = false
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.clearTimeout(timer)
    }
  }, [navigate, setOpen])
  return (
    <TourProvider>
      <div className="crm-layout flex h-screen w-full overflow-hidden bg-white text-[#1c1c1e]">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
        <div className="crm-main-container flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar onMenu={() => setMobileOpen(true)} />
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </main>
        </div>
        <AskPanel />
        <TourOverlay />
      </div>
    </TourProvider>
  )
}
