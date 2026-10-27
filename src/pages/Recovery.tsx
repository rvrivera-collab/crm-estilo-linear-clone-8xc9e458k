import { useMemo, useState } from 'react'
import {
  ArrowDownUp,
  CheckCircle2,
  Filter,
  Flame,
  LayoutGrid,
  List,
  Mail,
  RefreshCw,
  Search,
  Snowflake,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmailComposerModal } from '@/components/forms/EmailComposerModal'
import { PageSkeleton } from '@/components/PageSkeleton'
import { TemperatureBadge } from '@/components/TemperatureBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { useCrm } from '@/contexts/CrmContext'
import { cn } from '@/lib/utils'
import { daysSince, isDealCold, money, type Deal } from '@/types/crm'

export default function Recovery() {
  const { deals, loading, refresh } = useCrm()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [filterStage, setFilterStage] = useState<string>('todos')
  const [filterTemp, setFilterTemp] = useState<string>('todos')
  const [sortOrder, setSortOrder] = useState<'days-desc' | 'value-desc' | 'value-asc'>('days-desc')
  const [composerDeal, setComposerDeal] = useState<Deal | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Cold leads: open deals without contact in 5+ days or temperature 'frio'
  const rawColdLeads = useMemo(() => {
    return deals
      .filter((d) => d.status === 'aberto' && isDealCold(d, 5))
      .sort((a, b) => {
        const daysA = daysSince(a.last_contact_at || a.created)
        const daysB = daysSince(b.last_contact_at || b.created)
        return daysB - daysA
      })
  }, [deals])

  // Extract unique stages present among cold leads
  const stagesInColdLeads = useMemo(() => {
    const stageMap = new Map<string, string>()
    rawColdLeads.forEach((d) => {
      if (d.stage && d.expand?.stage?.name) {
        stageMap.set(d.stage, d.expand.stage.name)
      }
    })
    return Array.from(stageMap.entries())
  }, [rawColdLeads])

  // Filtered & sorted
  const filteredLeads = useMemo(() => {
    return rawColdLeads
      .filter((deal) => {
        const text =
          `${deal.code} ${deal.title} ${deal.expand?.contact?.name || ''} ${deal.expand?.contact?.company || ''}`.toLowerCase()
        if (query && !text.includes(query.toLowerCase())) return false
        if (filterStage !== 'todos' && deal.stage !== filterStage) return false
        if (filterTemp !== 'todos' && deal.temperature !== filterTemp) return false
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'days-desc') {
          const daysA = daysSince(a.last_contact_at || a.created)
          const daysB = daysSince(b.last_contact_at || b.created)
          return daysB - daysA
        }
        if (sortOrder === 'value-desc') {
          return b.value - a.value
        }
        return a.value - b.value
      })
  }, [rawColdLeads, query, filterStage, filterTemp, sortOrder])

  // Stats calculation
  const totalValueAtRisk = rawColdLeads.reduce((acc, d) => acc + d.value, 0)
  const criticalCount = rawColdLeads.filter(
    (d) => daysSince(d.last_contact_at || d.created) >= 10 || d.temperature === 'frio',
  ).length

  if (loading) return <PageSkeleton />

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fcfcfd]">
      {/* Top Header */}
      <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 pb-4 pt-5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700 border border-blue-200">
                <Snowflake className="size-3 text-blue-600" />
                Recuperação ativa
              </span>
              <span className="font-mono text-[10px] text-[#94a3b8]">Sem contato há 5+ dias</span>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-[-.035em] text-[#1c1c1e]">
              Central de Recuperação
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Monitore leads esfriando, priorize por criticidade e retome contato instantaneamente
              com auxílio da IA.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              title="Atualizar dados em tempo real"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc] hover:text-[#1c1c1e] transition shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin text-blue-600')} />
              <span>Atualizar</span>
            </button>
            <button
              onClick={() => navigate('/negocios')}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc] hover:text-[#1c1c1e] transition shadow-2xs"
            >
              Ver todos os negócios
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div data-tour-id="recovery-kpis" className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wide">
                Total para recuperar
              </span>
              <Snowflake className="size-3.5 text-blue-600" />
            </div>
            <p className="mt-1.5 font-mono text-xl font-bold text-blue-950">
              {rawColdLeads.length}
            </p>
            <p className="mt-0.5 text-[9px] text-blue-700">Leads ativos sem follow-up</p>
          </div>

          <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-red-800 uppercase tracking-wide">
                Estado crítico (10d+)
              </span>
              <Flame className="size-3.5 text-red-600" />
            </div>
            <p className="mt-1.5 font-mono text-xl font-bold text-red-950">{criticalCount}</p>
            <p className="mt-0.5 text-[9px] text-red-700">Necessitam ação imediata</p>
          </div>

          <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                Receita em risco
              </span>
              <Sparkles className="size-3.5 text-amber-600" />
            </div>
            <p className="mt-1.5 font-mono text-xl font-bold text-amber-950">
              {money.format(totalValueAtRisk)}
            </p>
            <p className="mt-0.5 text-[9px] text-amber-700">Soma das propostas paradas</p>
          </div>

          <div className="rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wide">
                Ação recomendada
              </span>
              <Mail className="size-3.5 text-amber-500" />
            </div>
            <p className="mt-1.5 font-semibold text-xs text-[#1c1c1e]">Retomada com IA</p>
            <p className="mt-0.5 text-[9px] text-[#94a3b8]">Dispara e-mail personalizado</p>
          </div>
        </div>

        {/* Filter bar */}
        <div data-tour-id="recovery-filters" className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex h-8 min-w-[210px] flex-1 items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs sm:max-w-xs">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por lead, empresa ou código…"
              className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#94a3b8]"
            />
          </label>

          <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2 text-[#64748b] shadow-2xs">
            <Filter className="mr-1.5 size-3" />
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="bg-transparent text-[10px] text-[#1c1c1e] outline-none"
            >
              <option value="todos">Todos os estágios</option>
              {stagesInColdLeads.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2 text-[#64748b] shadow-2xs">
            <span className="mr-1.5 text-[10px] font-semibold text-[#64748b]">Temp:</span>
            <select
              value={filterTemp}
              onChange={(e) => setFilterTemp(e.target.value)}
              className="bg-transparent text-[10px] text-[#1c1c1e] outline-none"
            >
              <option value="todos">Todas</option>
              <option value="frio">Frio</option>
              <option value="morno">Morno</option>
              <option value="quente">Quente</option>
            </select>
          </label>

          <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2 text-[#64748b] shadow-2xs">
            <ArrowDownUp className="mr-1.5 size-3" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="bg-transparent text-[10px] text-[#1c1c1e] outline-none"
            >
              <option value="days-desc">Mais dias sem contato</option>
              <option value="value-desc">Maior valor em risco</option>
              <option value="value-asc">Menor valor</option>
            </select>
          </label>

          {/* Toggle View Mode */}
          <div className="ml-auto flex items-center rounded-md border border-[#e2e8f0] bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Visualização em cards"
              className={cn(
                'rounded px-2 py-1 text-[11px] transition',
                viewMode === 'grid'
                  ? 'bg-amber-50 font-semibold text-amber-700 shadow-2xs'
                  : 'text-[#64748b] hover:text-[#1c1c1e]',
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Visualização em tabela Linear"
              className={cn(
                'rounded px-2 py-1 text-[11px] transition',
                viewMode === 'table'
                  ? 'bg-amber-50 font-semibold text-amber-700 shadow-2xs'
                  : 'text-[#64748b] hover:text-[#1c1c1e]',
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        {filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-white py-16 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
              <CheckCircle2 className="size-7" />
            </div>
            <h3 className="text-sm font-bold text-[#1c1c1e]">
              {query || filterStage !== 'todos' || filterTemp !== 'todos'
                ? 'Nenhum lead com os filtros aplicados'
                : 'Nenhum lead esfriando no momento!'}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-[#64748b]">
              {query || filterStage !== 'todos' || filterTemp !== 'todos'
                ? 'Tente ajustar ou limpar seus filtros de pesquisa para visualizar outros registros.'
                : 'Todos os seus negócios ativos receberam acompanhamento recente nos últimos 5 dias.'}
            </p>
            {(query || filterStage !== 'todos' || filterTemp !== 'todos') && (
              <button
                onClick={() => {
                  setQuery('')
                  setFilterStage('todos')
                  setFilterTemp('todos')
                }}
                className="mt-3 text-xs font-semibold text-amber-600 hover:text-amber-700"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View (Cards estilo Linear aprimorados) */
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredLeads.map((deal) => {
              const days = daysSince(deal.last_contact_at || deal.created)
              const isUrgent = days >= 10 || deal.temperature === 'frio'
              return (
                <div
                  key={deal.id}
                  onClick={() => navigate(`/negocios?deal=${deal.id}`)}
                  className={cn(
                    'group relative flex flex-col justify-between rounded-lg border bg-white p-3.5 shadow-2xs hover:border-amber-400 hover:shadow-xs transition cursor-pointer',
                    isUrgent ? 'border-red-200/90' : 'border-[#e2e8f0]',
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[9px] font-semibold text-[#94a3b8]">
                        {deal.code}
                      </span>
                      <div className="flex items-center gap-1">
                        <TemperatureBadge temperature={deal.temperature} />
                        <span
                          className={cn(
                            'font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border',
                            isUrgent
                              ? 'text-red-700 bg-red-50 border-red-200'
                              : 'text-blue-700 bg-blue-50 border-blue-200',
                          )}
                        >
                          {days === 0 ? 'Hoje' : `${days}d sem contato`}
                        </span>
                      </div>
                    </div>

                    <h3 className="mt-2.5 font-bold text-xs text-[#1c1c1e] line-clamp-1 group-hover:text-amber-700 transition">
                      {deal.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[#64748b] truncate">
                      {deal.expand?.contact?.name || 'Sem contato'}
                      {deal.expand?.contact?.company ? ` · ${deal.expand.contact.company}` : ''}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold text-[#1c1c1e]">
                        {money.format(deal.value)}
                      </span>
                      {deal.expand?.stage && (
                        <span
                          className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium"
                          style={{
                            color: deal.expand.stage.color,
                            backgroundColor: `${deal.expand.stage.color}14`,
                            border: `1px solid ${deal.expand.stage.color}40`,
                          }}
                        >
                          {deal.expand.stage.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserAvatar user={deal.expand?.owner} className="size-4 shrink-0" />
                      <span className="text-[10px] text-[#64748b] truncate max-w-[85px]">
                        {deal.expand?.owner?.name || 'Sem resp.'}
                      </span>
                    </div>

                    <button
                      type="button"
                      data-tour-id="recovery-retomar-ia"
                      onClick={(e) => {
                        e.stopPropagation()
                        setComposerDeal(deal)
                      }}
                      className="inline-flex items-center gap-1 rounded bg-amber-500 hover:bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs transition shrink-0"
                    >
                      <Sparkles className="size-3" />
                      Retomar com IA
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Table View estilo Linear */
          <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-xs">
            <div className="min-w-[840px]">
              <div className="grid h-8 grid-cols-[80px_minmax(180px,1fr)_140px_90px_110px_110px_90px_120px] items-center border-b border-[#e5e7eb] bg-[#fafafa] px-3 text-[9px] font-semibold text-[#64748b] uppercase tracking-wider">
                <span>Código</span>
                <span>Título / Oportunidade</span>
                <span>Contato</span>
                <span>Temperatura</span>
                <span>Sem contato</span>
                <span>Estágio</span>
                <span>Valor</span>
                <span className="text-right">Ação rápida</span>
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {filteredLeads.map((deal) => {
                  const days = daysSince(deal.last_contact_at || deal.created)
                  const isUrgent = days >= 10 || deal.temperature === 'frio'
                  return (
                    <div
                      key={deal.id}
                      onClick={() => navigate(`/negocios?deal=${deal.id}`)}
                      className="group grid min-h-10 cursor-pointer grid-cols-[80px_minmax(180px,1fr)_140px_90px_110px_110px_90px_120px] items-center px-3 text-[10px] transition hover:bg-[#f8fafc]"
                    >
                      <span className="font-mono text-[#64748b]">{deal.code}</span>
                      <div className="pr-3">
                        <span className="truncate block font-semibold text-[#1c1c1e] group-hover:text-amber-700">
                          {deal.title}
                        </span>
                      </div>
                      <span className="truncate pr-3 text-[#475569]">
                        {deal.expand?.contact?.name || '—'}
                      </span>
                      <span>
                        <TemperatureBadge temperature={deal.temperature} />
                      </span>
                      <span>
                        <span
                          className={cn(
                            'font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border',
                            isUrgent
                              ? 'text-red-700 bg-red-50 border-red-200'
                              : 'text-blue-700 bg-blue-50 border-blue-200',
                          )}
                        >
                          {days === 0 ? 'Hoje' : `${days} dias`}
                        </span>
                      </span>
                      <span>
                        {deal.expand?.stage && (
                          <span
                            className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium"
                            style={{
                              color: deal.expand.stage.color,
                              backgroundColor: `${deal.expand.stage.color}14`,
                              border: `1px solid ${deal.expand.stage.color}40`,
                            }}
                          >
                            {deal.expand.stage.name}
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-medium text-[#1c1c1e]">
                        {money.format(deal.value)}
                      </span>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setComposerDeal(deal)
                          }}
                          className="inline-flex items-center gap-1 rounded bg-amber-500 hover:bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs transition"
                        >
                          <Sparkles className="size-3" />
                          Retomar com IA
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer Modal reutilizando EmailComposerModal */}
      <EmailComposerModal
        open={Boolean(composerDeal)}
        onClose={() => setComposerDeal(null)}
        deal={composerDeal}
        contact={composerDeal?.expand?.contact}
        onSent={async () => {
          await refresh()
        }}
      />
    </div>
  )
}
