import { useState } from 'react'
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  Cake,
  ChevronDown,
  ChevronsLeft,
  CircleUserRound,
  Coffee,
  Compass,
  ContactRound,
  History,
  LayoutTemplate,
  LoaderCircle,
  LogOut,
  Megaphone,
  MessageSquarePlus,
  PanelLeft,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Brand } from '@/components/Brand'
import { UserAvatar } from '@/components/UserAvatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAsk } from '@/contexts/AskContext'
import { useAuth } from '@/contexts/AuthContext'
import { useTour } from '@/contexts/TourContext'
import { deleteConversation } from '@/services/ask'
import type { AskConversation } from '@/types/crm'
import { cn } from '@/lib/utils'

const primary = [{ to: '/ask', label: 'Agent', icon: Sparkles, badge: 'IA' }]

const sales = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/jornada', label: 'Jornada Disney (Quadro)', icon: Sparkles, badge: 'Visão' },
  { to: '/pedidos', label: 'Pedidos (Funil / Cards)', icon: ShoppingBag, badge: 'Novo' },
  { to: '/lembretes', label: 'Lembretes & Recorrência', icon: Bell, badge: 'Hoje' },
  { to: '/contatos', label: 'Clientes & Fidelidade', icon: Coffee },
  { to: '/pipeline', label: 'Pipeline', icon: PanelLeft },
  { to: '/recuperacao', label: 'Recuperação', icon: RefreshCw },
  { to: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { to: '/negocios', label: 'Negócios', icon: BriefcaseBusiness },
  { to: '/empresas', label: 'Empresas / B2B', icon: Building2 },
  { to: '/formularios', label: 'Formulário de Captação', icon: LayoutTemplate },
]

