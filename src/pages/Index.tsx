import { useMemo, useState, useEffect } from 'react'
import {
  ArrowRight,
  Award,
  Bell,
  Briefcase,
  Cake,
  Calendar,
  CheckCircle2,
  Clock,
  Clock3,
  Coffee,
  DollarSign,
  FileText,
  Filter,
  History,
  Layers,
  Mail,
  Megaphone,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Ticket,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageSkeleton } from '@/components/PageSkeleton'
import { useCrm } from '@/contexts/CrmContext'
import { getBirthdayInfo, getDaysSinceLastPurchase, getLoyaltyLevel } from '@/types/crm'
import {
  createCustomMetric,
  deleteCustomMetric,
  listCampaigns,
  listCustomMetrics,
  reorderCustomMetrics,
  updateCustomMetric,
} from '@/services/crm'
import type { Campaign, CustomMetric, Deal, MetricAggregationType } from '@/types/crm'
import {
  daysSince,
  getDealDaysIdle,
  isDealCold,
  money,
  relativeTime,
  type Activity,
} from '@/types/crm'
import {
  computePeriodRange,
  computeStageIdleStats,
  extractStageEntries,
  isDateInPeriod,
  type PeriodFilterKey,
} from '@/lib/dashboard-filters'
import { CustomMetricsSection } from '@/components/CustomMetricsSection'
import { MetricModal } from '@/components/MetricModal'
import { FullFunnelSection } from '@/components/FullFunnelSection'
import { useToast } from '@/hooks/use-toast'
import { ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const activityIcons: Record<Activity['type'], typeof Clock3> = {
  nota: MessageSquareText,
  email: Mail,
  ligacao: Phone,
  reuniao: Video,
  sistema: Clock3,
}

export default function Index() {
  const { stages, deals, activities, contacts, loading, refresh } = useCrm()
  const navigate = useNavigate()
  const { toast } = useToast()

  // KPIs de Cafés Especiais
  const coffeeMetrics = useMemo(() => {
    let bdayToday = 0
    let bdayNext7Days = 0
    let needReengagement = 0
    const loyaltyCounts: Record<number, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
    }
    let totalPurchasesSum = 0
    let totalSpentSum = 0

    contacts.forEach((c) => {
      const bday = getBirthdayInfo(c.birthday)
      if (bday.isToday) bdayToday++
      if (bday.isNext7Days) bdayNext7Days++

      const daysSince = getDaysSinceLastPurchase(c.last_purchase_date)
      if (daysSince !== null && daysSince >= 30) {
        needReengagement++
      }

      const loyalty = getLoyaltyLevel(c.purchase_count || 0)
      loyaltyCounts[loyalty.level] = (loyaltyCounts[loyalty.level] || 0) + 1

      totalPurchasesSum += c.purchase_count || 0
      totalSpentSum += c.total_spent || 0
    })

    // Estágios da Jornada Disney para visão do todo
    const journeyStageCounts: Record<string, number> = {
      novo: 0,
      ativo: 0,
      em_risco: 0,
      reengajamento: 0,
      fa_incentivador: 0,
    }

    contacts.forEach((c) => {
      const stage =
        (c.purchase_count || 0) >= 20
          ? 'fa_incentivador'
          : getDaysSinceLastPurchase(c.last_purchase_date) !== null &&
              (getDaysSinceLastPurchase(c.last_purchase_date) || 0) >= 60
            ? 'reengajamento'
            : getDaysSinceLastPurchase(c.last_purchase_date) !== null &&
                (getDaysSinceLastPurchase(c.last_purchase_date) || 0) >= 30
              ? 'em_risco'
              : (c.purchase_count || 0) <= 1
                ? 'novo'
                : 'ativo'
      journeyStageCounts[stage] = (journeyStageCounts[stage] || 0) + 1
    })

    return {
      totalCustomers: contacts.length,
      bdayToday,
      bdayNext7Days,
      needReengagement,
      loyaltyCounts,
      totalPurchasesSum,
      totalSpentSum,
      journeyStageCounts,
    }
  }, [contacts])

  // Filtros de período exatamente como em skiprec.goskip.app:
  // 7 dias | 30 dias | 90 dias | Este mês | Tudo + campo "até [data]"
  const [period, setPeriod] = useState<PeriodFilterKey>('30d')
  const [untilDate, setUntilDate] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  // Métricas personalizadas
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([])
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [metricModalOpen, setMetricModalOpen] = useState(false)
  const [editingMetric, setEditingMetric] = useState<CustomMetric | null>(null)

  // Filtro de busca rápido na visualização de deals/atividades
  const [dealSearch, setDealSearch] = useState('')
  const [selectedStageTab, setSelectedStageTab] = useState<string>('todos')
  const [dealsSortColumn, setDealsSortColumn] = useState<'value' | 'idle' | 'created'>('value')
  const [dealsSortOrder, setDealsSortOrder] = useState<'asc' | 'desc'>('desc')

  // Campanhas
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)

  // Carregar métricas personalizadas
  const loadMetrics = async () => {
    try {
      setLoadingMetrics(true)
      const data = await listCustomMetrics()
      setCustomMetrics(data)
    } catch (err) {
      console.error('Erro ao listar métricas personalizadas:', err)
    } finally {
      setLoadingMetrics(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([listCampaigns().catch(() => []), listCustomMetrics().catch(() => [])]).then(
      ([camps, mets]) => {
        if (active) {
          setCampaigns(camps)
          setLoadingCampaigns(false)
          setCustomMetrics(mets)
          setLoadingMetrics(false)
        }
      },
    )
    return () => {
      active = false
    }
  }, [])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refresh(),
        listCampaigns().then(setCampaigns),
        listCustomMetrics().then(setCustomMetrics),
      ])
      setLastRefreshedAt(new Date())
      toast({ title: 'Dados e métricas sincronizados' })
    } finally {
      setRefreshing(false)
    }
  }

  // Handlers para métricas personalizadas
  const handleCreateOrUpdateMetric = async (data: {
    name: string
    aggregation: MetricAggregationType
    stage?: string
    status?: CustomMetric['status']
  }) => {
    if (editingMetric) {
      await updateCustomMetric(editingMetric.id, data)
      toast({ title: 'Métrica personalizada atualizada' })
    } else {
      const nextOrder =
        customMetrics.length > 0 ? Math.max(...customMetrics.map((m) => m.order || 0)) + 1 : 1
      await createCustomMetric({ ...data, order: nextOrder })
      toast({ title: 'Métrica personalizada criada' })
    }
    await loadMetrics()
  }

  const handleDeleteMetric = async (id: string) => {
    try {
      await deleteCustomMetric(id)
      setCustomMetrics((prev) => prev.filter((m) => m.id !== id))
      toast({ title: 'Métrica removida' })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao remover métrica' })
    }
  }

  const handleMoveMetric = async (id: string, direction: 'up' | 'down') => {
    const list = [...customMetrics].sort((a, b) => (a.order || 0) - (b.order || 0))
    const index = list.findIndex((m) => m.id === id)
    if (index === -1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= list.length) return

    const temp = list[index]
    list[index] = list[targetIndex]
    list[targetIndex] = temp

    setCustomMetrics(list)
    try {
      await reorderCustomMetrics(list.map((m) => m.id))
    } catch {
      await loadMetrics()
    }
  }

  // 1. Cálculo de janela do período
  const { startDate, endDate } = useMemo(() => {
    return computePeriodRange(period, untilDate)
  }, [period, untilDate])

  // 2. Extração das entradas nas etapas por deal (atividades de sistema + criação do deal)
  const { dealStageEntries } = useMemo(() => {
    return extractStageEntries(deals, stages, activities)
  }, [deals, stages, activities])

  // 3. Deals que entraram em cada etapa no período
  const stageDealsInPeriod = useMemo(() => {
    const map = new Map<string, typeof deals>()
    const dealById = new Map(deals.map((d) => [d.id, d]))

    stages.forEach((stage) => {
      const dealsEntered = new Set<string>()

      dealStageEntries.forEach((entries, dealId) => {
        const hasEntryInPeriod = entries.some(
          (entry) =>
            entry.stageId === stage.id && isDateInPeriod(entry.timestamp, startDate, endDate),
        )
        if (hasEntryInPeriod) {
          dealsEntered.add(dealId)
        }
      })

      const matchedDeals = Array.from(dealsEntered)
        .map((id) => dealById.get(id))
        .filter((d): d is (typeof deals)[number] => Boolean(d))

      map.set(stage.id, matchedDeals)
    })

    return map
  }, [stages, deals, dealStageEntries, startDate, endDate])

  // 4. Entraram no Funil: deals criados no período
  const dealsEnteredFunnelInPeriod = useMemo(() => {
    return deals.filter((deal) => isDateInPeriod(deal.created, startDate, endDate))
  }, [deals, startDate, endDate])

  // 5. Propostas Enviadas: deals que entraram no estágio de proposta ou negociação no período
  const propostaStage = useMemo(() => {
    return (
      stages.find(
        (s) =>
          s.name.toLowerCase().includes('proposta') || s.name.toLowerCase().includes('negocia'),
      ) ||
      stages[2] ||
      null
    )
  }, [stages])

  const propostasEnviadasDeals = useMemo(() => {
    if (!propostaStage) return []
    return stageDealsInPeriod.get(propostaStage.id) || []
  }, [stageDealsInPeriod, propostaStage])

  // 6. Volume Ganho & Volume Perdido no período
  const wonDealsInPeriod = useMemo(() => {
    return deals.filter(
      (deal) =>
        deal.status === 'ganho' && isDateInPeriod(deal.updated || deal.created, startDate, endDate),
    )
  }, [deals, startDate, endDate])

  const lostDealsInPeriod = useMemo(() => {
    return deals.filter(
      (deal) =>
        deal.status === 'perdido' &&
        isDateInPeriod(deal.updated || deal.created, startDate, endDate),
    )
  }, [deals, startDate, endDate])

  const wonRevenueInPeriod = useMemo(() => {
    return wonDealsInPeriod.reduce((sum, d) => sum + (d.value || 0), 0)
  }, [wonDealsInPeriod])

  const lostRevenueInPeriod = useMemo(() => {
    return lostDealsInPeriod.reduce((sum, d) => sum + (d.value || 0), 0)
  }, [lostDealsInPeriod])

  const closedCountInPeriod = wonDealsInPeriod.length + lostDealsInPeriod.length
  const winRateInPeriod =
    closedCountInPeriod > 0 ? (wonDealsInPeriod.length / closedCountInPeriod) * 100 : 0

  // 7. Todos os deals ativos no período (Volume Total)
  const allDealsInPeriod = useMemo(() => {
    const ids = new Set<string>()
    dealsEnteredFunnelInPeriod.forEach((d) => ids.add(d.id))
    stageDealsInPeriod.forEach((dealsList) => {
      dealsList.forEach((d) => ids.add(d.id))
    })
    wonDealsInPeriod.forEach((d) => ids.add(d.id))
    lostDealsInPeriod.forEach((d) => ids.add(d.id))

    if (period === 'tudo' && !untilDate) {
      return deals
    }

    const dealById = new Map(deals.map((d) => [d.id, d]))
    return Array.from(ids)
      .map((id) => dealById.get(id))
      .filter((d): d is (typeof deals)[number] => Boolean(d))
  }, [
    period,
    untilDate,
    deals,
    dealsEnteredFunnelInPeriod,
    stageDealsInPeriod,
    wonDealsInPeriod,
    lostDealsInPeriod,
  ])

  const totalVolumeInPeriod = useMemo(() => {
    return allDealsInPeriod.reduce((sum, d) => sum + (d.value || 0), 0)
  }, [allDealsInPeriod])

  // Deals abertos no pipeline
  const openDeals = useMemo(() => deals.filter((d) => d.status === 'aberto'), [deals])

  // Leads frios / sem follow-up há mais de 5 dias
  const coldLeads = useMemo(() => {
    return openDeals
      .filter((d) => isDealCold(d, 5))
      .sort((a, b) => {
        const daysA = daysSince(a.last_contact_at || a.created)
        const daysB = daysSince(b.last_contact_at || b.created)
        return daysB - daysA
      })
  }, [openDeals])

  // Volume máximo para dimensionamento do funil
  const maxStageCount = useMemo(() => {
    let max = 1
    stages.forEach((stage) => {
      const count = stageDealsInPeriod.get(stage.id)?.length || 0
      if (count > max) max = count
    })
    return max
  }, [stages, stageDealsInPeriod])

  // Estatísticas de dias parado por estágio
  const stageIdleStats = useMemo(() => {
    return computeStageIdleStats(stages, deals, activities, 14)
  }, [stages, deals, activities])

  // Campanhas
  const campaignStats = useMemo(() => {
    const statsMap: Record<
      string,
      { count: number; pipelineValue: number; wonCount: number; wonValue: number }
    > = {}

    campaigns.forEach((c) => {
      statsMap[c.id] = { count: 0, pipelineValue: 0, wonCount: 0, wonValue: 0 }
    })
    statsMap['sem_campanha'] = { count: 0, pipelineValue: 0, wonCount: 0, wonValue: 0 }

    allDealsInPeriod.forEach((deal) => {
      const campId = deal.campaign || 'sem_campanha'
      if (!statsMap[campId]) {
        statsMap[campId] = { count: 0, pipelineValue: 0, wonCount: 0, wonValue: 0 }
      }
      statsMap[campId].count += 1
      statsMap[campId].pipelineValue += deal.value || 0

      if (deal.status === 'ganho') {
        statsMap[campId].wonCount += 1
        statsMap[campId].wonValue += deal.value || 0
      }
    })

    const rows = campaigns.map((camp) => {
      const st = statsMap[camp.id] || { count: 0, pipelineValue: 0, wonCount: 0, wonValue: 0 }
      const winRate = st.count > 0 ? (st.wonCount / st.count) * 100 : 0
      return {
        id: camp.id,
        name: camp.name,
        status: camp.status,
        description: camp.description,
        count: st.count,
        pipelineValue: st.pipelineValue,
        wonCount: st.wonCount,
        wonValue: st.wonValue,
        winRate,
      }
    })

    const semCamp = statsMap['sem_campanha']
    if (semCamp && semCamp.count > 0) {
      rows.push({
        id: 'sem_campanha',
        name: 'Tráfego Direto / Sem campanha vinculada',
        status: 'ativa',
        description: 'Leads criados manualmente ou sem tag de campanha específica',
        count: semCamp.count,
        pipelineValue: semCamp.pipelineValue,
        wonCount: semCamp.wonCount,
        wonValue: semCamp.wonValue,
        winRate: semCamp.count > 0 ? (semCamp.wonCount / semCamp.count) * 100 : 0,
      })
    }

    return rows.sort((a, b) => b.pipelineValue - a.pipelineValue || b.count - a.count)
  }, [campaigns, allDealsInPeriod])

  // Filtragem dos deals exibidos na lista do período
  const filteredDealsInPeriod = useMemo(() => {
    let list: Deal[] = []
    if (selectedStageTab === 'todos') {
      list = allDealsInPeriod
    } else if (selectedStageTab === 'ganhos') {
      list = wonDealsInPeriod
    } else if (selectedStageTab === 'perdidos') {
      list = lostDealsInPeriod
    } else if (selectedStageTab === 'frios') {
      list = coldLeads
    } else {
      list = stageDealsInPeriod.get(selectedStageTab) || []
    }

    if (dealSearch.trim()) {
      const q = dealSearch.toLowerCase().trim()
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.expand?.contact?.name.toLowerCase().includes(q) ||
          d.expand?.contact?.company?.toLowerCase().includes(q),
      )
    }

    // Ordenação da tabela
    return [...list].sort((a, b) => {
      if (dealsSortColumn === 'idle') {
        const idleA = getDealDaysIdle(a, activities)
        const idleB = getDealDaysIdle(b, activities)
        return dealsSortOrder === 'desc' ? idleB - idleA : idleA - idleB
      }
      if (dealsSortColumn === 'created') {
        const dateA = new Date(a.created || 0).getTime()
        const dateB = new Date(b.created || 0).getTime()
        return dealsSortOrder === 'desc' ? dateB - dateA : dateA - dateB
      }
      // default: value
      const valA = a.value || 0
      const valB = b.value || 0
      return dealsSortOrder === 'desc' ? valB - valA : valA - valB
    })
  }, [
    allDealsInPeriod,
    wonDealsInPeriod,
    lostDealsInPeriod,
    coldLeads,
    selectedStageTab,
    stageDealsInPeriod,
    dealSearch,
    dealsSortColumn,
    dealsSortOrder,
    activities,
  ])

  if (loading) return <PageSkeleton />

  const periodButtons: Array<{ id: PeriodFilterKey; label: string }> = [
    { id: '7d', label: '7 dias' },
    { id: '30d', label: '30 dias' },
    { id: '90d', label: '90 dias' },
    { id: 'mes', label: 'Este mês' },
    { id: 'tudo', label: 'Tudo' },
  ]

  return (
    <div className="h-full w-full overflow-y-auto bg-[#faf7f2]">
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6 space-y-4">
        {/* ============================================================ */}
        {/* 1. HEADER: Estilo Linear em tons quentes de cafeteria */}
        {/* ============================================================ */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#ded2c3] pb-4 bg-[#fbf9f5] p-4 rounded-lg shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-[#8c531b] uppercase tracking-wider">
                CRM Cafés Especiais
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-emerald-400/50 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-semibold text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Sincronizado
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#2b1c13] sm:text-3xl">
              Painel de Clientes & Vendas
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/lembretes')}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 shadow-2xs hover:bg-rose-100 transition"
            >
              <Bell className="size-3.5 text-rose-600" />
              <span>Ver Lembretes</span>
              {coffeeMetrics.bdayToday > 0 && (
                <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                  {coffeeMetrics.bdayToday} hoje
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#d6c7b6] bg-white px-3.5 py-2 text-xs font-semibold text-[#5c4735] shadow-2xs hover:bg-[#f3ece0] transition disabled:opacity-60"
              title="Atualizar dados do CRM"
            >
              <RefreshCw className={cn('size-3.5 text-[#786655]', refreshing && 'animate-spin')} />
              <span>{refreshing ? 'Carregando…' : 'Atualizar'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/contatos')}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#8c531b] border border-[#6f3f12] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#724113] transition shadow-xs"
            >
              <Coffee className="size-3.5" />
              <span>Ver Clientes</span>
            </button>
          </div>
        </header>

        {/* ============================================================ */}
        {/* 1.1 RESUMO DA SAÚDE DA JORNADA DO CLIENTE (EXPERIÊNCIA DISNEY) */}
        {/* ============================================================ */}
        <section className="rounded-lg border border-[#ebdcc6] bg-[#fdfaf5] p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-700 font-bold">
                  Saúde da Jornada Disney · Visão do Todo
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-900">
                  <Sparkles className="size-2.5" /> Encantamento & Atenção aos Detalhes
                </span>
              </div>
              <h2 className="text-sm font-extrabold text-[#1c1c1e] mt-0.5">
                Distribuição dos Clientes por Estágio de Experiência
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/jornada')}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 underline transition"
            >
              Abrir Quadro Geral da Jornada <ArrowRight className="size-3" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <div
              onClick={() => navigate('/jornada')}
              className="cursor-pointer rounded-md border border-blue-200 bg-blue-50/40 p-2.5 hover:bg-blue-50 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-900 uppercase">1. Novos</span>
                <Sparkles className="size-3 text-blue-600" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-blue-950">
                {coffeeMetrics.journeyStageCounts.novo || 0}
              </p>
              <p className="text-[9px] text-blue-800 leading-tight">Boas-vindas & sensorial</p>
            </div>

            <div
              onClick={() => navigate('/jornada')}
              className="cursor-pointer rounded-md border border-emerald-200 bg-emerald-50/40 p-2.5 hover:bg-emerald-50 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-900 uppercase">2. Ativos</span>
                <UserCheck className="size-3 text-emerald-600" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-emerald-950">
                {coffeeMetrics.journeyStageCounts.ativo || 0}
              </p>
              <p className="text-[9px] text-emerald-800 leading-tight">Recompra &lt; 30 dias</p>
            </div>

            <div
              onClick={() => navigate('/lembretes')}
              className="cursor-pointer rounded-md border border-orange-200 bg-orange-50/40 p-2.5 hover:bg-orange-50 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-orange-900 uppercase">3. Em Risco</span>
                <Clock className="size-3 text-orange-600" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-orange-950">
                {coffeeMetrics.journeyStageCounts.em_risco || 0}
              </p>
              <p className="text-[9px] text-orange-800 leading-tight">30–59d sem comprar</p>
            </div>

            <div
              onClick={() => navigate('/lembretes')}
              className="cursor-pointer rounded-md border border-rose-200 bg-rose-50/40 p-2.5 hover:bg-rose-50 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-900 uppercase">4. Reengajar</span>
                <History className="size-3 text-rose-600" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-rose-950">
                {coffeeMetrics.journeyStageCounts.reengajamento || 0}
              </p>
              <p className="text-[9px] text-rose-800 leading-tight">60d+ resgate urgente</p>
            </div>

            <div
              onClick={() => navigate('/jornada')}
              className="cursor-pointer rounded-md border border-purple-200 bg-purple-50/40 p-2.5 hover:bg-purple-50 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-900 uppercase">5. Fãs VIP</span>
                <Award className="size-3 text-purple-600" />
              </div>
              <p className="mt-1 font-mono text-xl font-bold text-purple-950">
                {coffeeMetrics.journeyStageCounts.fa_incentivador || 0}
              </p>
              <p className="text-[9px] text-purple-800 leading-tight">Nível 3+ (20+ compras)</p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 1.2 CARDS DE DESTAQUE: CAFÉS ESPECIAIS & FIDELIDADE           */}
        {/* ============================================================ */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Card: Total de Clientes */}
          <article
            onClick={() => navigate('/contatos')}
            className="cursor-pointer rounded-lg border border-border bg-card p-4 shadow-2xs hover:border-amber-400 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Total de Clientes
                </span>
                <Users className="size-3.5 text-amber-600" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-foreground">
                {coffeeMetrics.totalCustomers}
              </p>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {coffeeMetrics.totalPurchasesSum} compras registradas
            </p>
          </article>

          {/* Card: Aniversários Hoje */}
          <article
            onClick={() => navigate('/lembretes')}
            className={cn(
              'cursor-pointer rounded-lg border p-4 shadow-2xs transition flex flex-col justify-between',
              coffeeMetrics.bdayToday > 0
                ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400'
                : 'border-border bg-card hover:border-muted-foreground/30',
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
                  Aniversariantes Hoje
                </span>
                <Cake className="size-3.5 text-rose-600" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-rose-950">
                {coffeeMetrics.bdayToday}
              </p>
            </div>
            <p className="mt-2 text-[11px] text-rose-800">
              {coffeeMetrics.bdayNext7Days} nos próximos 7 dias · Gerar cupom
            </p>
          </article>

          {/* Card: Retomada (30+ dias sem comprar) */}
          <article
            onClick={() => navigate('/lembretes')}
            className={cn(
              'cursor-pointer rounded-lg border p-4 shadow-2xs transition flex flex-col justify-between',
              coffeeMetrics.needReengagement > 0
                ? 'border-orange-300 bg-orange-50/40 hover:border-orange-400'
                : 'border-border bg-card hover:border-muted-foreground/30',
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-orange-800 uppercase tracking-wider">
                  Retomar Contato (30d+)
                </span>
                <History className="size-3.5 text-orange-600" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-orange-950">
                {coffeeMetrics.needReengagement}
              </p>
            </div>
            <p className="mt-2 text-[11px] text-orange-800">Garantir recorrência de compras</p>
          </article>

          {/* Card: Níveis de Fidelidade */}
          <article
            onClick={() => navigate('/contatos')}
            className="cursor-pointer rounded-lg border border-amber-200/90 bg-amber-50/30 p-4 shadow-2xs hover:border-amber-400 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                  Programa Fidelidade
                </span>
                <Award className="size-3.5 text-amber-700" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-mono font-bold">
                <span
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700"
                  title="Sem nível (0-9 compras)"
                >
                  Sem nível: {coffeeMetrics.loyaltyCounts[0] || 0}
                </span>
                <span
                  className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900"
                  title="Semente Energética (10-19 compras)"
                >
                  Semente: {coffeeMetrics.loyaltyCounts[1] || 0}
                </span>
                <span
                  className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-900"
                  title="Mudinha de CAFÉÉÉÉ (20-29 compras)"
                >
                  Mudinha: {coffeeMetrics.loyaltyCounts[2] || 0}
                </span>
                <span
                  className="rounded bg-amber-200 px-1.5 py-0.5 text-amber-950"
                  title="Doce Grão de Cereja (30-39 compras)"
                >
                  Grão de Cereja: {coffeeMetrics.loyaltyCounts[3] || 0}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-amber-800">
              10 níveis oficiais: um a cada 10 compras
            </p>
          </article>
        </section>
        {/* ============================================================ */}
        {/* 2. FILTROS DE PERÍODO & CAMPO "ATÉ"                          */}
        {/* ============================================================ */}
        <section
          data-tour-id="dashboard-period-filter"
          className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs"
        >
          <div className="flex flex-wrap items-center gap-1">
            {periodButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setPeriod(btn.id)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition',
                  period === btn.id
                    ? 'bg-foreground text-background shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono text-[11px] uppercase font-semibold">até</span>
              <div className="relative">
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground shadow-2xs focus:border-ring focus:outline-none"
                />
              </div>
            </label>
            {untilDate && (
              <button
                type="button"
                onClick={() => setUntilDate('')}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline transition"
                title="Remover limite de data"
              >
                <X className="size-3" /> Limpar
              </button>
            )}
          </div>
        </section>
        {/* ============================================================ */}
        {/* 3. NOTA DA METODOLOGIA (Exatamente o texto da referência)    */}
        {/* ============================================================ */}
        <div className="rounded-md border border-amber-200/80 bg-amber-50/40 px-3.5 py-2.5 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
          <span className="font-bold shrink-0 text-amber-800">Nota da esteira:</span>
          <p className="leading-relaxed text-[11px] text-amber-900">
            O período filtra por <strong>data de entrada na etapa</strong>: cada etapa conta os
            deals que entraram nela na janela escolhida, então o funil reflete a atividade do
            período e não uma coorte fechada.
          </p>
        </div>
        {/* ============================================================ */}
        {/* 4. OS 5 CARDS DE KPI (Fiel ao layout e estrutura de skiprec) */}
        {/* ============================================================ */}
        <section
          data-tour-id="dashboard-kpis"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          {/* Card 1: Volume Total */}
          <article className="rounded-lg border border-border bg-card p-4 shadow-2xs hover:border-muted-foreground/30 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Volume Total
                </span>
                <DollarSign className="size-3.5 text-blue-600" />
              </div>
              <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-foreground">
                {money.format(totalVolumeInPeriod)}
              </p>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {allDealsInPeriod.length} deals
            </p>
          </article>

          {/* Card 2: Entraram no Funil */}
          <article className="rounded-lg border border-border bg-card p-4 shadow-2xs hover:border-muted-foreground/30 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Entraram no Funil
                </span>
                <Layers className="size-3.5 text-amber-600" />
              </div>
              <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-foreground">
                {dealsEnteredFunnelInPeriod.length}
              </p>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">MED + Recuperação</p>
          </article>

          {/* Card 3: Propostas Enviadas */}
          <article className="rounded-lg border border-border bg-card p-4 shadow-2xs hover:border-muted-foreground/30 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Propostas Enviadas
                </span>
                <FileText className="size-3.5 text-indigo-600" />
              </div>
              <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-foreground">
                {propostasEnviadasDeals.length}
              </p>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">no período</p>
          </article>

          {/* Card 4: Volume Ganho */}
          <article className="rounded-lg border border-emerald-300/80 bg-emerald-50/20 p-4 shadow-2xs hover:border-emerald-400 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                  Volume Ganho
                </span>
                <TrendingUp className="size-3.5 text-emerald-600" />
              </div>
              <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-emerald-950">
                {money.format(wonRevenueInPeriod)}
              </p>
            </div>
            <p className="mt-2 font-mono text-[11px] font-medium text-emerald-800">
              {wonDealsInPeriod.length} ganhos · win rate {winRateInPeriod.toFixed(0)}%
            </p>
          </article>

          {/* Card 5: Volume Perdido */}
          <article className="rounded-lg border border-border bg-card p-4 shadow-2xs hover:border-muted-foreground/30 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Volume Perdido
                </span>
                <TrendingDown className="size-3.5 text-rose-500" />
              </div>
              <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-foreground">
                {money.format(lostRevenueInPeriod)}
              </p>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {lostDealsInPeriod.length} deals perdidos
            </p>
          </article>
        </section>
        {/* ============================================================ */}
        {/* 5. MÉTRICAS PERSONALIZADAS DE VENDAS                         */}
        {/* ============================================================ */}
        <div data-tour-id="dashboard-custom-metrics">
          <CustomMetricsSection
            metrics={customMetrics}
            dealsInPeriod={allDealsInPeriod}
            stages={stages}
            onAddMetric={() => {
              setEditingMetric(null)
              setMetricModalOpen(true)
            }}
            onEditMetric={(metric) => {
              setEditingMetric(metric)
              setMetricModalOpen(true)
            }}
            onDeleteMetric={handleDeleteMetric}
            onMoveMetric={handleMoveMetric}
            loading={loadingMetrics}
          />
        </div>
        {/* ============================================================ */}
        {/* 6. TEASER CENTRAL DE RECUPERAÇÃO (Atalho G+R e status)       */}
        {/* ============================================================ */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-blue-200/90 bg-blue-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 shadow-2xs">
              <Snowflake className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-foreground">
                  Central de Recuperação
                </h2>
                {coldLeads.length > 0 ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800 border border-blue-200">
                    {coldLeads.length} leads sem follow-up
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="size-3 text-emerald-600" /> Funil em dia
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {coldLeads.length > 0
                  ? `${coldLeads.length} oportunidades sem contato há mais de 5 dias ou com temperatura fria. Recupere com IA e cadência.`
                  : 'Excelente! Todas as oportunidades em andamento receberam follow-up nos últimos 5 dias.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline font-mono text-[10px] text-muted-foreground">
              Atalho rápido: <kbd className="rounded border bg-card px-1 py-0.5 font-bold">G</kbd> +{' '}
              <kbd className="rounded border bg-card px-1 py-0.5 font-bold">R</kbd>
            </span>
            <button
              type="button"
              onClick={() => navigate('/recuperacao')}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-card px-3.5 py-1.5 text-xs font-semibold text-blue-800 shadow-2xs hover:bg-blue-50 transition"
            >
              <span>Ver Central de Recuperação</span>
              <ArrowRight className="size-3.5 text-blue-600" />
            </button>
          </div>
        </section>
        {/* ============================================================ */}
        {/* 7. GRID PRINCIPAL: FUNIL COMPLETO (DIAS PARADO) + LINHA DO TEMPO */}
        {/* ============================================================ */}
        <div
          data-tour-id="dashboard-funnel-section"
          className="grid gap-4 lg:grid-cols-[1.55fr_1fr]"
        >
          {/* Funil Completo com Dias Parado e Metricas por Estagio */}
          <FullFunnelSection
            stages={stages}
            stageDealsInPeriod={stageDealsInPeriod}
            stageIdleStats={stageIdleStats}
            maxStageCount={maxStageCount}
            winRateInPeriod={winRateInPeriod}
            wonCount={wonDealsInPeriod.length}
            lostCount={lostDealsInPeriod.length}
            onSelectStageTab={(stageId) => setSelectedStageTab(stageId)}
          />

          {/* Linha do Tempo: Últimas Interações */}
          <section className="rounded-lg border border-border bg-card shadow-2xs flex flex-col">
            <div className="flex h-12 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <Clock3 className="size-3.5 text-muted-foreground" />
                <h2 className="text-xs font-bold text-foreground">Últimas interações</h2>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">Tempo real</span>
            </div>

            <div className="divide-y divide-border flex-1 overflow-y-auto max-h-[460px]">
              {activities.slice(0, 10).map((activity) => {
                const Icon = activityIcons[activity.type] || MessageSquareText
                const isEmail = activity.type === 'email'
                const isSystem = activity.type === 'sistema'
                return (
                  <div
                    key={activity.id}
                    className="flex gap-2.5 px-3.5 py-2.5 hover:bg-muted/40 transition"
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border ${
                        isEmail
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : isSystem
                            ? 'border-blue-200 bg-blue-50 text-blue-600'
                            : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[11px] leading-4 text-foreground/90">
                        {activity.content}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                        {activity.expand?.author?.name || 'Sistema'} ·{' '}
                        {relativeTime(activity.created)}
                      </p>
                    </div>
                  </div>
                )
              })}
              {!activities.length && (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  Nenhuma interação recente registrada no período.
                </p>
              )}
            </div>
          </section>
        </div>
        {/* ============================================================ */}
        {/* 7. DETALHE DOS DEALS DO PERÍODO COM ABAS E BUSCA             */}
        {/* ============================================================ */}
        <section
          data-tour-id="dashboard-deals-table"
          className="rounded-lg border border-border bg-card shadow-2xs overflow-hidden"
        >
          <div className="border-b border-border p-3.5 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-foreground">Oportunidades Ativas no Período</h2>
              <p className="text-[11px] text-muted-foreground">
                Visualização analítica de negócios envolvidos na janela selecionada.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={dealSearch}
                  onChange={(e) => setDealSearch(e.target.value)}
                  placeholder="Buscar por título, código ou contato…"
                  className="h-8 pl-8 pr-2.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring w-48 sm:w-64"
                />
                {dealSearch && (
                  <button
                    type="button"
                    onClick={() => setDealSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Abas de filtro rápido por estágio */}
          <div className="flex flex-wrap items-center gap-1.5 px-3.5 py-2 border-b border-border bg-card text-[11px] overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedStageTab('todos')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                selectedStageTab === 'todos'
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              Todos ({allDealsInPeriod.length})
            </button>

            {stages.map((st) => {
              const count = stageDealsInPeriod.get(st.id)?.length || 0
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStageTab(st.id)}
                  className={cn(
                    'px-2.5 py-1 rounded font-medium transition inline-flex items-center gap-1.5',
                    selectedStageTab === st.id
                      ? 'bg-foreground text-background shadow-2xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: st.color }} />
                  <span>{st.name}</span>
                  <span className="font-mono text-[10px] opacity-80">({count})</span>
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setSelectedStageTab('ganhos')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition text-emerald-700',
                selectedStageTab === 'ganhos'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'hover:bg-emerald-50',
              )}
            >
              Ganhos ({wonDealsInPeriod.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageTab('perdidos')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition text-rose-700',
                selectedStageTab === 'perdidos'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'hover:bg-rose-50',
              )}
            >
              Perdidos ({lostDealsInPeriod.length})
            </button>

            {coldLeads.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStageTab('frios')}
                className={cn(
                  'px-2.5 py-1 rounded font-medium transition text-blue-700',
                  selectedStageTab === 'frios'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'hover:bg-blue-50',
                )}
              >
                Frios / Sem contato ({coldLeads.length})
              </button>
            )}
          </div>

          {/* Lista de Deals */}
          <div className="overflow-x-auto">
            {filteredDealsInPeriod.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum negócio encontrado para os critérios selecionados neste período.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-3">Oportunidade</th>
                    <th className="py-2.5 px-3">Contato / Empresa</th>
                    <th className="py-2.5 px-3">Estágio</th>
                    <th className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (dealsSortColumn === 'idle') {
                            setDealsSortOrder(dealsSortOrder === 'desc' ? 'asc' : 'desc')
                          } else {
                            setDealsSortColumn('idle')
                            setDealsSortOrder('desc')
                          }
                        }}
                        className="inline-flex items-center gap-1 hover:text-foreground font-semibold"
                      >
                        <span>Dias parado</span>
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (dealsSortColumn === 'value') {
                            setDealsSortOrder(dealsSortOrder === 'desc' ? 'asc' : 'desc')
                          } else {
                            setDealsSortColumn('value')
                            setDealsSortOrder('desc')
                          }
                        }}
                        className="inline-flex items-center gap-1 hover:text-foreground font-semibold ml-auto"
                      >
                        <span>Valor</span>
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredDealsInPeriod.slice(0, 15).map((deal) => {
                    const dealStage = stages.find((s) => s.id === deal.stage)
                    const daysIdle = getDealDaysIdle(deal, activities)
                    const isStalled = daysIdle >= 14 && deal.status === 'aberto'
                    const isWarning = daysIdle >= 7 && deal.status === 'aberto'

                    return (
                      <tr
                        key={deal.id}
                        onClick={() => navigate('/negocios')}
                        className="hover:bg-muted/30 transition cursor-pointer"
                      >
                        <td className="py-2.5 px-4 font-mono text-[11px] font-semibold text-muted-foreground">
                          {deal.code}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground min-w-[180px]">
                          {deal.title}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {deal.expand?.contact?.name || '—'}
                          {deal.expand?.contact?.company && (
                            <span className="block text-[10px] text-muted-foreground/80">
                              {deal.expand.contact.company}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {dealStage ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: dealStage.color }}
                              />
                              {dealStage.name}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {deal.status === 'aberto' ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-[10px]',
                                isStalled
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : isWarning
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'text-muted-foreground',
                              )}
                              title={`${daysIdle} dias sem mudar de estágio`}
                            >
                              {daysIdle}d parado
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold capitalize',
                              deal.status === 'ganho'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : deal.status === 'perdido'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-300'
                                  : 'bg-muted text-muted-foreground border border-border',
                            )}
                          >
                            {deal.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
                          {money.format(deal.value || 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
        {/* ============================================================ */}
        {/* 8. COMPARAÇÃO POR CAMPANHA DE AQUISIÇÃO                      */}
        {/* ============================================================ */}
        <section className="rounded-lg border border-border bg-card shadow-2xs flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border px-4 py-3 gap-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-amber-600" />
              <div>
                <h2 className="text-xs font-bold text-foreground">
                  Desempenho por Campanha de Aquisição
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Comparativo de leads gerados, receita movimentada em pipeline e conversões na
                  janela selecionada.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/campanhas')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 transition"
            >
              <span>Gerenciar Campanhas</span>
              <ArrowRight className="size-3 text-amber-600" />
            </button>
          </div>

          {loadingCampaigns ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Carregando métricas das campanhas…
            </div>
          ) : campaignStats.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhuma campanha cadastrada no momento. Crie campanhas para acompanhar o retorno por
              canal.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-4">Campanha</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Leads no Período</th>
                    <th className="py-2.5 px-3 text-right">Volume em Pipeline</th>
                    <th className="py-2.5 px-3 text-right">Ganhos</th>
                    <th className="py-2.5 px-4 text-right">Taxa de Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {campaignStats.map((camp) => (
                    <tr key={camp.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-4 min-w-[200px]">
                        <span className="font-semibold text-foreground block truncate">
                          {camp.name}
                        </span>
                        {camp.description && (
                          <span className="text-[11px] text-muted-foreground truncate block mt-0.5">
                            {camp.description}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold capitalize',
                            camp.status === 'ativa'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : camp.status === 'pausada'
                                ? 'border-amber-300 bg-amber-50 text-amber-800'
                                : 'border-slate-300 bg-slate-100 text-slate-700',
                          )}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {camp.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                        {camp.count}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                        {money.format(camp.pipelineValue)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {camp.wonCount > 0
                          ? `${camp.wonCount} (${money.format(camp.wonValue)})`
                          : '0'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded border text-[11px]',
                            camp.winRate > 0
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-border bg-muted text-muted-foreground',
                          )}
                        >
                          {camp.winRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {/* Modal de criação / edição de métrica personalizada */}
        <MetricModal
          open={metricModalOpen}
          onOpenChange={setMetricModalOpen}
          metricToEdit={editingMetric}
          stages={stages}
          onSave={handleCreateOrUpdateMetric}
        />
        {/* Rodapé discreto com carimbo de atualização */}
        <footer className="pt-2 pb-4 text-center">
          <p className="font-mono text-[11px] text-muted-foreground">
            Última sincronização: {lastRefreshedAt.toLocaleTimeString('pt-BR')} · Visual linear CRM
            Overview
          </p>
        </footer>
      </div>
    </div>
  )
}
