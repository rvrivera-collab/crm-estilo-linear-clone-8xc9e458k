import { useState, useMemo } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Coffee,
  Copy,
  ExternalLink,
  Flame,
  Gift,
  HelpCircle,
  LayoutGrid,
  List,
  LoaderCircle,
  MessageCircle,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import { ReferralDialog } from '@/components/forms/ReferralDialog'
import { ReferralShareModal } from '@/components/forms/ReferralShareModal'
import {
  deleteReferral,
  ensureContactReferralCode,
  REFERRAL_STATUS_LABELS,
  updateReferral,
} from '@/services/crm'
import {
  datePt,
  initials,
  relativeTime,
  type Contact,
  type Referral,
  type ReferralStatus,
} from '@/types/crm'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ReferralStageCol {
  key: ReferralStatus
  label: string
  subtitle: string
  icon: typeof UserPlus
  badgeClass: string
  borderClass: string
  bgHeaderClass: string
  headerTextColor: string
  columnBg: string
}

const STAGE_COLUMNS: ReferralStageCol[] = [
  {
    key: 'indicado',
    label: 'Indicado',
    subtitle: 'Novo lead indicado por cliente, aguardando primeiro toque caloroso',
    icon: UserPlus,
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    borderClass: 'border-[#ebdcc6]',
    bgHeaderClass: 'bg-[#fbf5eb]',
    headerTextColor: 'text-[#693910]',
    columnBg: 'bg-[#faf2ea]',
  },
  {
    key: 'primeiro_contato',
    label: 'Primeiro contato',
    subtitle: 'Conversa iniciada via WhatsApp com boas-vindas Disney e menu sensorial',
    icon: MessageCircle,
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    borderClass: 'border-[#ccdef2]',
    bgHeaderClass: 'bg-[#edf4fd]',
    headerTextColor: 'text-[#1d4f8f]',
    columnBg: 'bg-[#f4f8fd]',
  },
  {
    key: 'primeira_compra',
    label: 'Primeira compra (Convertido)',
    subtitle: 'Amigo comprou seu primeiro café! Recompensa concedida ao indicador',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    borderClass: 'border-[#c7e9dc]',
    bgHeaderClass: 'bg-[#ecf7f1]',
    headerTextColor: 'text-[#126343]',
    columnBg: 'bg-[#f2f9f5]',
  },
]