export function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (value: boolean) => void
}) {
  const { user, logout } = useAuth()
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    setOpen,
    newConversation,
    refreshConversations,
  } = useAsk()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { startTourForCurrentPage, tourDisabled } = useTour()
  const [salesOpen, setSalesOpen] = useState(true)
  const [askOpen, setAskOpen] = useState(true)
  const [userOpen, setUserOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<AskConversation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const compact = collapsed && !mobileOpen
  const closeMobile = () => setMobileOpen(false)

  async function handleConfirmDelete() {
    if (!conversationToDelete || deleting) return
    setDeleting(true)
    const target = conversationToDelete
    try {
      await deleteConversation(target.id)
      if (activeConversationId === target.id) {
        newConversation(false)
      }
      await refreshConversations()
      toast({
        title: 'Conversa excluída',
        description: 'A conversa e suas mensagens foram removidas.',
      })
      setConversationToDelete(null)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir conversa',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      })
    } finally {
      setDeleting(false)
    }
  }
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/65 crm-mobile-backdrop"
          onClick={closeMobile}
        />
      )}
      <aside
        className={cn(
          'crm-sidebar inset-y-0 left-0 z-50 flex flex-col border-r border-[#e5e7eb] bg-[#f8fafc] transition-[width,transform] duration-200 ease-in-out md:static md:translate-x-0 fixed',
          compact ? 'w-14 shrink-0' : 'w-60 shrink-0',
          mobileOpen ? 'crm-sidebar-open' : 'max-md:-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-12 shrink-0 items-center border-b border-[#e5e7eb]',
            compact ? 'justify-center px-2' : 'justify-between px-3',
          )}
        >
          <Brand compact={compact} />
          {!compact && (
            <button
              onClick={() => setCollapsed(true)}
              title="Recolher sidebar"
              className="rounded p-1.5 text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1c1c1e]"
            >
              <ChevronsLeft className="size-3.5" />
            </button>
          )}
          <button className="crm-mobile-close rounded p-1.5 text-[#64748b]" onClick={closeMobile}>
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {compact && (
            <button
              onClick={() => setCollapsed(false)}
              title="Expandir sidebar"
              className="mb-3 grid h-8 w-full place-items-center rounded text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1c1c1e]"
            >
              <PanelLeft className="size-4" />
            </button>
          )}
          <div className="mb-3 space-y-1">
            {primary.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                title={compact ? label : undefined}
                onClick={closeMobile}
                className={({ isActive }) =>
                  cn(
                    'group flex h-8 items-center rounded-md text-[12px] font-medium transition',
                    compact ? 'justify-center' : 'justify-between px-2',
                    isActive
                      ? 'bg-[#e2e8f0] text-[#1c1c1e] font-semibold'
                      : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e]',
                  )
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="size-3.5 shrink-0 text-amber-600" />
                  {!compact && <span>{label}</span>}
                </div>
                {!compact && badge && (
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.2 font-mono text-[9px] font-bold text-amber-700">
                    {badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <SidebarSection
            title="Cafés & Clientes"
            compact={compact}
            open={salesOpen}
            setOpen={setSalesOpen}
          >
            {sales.map(
              ({
                to,
                label,
                icon: Icon,
                badge,
              }: {
                to: string
                label: string
                icon: any
                badge?: string
              }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={compact ? label : undefined}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    cn(
                      'flex h-8 items-center rounded-md text-[12px] transition',
                      compact ? 'justify-center' : 'justify-between px-2',
                      isActive
                        ? 'bg-[#e2e8f0] text-[#1c1c1e] font-semibold'
                        : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e]',
                    )
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="size-3.5 shrink-0 text-[#64748b]" />
                    {!compact && <span className="truncate">{label}</span>}
                  </div>
                  {!compact && badge && (
                    <span className="rounded border border-rose-300 bg-rose-50 px-1 py-0.2 font-mono text-[9px] font-bold text-rose-700">
                      {badge}
                    </span>
                  )}
                </NavLink>
              ),
            )}
          </SidebarSection>
          <SidebarSection title="Conversas" compact={compact} open={askOpen} setOpen={setAskOpen}>
            <button
              title={compact ? 'Nova conversa' : undefined}
              onClick={() => {
                newConversation(false)
                navigate('/ask')
                closeMobile()
              }}
              className={cn(
                'flex h-8 w-full items-center rounded-md text-[12px] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1c1c1e]',
                compact ? 'justify-center' : 'gap-2 px-2',
              )}
            >
              <MessageSquarePlus className="size-3.5" />
              {!compact && 'Nova conversa'}
            </button>
            {!compact &&
              conversations.slice(0, 6).map((conversation) => (
                <div
                  key={conversation.id}
                  className="group relative flex h-7 w-full items-center rounded-md px-2 pl-7 hover:bg-[#f1f5f9]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConversationId(conversation.id)
                      navigate('/ask')
                      closeMobile()
                    }}
                    className={cn(
                      'min-w-0 flex-1 truncate text-left text-[10px] transition',
                      activeConversationId === conversation.id
                        ? 'font-medium text-[#1c1c1e]'
                        : 'text-[#64748b] group-hover:text-[#1c1c1e]',
                    )}
                    title={conversation.title}
                  >
                    <span className="truncate">{conversation.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConversationToDelete(conversation)
                    }}
                    title="Excluir conversa"
                    className="ml-1 shrink-0 rounded p-1 text-[#94a3b8] opacity-0 transition hover:bg-[#e2e8f0] hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
          </SidebarSection>
        </div>
        <div className="relative shrink-0 border-t border-[#e5e7eb] p-2 bg-[#f8fafc]">
          {userOpen && !compact && (
            <div className="absolute bottom-14 left-2 right-2 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white py-1 shadow-[0_10px_30px_rgba(0,0,0,.12)]">
              <button
                onClick={() => {
                  navigate('/configuracoes')
                  setUserOpen(false)
                }}
                className="flex h-8 w-full items-center gap-2 px-3 text-[11px] text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e]"
              >
                <Settings className="size-3.5" /> Configurações
              </button>
              <button
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="flex h-8 w-full items-center gap-2 px-3 text-[11px] text-red-600 hover:bg-red-50"
              >
                <LogOut className="size-3.5" /> Sair
              </button>
            </div>
          )}
          <button
            onClick={() => (compact ? navigate('/configuracoes') : setUserOpen(!userOpen))}
            title={compact ? 'Configurações' : undefined}
            className={cn(
              'flex h-9 w-full items-center rounded-md text-[#475569] hover:bg-[#e2e8f0] hover:text-[#1c1c1e]',
              compact ? 'justify-center' : 'gap-2 px-2',
            )}
          >
            <UserAvatar user={user} />
            {!compact && (
              <>
                <span className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold text-[#1c1c1e]">
                  {user?.name || 'Usuário'}
                </span>
                <CircleUserRound className="size-3.5 text-[#94a3b8]" />
              </>
            )}
          </button>

          {/* Botão no final do sidebar para disparar o tour guiado manualmente */}
          <button
            type="button"
            onClick={() => startTourForCurrentPage(true)}
            title={
              tourDisabled
                ? 'Tour guiado (automático desativado nas Configurações)'
                : compact
                  ? 'Tour guiado'
                  : 'Iniciar tour guiado desta página'
            }
            className={cn(
              'mt-1 flex h-8 w-full items-center rounded-md text-[11px] font-medium text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1c1c1e] transition',
              compact ? 'justify-center' : 'gap-2 px-2',
            )}
          >
            <Compass
              className={cn(
                'size-3.5 shrink-0',
                tourDisabled ? 'text-[#94a3b8]' : 'text-amber-600',
              )}
            />
            {!compact && <span className="flex-1 text-left truncate">Tour guiado</span>}
            {!compact && tourDisabled && (
              <span
                className="font-mono text-[9px] text-[#94a3b8] px-1 rounded bg-[#e2e8f0]"
                title="Auto-disparo desativado"
              >
                manual
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Diálogo de confirmação para Excluir conversa na sidebar */}
      <AlertDialog
        open={Boolean(conversationToDelete)}
        onOpenChange={(isOpen) => {
          if (!isOpen && !deleting) {
            setConversationToDelete(null)
          }
        }}
      >
        <AlertDialogContent className="bg-white border-[#e2e8f0] max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-[#1c1c1e]">
              Excluir conversa?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#64748b]">
              Esta conversa e todas as mensagens associadas serão excluídas permanentemente do
              histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              disabled={deleting}
              className="text-[12px] h-8 border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              className="text-[12px] h-8 bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {deleting ? <LoaderCircle className="size-3.5 animate-spin mr-1.5" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SidebarSection({
  title,
  compact,
  open,
  setOpen,
  children,
}: {
  title: string
  compact: boolean
  open: boolean
  setOpen: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      {!compact && (
        <button
          onClick={() => setOpen(!open)}
          className="mb-1 flex h-6 w-full items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#94a3b8]"
        >
          <span>{title}</span>
          <ChevronDown
            className={cn('size-3 transition-transform duration-200', !open && '-rotate-90')}
          />
        </button>
      )}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200',
          compact || open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-40',
        )}
      >
        <div className="min-h-0 space-y-0.5 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