export default function Indicacoes() {
  const { referrals, contacts, loading, refresh } = useCrm()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Estados de visualização e filtros
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'clients'>('kanban')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralStatus>('all')

  // Modais
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReferral, setEditingReferral] = useState<Referral | null>(null)
  const [presetReferrerId, setPresetReferrerId] = useState<string>('')
  const [presetStatus, setPresetStatus] = useState<ReferralStatus>('indicado')

  // Modal de Compartilhar Código / Enviar Recompensa
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareContact, setShareContact] = useState<Contact | null>(null)
  const [shareCoupon, setShareCoupon] = useState<string>('')
  const [shareReferredName, setShareReferredName] = useState<string>('')
  const [shareMode, setShareMode] = useState<'share_code' | 'reward_congrats'>('share_code')

  // Drag and drop entre estágios
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<ReferralStatus | null>(null)

  // Estatísticas do Topo (KPIs)
  const kpis = useMemo(() => {
    const total = referrals.filter((r) => r.status !== 'cancelado').length
    const converted = referrals.filter((r) => r.status === 'primeira_compra').length
    const inProgress = referrals.filter(
      (r) => r.status === 'indicado' || r.status === 'primeiro_contato',
    ).length
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0
    const rewardsIssued = referrals.filter((r) => Boolean(r.reward_coupon)).length

    return {
      total,
      converted,
      inProgress,
      conversionRate,
      rewardsIssued,
    }
  }, [referrals])

  // Ranking Top 5 Clientes que Mais Indicam
  const topReferrers = useMemo(() => {
    const counts: Record<string, { total: number; converted: number; contactId: string }> = {}

    referrals.forEach((r) => {
      if (r.status === 'cancelado') return
      const refId = r.referrer
      if (!refId) return
      if (!counts[refId]) {
        counts[refId] = { total: 0, converted: 0, contactId: refId }
      }
      counts[refId].total += 1
      if (r.status === 'primeira_compra') {
        counts[refId].converted += 1
      }
    })

    const list = Object.values(counts)
      .map((item) => {
        const contact = contacts.find((c) => c.id === item.contactId)
        return {
          ...item,
          contact,
          name: contact?.name || 'Cliente da Base',
          code: contact?.referral_code || '—',
          phone: contact?.phone || '',
        }
      })
      .sort((a, b) => {
        // Ordenar por convertidas desc, depois total desc
        if (b.converted !== a.converted) return b.converted - a.converted
        return b.total - a.total
      })

    return list.slice(0, 5)
  }, [referrals, contacts])

  // Filtro de indicações
  const filteredReferrals = useMemo(() => {
    return referrals.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      const q = search.toLowerCase().trim()
      if (!q) return true
      const refName = r.referred_name || ''
      const referrerName = r.expand?.referrer?.name || ''
      const notes = r.notes || ''
      const phone = r.referred_phone || ''
      const coupon = r.reward_coupon || ''
      return (
        refName.toLowerCase().includes(q) ||
        referrerName.toLowerCase().includes(q) ||
        notes.toLowerCase().includes(q) ||
        phone.includes(q) ||
        coupon.toLowerCase().includes(q)
      )
    })
  }, [referrals, search, statusFilter])

  // Agrupadas por coluna no Kanban
  const referralsByStage = useMemo(() => {
    const map: Record<ReferralStatus, Referral[]> = {
      indicado: [],
      primeiro_contato: [],
      primeira_compra: [],
      cancelado: [],
    }
    filteredReferrals.forEach((r) => {
      if (map[r.status]) {
        map[r.status].push(r)
      } else {
        map.indicado.push(r)
      }
    })
    return map
  }, [filteredReferrals])

  // Ação: Mover estágio (Drag & Drop ou Botão)
  const handleMoveStage = async (referralId: string, nextStage: ReferralStatus) => {
    const item = referrals.find((r) => r.id === referralId)
    if (!item || item.status === nextStage) return

    try {
      const updated = await updateReferral(referralId, { status: nextStage })
      await refresh()

      if (nextStage === 'primeira_compra') {
        const referrer = contacts.find((c) => c.id === updated.referrer)
        if (referrer) {
          toast({
            title: '🎉 Indicação Convertida com Sucesso!',
            description: `Cupom ${updated.reward_coupon} gerado para ${referrer.name}. Abrindo painel de parabenização...`,
          })
          setShareContact(referrer)
          setShareCoupon(updated.reward_coupon || 'INDICOU-XXXX')
          setShareReferredName(updated.referred_name)
          setShareMode('reward_congrats')
          setShareModalOpen(true)
          return
        }
      }

      toast({
        title: `Indicação movida para "${REFERRAL_STATUS_LABELS[nextStage]}"`,
        description: `${item.referred_name}`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível mover a indicação',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    }
  }

  // Deletar indicação
  const handleDeleteReferral = async (id: string, name: string) => {
    if (!confirm(`Deseja remover a indicação de "${name}"?`)) return
    try {
      await deleteReferral(id)
      await refresh()
      toast({ title: 'Indicação removida' })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover indicação',
      })
    }
  }

  // Abrir modal de compartilhar código de cliente
  const handleOpenShareCode = async (contact: Contact) => {
    try {
      const readyContact = await ensureContactReferralCode(contact)
      setShareContact(readyContact)
      setShareMode('share_code')
      setShareModalOpen(true)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar código do cliente',
      })
    }
  }

  // Copiar código rápido
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast({
        title: 'Código copiado!',
        description: `Código "${code}" copiado para a área de transferência.`,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar' })
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#f4ede3]">
      {/* HEADER DA PÁGINA */}
      <header className="shrink-0 border-b border-[#ded2c3] bg-[#fbf9f5] px-4 py-3.5 sm:px-6 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold flex items-center gap-1">
                <Gift className="size-3 text-amber-600" /> Programa de Indicação & Encantamento
                Disney
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-[#693910]">
                {kpis.total} indicações
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#2b1c13] flex items-center gap-2">
              Indicações de Clientes
            </h1>
            <p className="mt-0.5 text-xs text-[#705e4d]">
              Incentive seus clientes fiéis a trazerem amigos, acompanhe conversões com demarcação
              visual de colunas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => refresh()}
              title="Recarregar"
              className="inline-flex items-center gap-1 rounded-md border border-[#d6c7b6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#5c4735] shadow-2xs hover:bg-[#f3ece0] transition"
            >
              <RefreshCw className="size-3.5" />
            </button>

            {/* Alternar abas/visões */}
            <div className="inline-flex rounded-md border border-[#d6c7b6] bg-[#f0e7dc] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition',
                  viewMode === 'kanban'
                    ? 'bg-white font-bold text-[#2b1c13] shadow-2xs'
                    : 'text-[#6f5e4f] hover:text-[#2b1c13]',
                )}
              >
                <LayoutGrid className="size-3.5 text-amber-700" />
                <span>Quadro</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition',
                  viewMode === 'list'
                    ? 'bg-white font-bold text-[#2b1c13] shadow-2xs'
                    : 'text-[#6f5e4f] hover:text-[#2b1c13]',
                )}
              >
                <List className="size-3.5" />
                <span>Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('clients')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition',
                  viewMode === 'clients'
                    ? 'bg-white font-bold text-[#2b1c13] shadow-2xs'
                    : 'text-[#6f5e4f] hover:text-[#2b1c13]',
                )}
              >
                <Users className="size-3.5" />
                <span>Códigos dos Clientes</span>
              </button>
            </div>

            <button
              onClick={() => {
                setEditingReferral(null)
                setPresetReferrerId('')
                setPresetStatus('indicado')
                setDialogOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#8c531b] border border-[#6f3f12] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#724113] transition"
            >
              <Plus className="size-3.5" /> Nova Indicação
            </button>
          </div>
        </div>

        {/* PAINEL RESUMO / KPIS NO TOPO */}
        <section
          aria-label="Resumo do programa de indicação"
          className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5"
        >
          <div className="rounded-lg border border-[#e2d5c4] bg-white p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-[#786655] uppercase tracking-wider block">
              Total de Indicações
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-[#2b1c13]">{kpis.total}</span>
              <span className="text-[10px] font-mono text-[#8c7865]">amigos registrados</span>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Convertidas (1ª Compra)
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-emerald-800">{kpis.converted}</span>
              <span className="text-[10px] font-mono text-emerald-900 font-bold">
                novos clientes
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
              Taxa de Conversão
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-amber-900">{kpis.conversionRate}%</span>
              <span className="text-[10px] font-mono text-amber-800 font-semibold flex items-center gap-0.5">
                <TrendingUp className="size-3" /> do total
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-purple-300 bg-purple-50/70 p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block">
              Cupons de Recompensa
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-purple-800">{kpis.rewardsIssued}</span>
              <span className="text-[10px] font-mono text-purple-800">gerados</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-lg border border-blue-300 bg-blue-50/70 p-3 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
              Em Atendimento
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-blue-800">{kpis.inProgress}</span>
              <span className="text-[10px] font-mono text-blue-800">no funil</span>
            </div>
          </div>
        </section>

        {/* RANKING TOP 5 INDICADORES (Item 4 da Task: estilo Linear) */}
        {topReferrers.length > 0 && (
          <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Trophy className="size-3.5 text-amber-600" />
                <h2 className="text-xs font-bold text-[#1c1c1e]">
                  Ranking de Embaixadores · Top 5 Clientes que Mais Indicam
                </h2>
              </div>
              <span className="text-[10px] text-[#64748b] font-mono">
                Ordenado por conversões e volume de indicações
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
              {topReferrers.map((item, index) => {
                const medalColor =
                  index === 0
                    ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-300'
                    : index === 1
                      ? 'bg-slate-200 text-slate-800 border-slate-300'
                      : index === 2
                        ? 'bg-amber-700/10 text-amber-900 border-amber-700/30'
                        : 'bg-white text-[#475569] border-[#e2e8f0]'

                return (
                  <div
                    key={item.contactId}
                    className="flex items-center justify-between rounded-md border border-[#e2e8f0] bg-white p-2 text-xs shadow-2xs hover:border-[#cbd5e1] transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-mono font-extrabold border',
                          medalColor,
                        )}
                      >
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.contact) {
                              navigate(`/contatos?contact=${item.contact.id}`)
                            }
                          }}
                          className="font-bold text-[#1c1c1e] hover:text-amber-600 transition truncate block text-left"
                        >
                          {item.name}
                        </button>
                        <span className="font-mono text-[9px] text-[#64748b] block truncate">
                          Código: {item.code}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className="font-bold text-emerald-700 text-[11px] block">
                        {item.converted} conv.
                      </span>
                      <span className="text-[9px] text-[#94a3b8] font-mono block">
                        {item.total} tot.
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Barra de Busca e Filtro de Estágio */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="flex h-8 w-full sm:w-80 items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por amigo, cliente, código ou fone..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
            />
          </label>

          {viewMode !== 'clients' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[10px] text-[#64748b] font-medium shrink-0">Filtrar:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-semibold transition',
                  statusFilter === 'all'
                    ? 'bg-[#1c1c1e] text-white'
                    : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#1c1c1e]',
                )}
              >
                Todos ({referrals.length})
              </button>
              {(['indicado', 'primeiro_contato', 'primeira_compra'] as ReferralStatus[]).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-semibold transition whitespace-nowrap',
                      statusFilter === st
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#1c1c1e]',
                    )}
                  >
                    {REFERRAL_STATUS_LABELS[st]}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </header>

      {/* CORPO DA PÁGINA (CONFORME ABA SELECIONADA) */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* MODO 1: KANBAN BOARD ESTILO LINEAR */}
        {viewMode === 'kanban' && (
          <div className="flex-1 min-h-0 overflow-x-auto p-3 sm:p-5 touch-pan-x">
            <div className="flex gap-3 h-full min-w-[850px] sm:min-w-[1000px]">
              {STAGE_COLUMNS.map((col) => {
                const Icon = col.icon
                const items = referralsByStage[col.key] || []
                const isOver = overStage === col.key

                return (
                  <section
                    key={col.key}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setOverStage(col.key)
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setOverStage(null)
                      }
                    }}
                    onDrop={() => {
                      if (draggingId) {
                        handleMoveStage(draggingId, col.key)
                        setDraggingId(null)
                        setOverStage(null)
                      }
                    }}
                    className={cn(
                      'flex flex-col flex-1 min-w-[280px] rounded-lg border shadow-xs transition-colors',
                      col.columnBg,
                      col.borderClass,
                      isOver ? 'ring-2 ring-amber-500 shadow-md' : '',
                    )}
                  >
                    {/* Header da Coluna */}
                    <header
                      className={cn(
                        'p-3 border-b rounded-t-lg shrink-0',
                        col.bgHeaderClass,
                        col.borderClass,
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('size-4', col.headerTextColor)} />
                          <h2 className={cn('text-xs font-bold truncate', col.headerTextColor)}>
                            {col.label}
                          </h2>
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border',
                            col.badgeClass,
                          )}
                        >
                          {items.length}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[#64748b] leading-tight line-clamp-2">
                        {col.subtitle}
                      </p>
                    </header>

                    {/* Lista de Cards da Coluna */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 bg-black/[0.015]">
                      {items.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-[#8c7865] border border-dashed border-[#d8c8b6] rounded-md my-2 bg-white/40">
                          Nenhuma indicação nesta etapa
                        </div>
                      ) : (
                        items.map((ref) => {
                          const referrer =
                            contacts.find((c) => c.id === ref.referrer) || ref.expand?.referrer
                          const isConverted = ref.status === 'primeira_compra'

                          return (
                            <article
                              key={ref.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggingId(ref.id)
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              onDragEnd={() => {
                                setDraggingId(null)
                                setOverStage(null)
                              }}
                              className={cn(
                                'group cursor-grab rounded-md border bg-white p-3 shadow-2xs hover:border-[#bda895] hover:shadow-xs transition active:cursor-grabbing flex flex-col justify-between border-[#ded2c3]',
                                isConverted && 'border-emerald-300 bg-emerald-50/20',
                                draggingId === ref.id && 'opacity-40 scale-[0.98]',
                              )}
                            >
                              <div>
                                {/* Linha 1: Amigo Indicado */}
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-extrabold text-xs text-[#1c1c1e] truncate">
                                      {ref.referred_name}
                                    </h3>
                                    {ref.referred_phone && (
                                      <span className="text-[10px] font-mono text-[#64748b] block mt-0.5">
                                        📱 {ref.referred_phone}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingReferral(ref)
                                        setDialogOpen(true)
                                      }}
                                      title="Editar indicação"
                                      className="rounded p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition"
                                    >
                                      <MoreVertical className="size-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Linha 2: Quem indicou */}
                                <div className="mt-2 rounded bg-[#f8fafc] border border-[#e2e8f0] p-1.5 text-[10px]">
                                  <span className="text-[#64748b] block text-[9px] uppercase font-bold tracking-wider">
                                    Indicado por:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (referrer) {
                                        navigate(`/contatos?contact=${referrer.id}`)
                                      }
                                    }}
                                    className="font-bold text-[#1c1c1e] hover:text-amber-600 transition truncate block text-left mt-0.5"
                                  >
                                    {referrer?.name || 'Cliente da Base'}
                                  </button>
                                  <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-[#64748b]">
                                    <span>
                                      Código: <strong>{referrer?.referral_code || '—'}</strong>
                                    </span>
                                    {referrer && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenShareCode(referrer)}
                                        className="text-amber-700 hover:text-amber-800 font-bold"
                                        title="Abrir WhatsApp com texto de indicação"
                                      >
                                        WhatsApp 📲
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Linha 3: Observações */}
                                {ref.notes && (
                                  <p className="mt-2 text-[10px] text-[#64748b] leading-relaxed line-clamp-2">
                                    💬 {ref.notes}
                                  </p>
                                )}

                                {/* Linha 4: Cupom de Recompensa (se convertida) */}
                                {ref.reward_coupon && (
                                  <div className="mt-2 flex items-center justify-between rounded border border-purple-200 bg-purple-50 p-1.5 text-[10px]">
                                    <div className="flex items-center gap-1 text-purple-900 font-bold">
                                      <Gift className="size-3 text-purple-600" />
                                      <span className="font-mono">{ref.reward_coupon}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (referrer) {
                                          setShareContact(referrer)
                                          setShareCoupon(ref.reward_coupon || '')
                                          setShareReferredName(ref.referred_name)
                                          setShareMode('reward_congrats')
                                          setShareModalOpen(true)
                                        }
                                      }}
                                      className="text-[9px] font-bold text-purple-700 hover:text-purple-900 underline"
                                    >
                                      Avisar Indicador ✨
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Ações do Card */}
                              <div className="mt-3 pt-2 border-t border-[#f1f5f9] flex items-center justify-between gap-1">
                                {/* Botão para avançar estágio rapidamente */}
                                {col.key === 'indicado' && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStage(ref.id, 'primeiro_contato')}
                                    className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                                  >
                                    <MessageCircle className="size-3" /> Primeiro Contato
                                  </button>
                                )}

                                {col.key === 'primeiro_contato' && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStage(ref.id, 'primeira_compra')}
                                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                                  >
                                    <CheckCircle2 className="size-3" /> Primeira Compra ⭐
                                  </button>
                                )}

                                {col.key === 'primeira_compra' && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 className="size-2.5" /> Convertido
                                  </span>
                                )}

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReferral(ref.id, ref.referred_name)}
                                    title="Remover indicação"
                                    className="rounded p-1 text-[#94a3b8] opacity-0 group-hover:opacity-100 hover:bg-[#f1f5f9] hover:text-red-600 transition"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              </div>
                            </article>
                          )
                        })
                      )}

                      {/* Botão de adicionar na coluna */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReferral(null)
                          setPresetReferrerId('')
                          setPresetStatus(col.key)
                          setDialogOpen(true)
                        }}
                        className="flex h-7 w-full items-center justify-center gap-1 rounded border border-dashed border-[#cbd5e1] text-[10px] text-[#64748b] hover:border-[#94a3b8] hover:bg-white transition"
                      >
                        <Plus className="size-3" /> Adicionar amigo nesta etapa
                      </button>
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}

        {/* MODO 2: LISTA LINEAR DE INDICAÇÕES */}
        {viewMode === 'list' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                  <tr>
                    <th className="px-4 py-3">Amigo Indicado</th>
                    <th className="px-4 py-3">Quem Indicou (Cliente)</th>
                    <th className="px-4 py-3">Estágio</th>
                    <th className="px-4 py-3">Recompensa / Cupom</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#94a3b8]">
                        Nenhuma indicação encontrada com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredReferrals.map((ref) => {
                      const referrer =
                        contacts.find((c) => c.id === ref.referrer) || ref.expand?.referrer
                      const isConverted = ref.status === 'primeira_compra'

                      return (
                        <tr key={ref.id} className="hover:bg-[#fafbfc] transition">
                          <td className="px-4 py-3">
                            <span className="font-bold text-[#1c1c1e] block">
                              {ref.referred_name}
                            </span>
                            <span className="text-[10px] font-mono text-[#64748b]">
                              {ref.referred_phone || 'Sem telefone'}{' '}
                              {ref.referred_email ? `· ${ref.referred_email}` : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (referrer) navigate(`/contatos?contact=${referrer.id}`)
                              }}
                              className="font-semibold text-[#1c1c1e] hover:text-amber-600 transition block text-left"
                            >
                              {referrer?.name || 'Cliente da Base'}
                            </button>
                            <span className="text-[10px] font-mono text-amber-800">
                              Código: {referrer?.referral_code || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={ref.status}
                              onChange={(e) =>
                                handleMoveStage(ref.id, e.target.value as ReferralStatus)
                              }
                              className={cn(
                                'rounded px-2 py-1 text-[11px] font-semibold border outline-none',
                                isConverted
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : 'border-[#cbd5e1] bg-white text-[#334155]',
                              )}
                            >
                              {(
                                [
                                  'indicado',
                                  'primeiro_contato',
                                  'primeira_compra',
                                  'cancelado',
                                ] as ReferralStatus[]
                              ).map((st) => (
                                <option key={st} value={st}>
                                  {REFERRAL_STATUS_LABELS[st]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {ref.reward_coupon ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 text-[10px]">
                                  {ref.reward_coupon}
                                </span>
                                {referrer && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShareContact(referrer)
                                      setShareCoupon(ref.reward_coupon || '')
                                      setShareReferredName(ref.referred_name)
                                      setShareMode('reward_congrats')
                                      setShareModalOpen(true)
                                    }}
                                    className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold"
                                  >
                                    Avisar 📲
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#94a3b8] font-mono">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[10px] font-mono text-[#64748b]">
                            {relativeTime(ref.created)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReferral(ref)
                                  setDialogOpen(true)
                                }}
                                className="rounded px-2 py-1 text-[10px] font-semibold text-[#475569] hover:bg-[#f1f5f9]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteReferral(ref.id, ref.referred_name)}
                                className="rounded p-1 text-[#94a3b8] hover:text-red-600"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODO 3: PAINEL POR CLIENTE COM CÓDIGOS E TEXTO DISNEY (Item 1 da Task) */}
        {viewMode === 'clients' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 flex items-start gap-3">
              <Sparkles className="size-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950">
                <h2 className="font-bold text-sm">
                  Painel de Códigos dos Clientes & Disparo Disney via WhatsApp
                </h2>
                <p className="mt-0.5 text-amber-900 leading-relaxed">
                  Cada cliente da sua base possui um código de indicação único gerado
                  automaticamente. Clique em <strong>"Enviar WhatsApp"</strong> para abrir a
                  mensagem calorosa pré-pronta Disney que convida amigos com 15% OFF, ou copie o
                  código para entregar em mãos ou anexar a pedidos físicos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {contacts.map((contact) => {
                const code = contact.referral_code || 'GERAR-AGORA'
                const contactReferrals = referrals.filter((r) => r.referrer === contact.id)
                const convertedCount = contactReferrals.filter(
                  (r) => r.status === 'primeira_compra',
                ).length

                return (
                  <div
                    key={contact.id}
                    className="rounded-lg border border-[#e2e8f0] bg-white p-3.5 shadow-2xs hover:border-[#cbd5e1] hover:shadow-xs transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Topo do Card de Cliente */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => navigate(`/contatos?contact=${contact.id}`)}
                            className="font-extrabold text-xs text-[#1c1c1e] hover:text-amber-600 transition truncate block text-left"
                          >
                            {contact.name}
                          </button>
                          <span className="text-[10px] text-[#64748b] font-mono block mt-0.5">
                            {contact.phone || 'Sem telefone'}{' '}
                            {contact.favorite_coffee ? `· ☕ ${contact.favorite_coffee}` : ''}
                          </span>
                        </div>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono text-[#475569] shrink-0">
                          {contact.purchase_count || 0} compras
                        </span>
                      </div>

                      {/* Código de Indicação com Ação de Copiar */}
                      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/70 p-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-amber-900 tracking-wider block">
                            Código de Indicação
                          </span>
                          <span className="font-mono text-sm font-extrabold text-amber-950 mt-0.5 block">
                            {code}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(code)}
                          title="Copiar código"
                          className="rounded-md border border-amber-300 bg-white p-1.5 text-amber-800 hover:bg-amber-100 transition"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>

                      {/* Resumo de Indicações deste Cliente */}
                      <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-[#64748b] pt-2 border-t border-[#f1f5f9]">
                        <span>
                          Indicações feitas: <strong>{contactReferrals.length}</strong>
                        </span>
                        <span className="text-emerald-700 font-bold">
                          {convertedCount} convertidas
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="mt-3 pt-2 border-t border-[#f1f5f9] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReferral(null)
                          setPresetReferrerId(contact.id)
                          setPresetStatus('indicado')
                          setDialogOpen(true)
                        }}
                        className="text-[10px] font-semibold text-[#475569] hover:text-[#1c1c1e] inline-flex items-center gap-1"
                      >
                        <UserPlus className="size-3" /> Registrar amigo
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenShareCode(contact)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                      >
                        <MessageCircle className="size-3" /> Enviar WhatsApp
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* DIALOG DE CRIAR/EDITAR INDICAÇÃO */}
      <ReferralDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        referral={editingReferral}
        contacts={contacts}
        presetReferrerId={presetReferrerId}
        presetStatus={presetStatus}
        onSaved={async (saved, wasConvertedNow) => {
          await refresh()
          if (wasConvertedNow) {
            const refContact = contacts.find((c) => c.id === saved.referrer)
            if (refContact) {
              setShareContact(refContact)
              setShareCoupon(saved.reward_coupon || 'INDICOU-XXXX')
              setShareReferredName(saved.referred_name)
              setShareMode('reward_congrats')
              setShareModalOpen(true)
            }
          }
        }}
      />

      {/* MODAL DE COMPARTILHAMENTO DE CÓDIGO E PARABENIZAÇÃO VIA WHATSAPP */}
      <ReferralShareModal
        open={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false)
          setShareContact(null)
        }}
        contact={shareContact}
        rewardCoupon={shareCoupon}
        referredName={shareReferredName}
        mode={shareMode}
      />
    </div>
  )
}
