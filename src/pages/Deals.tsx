import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Edit3,
  Filter,
  Search,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DealDialog } from '@/components/forms/DealDialog'
import { DealDrawer } from '@/components/DealDrawer'
import { EmailComposerModal } from '@/components/forms/EmailComposerModal'
import { PageSkeleton } from '@/components/PageSkeleton'
import { TemperatureBadge } from '@/components/TemperatureBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { useCrm } from '@/contexts/CrmContext'
import { useToast } from '@/hooks/use-toast'
import { updateDeal } from '@/services/crm'
import { cn } from '@/lib/utils'
import { daysSince, datePt, getDealDaysIdle, money, type Deal } from '@/types/crm'
import { Mail } from 'lucide-react'

export default function Deals() {
  const { deals, stages, activities, users, loading, refresh } = useCrm()
  const { toast } = useToast()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<'nenhum' | 'stage' | 'owner' | 'status'>('nenhum')
  const [sort, setSort] = useState<'value-desc' | 'value-asc' | 'date' | 'idle-desc'>('value-desc')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Deal | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [emailDeal, setEmailDeal] = useState<Deal | null>(null)
  const detail = deals.find((deal) => deal.id === params.get('deal')) || null
  useEffect(() => {
    const handler = () => {
      setEditing(null)
      setDialogOpen(true)
    }
    window.addEventListener('crm:new-deal', handler)
    return () => window.removeEventListener('crm:new-deal', handler)
  }, [])
  const filtered = useMemo(
    () =>
      deals
        .filter((deal) => {
          const text =
            `${deal.code} ${deal.title} ${deal.expand?.contact?.name || ''}`.toLowerCase()
          return text.includes(query.toLowerCase()) && (!onlyOpen || deal.status === 'aberto')
        })
        .sort((a, b) => {
          if (sort === 'value-desc') return b.value - a.value
          if (sort === 'value-asc') return a.value - b.value
          if (sort === 'idle-desc') {
            const idleA = getDealDaysIdle(a, activities)
            const idleB = getDealDaysIdle(b, activities)
            return idleB - idleA
          }
          return +new Date(a.expected_close || 0) - +new Date(b.expected_close || 0)
        }),
    [deals, activities, query, onlyOpen, sort],
  )
  const groups = useMemo(() => {
    if (group === 'nenhum') return [['Todos os negócios', filtered] as [string, Deal[]]]
    const map = new Map<string, Deal[]>()
    filtered.forEach((deal) => {
      const label =
        group === 'stage'
          ? deal.expand?.stage?.name || 'Sem estágio'
          : group === 'owner'
            ? deal.expand?.owner?.name || 'Sem responsável'
            : deal.status
      map.set(label, [...(map.get(label) || []), deal])
    })
    return [...map.entries()]
  }, [filtered, group])
  if (loading) return <PageSkeleton />
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  async function bulk(status: 'ganho' | 'perdido') {
    await Promise.all([...selected].map((id) => updateDeal(id, { status })))
    setSelected(new Set())
    await refresh()
    toast({ title: `${selected.size} negócios marcados como ${status}` })
  }
  async function quick(deal: Deal, status: 'ganho' | 'perdido') {
    await updateDeal(deal.id, { status })
    await refresh()
    toast({ title: `${deal.code} marcado como ${status}` })
  }
  function open(deal: Deal) {
    navigate(`/negocios?deal=${deal.id}`)
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#faf7f2]">
      <div className="shrink-0 border-b border-[#ded2c3] bg-[#fbf9f5] px-4 pb-3 pt-4 sm:px-5 shadow-2xs">
        <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
          Base comercial · Cafés Especiais
        </p>
        <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#2b1c13]">Negócios</h1>
        <div data-tour-id="deals-search-filters" className="mt-4 flex flex-wrap gap-2">
          <label className="flex h-8 min-w-[210px] flex-1 items-center rounded-md border border-[#d6c7b6] bg-white px-2.5 shadow-2xs sm:max-w-sm">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, contato ou código…"
              className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#94a3b8]"
            />
          </label>
          <Select
            icon={Filter}
            value={group}
            onChange={(value) => setGroup(value as typeof group)}
            options={[
              ['nenhum', 'Sem agrupar'],
              ['stage', 'Por estágio'],
              ['owner', 'Por responsável'],
              ['status', 'Por status'],
            ]}
          />
          <Select
            icon={ArrowDownUp}
            value={sort}
            onChange={(value) => setSort(value as typeof sort)}
            options={[
              ['value-desc', 'Maior valor'],
              ['value-asc', 'Menor valor'],
              ['idle-desc', 'Mais dias parado'],
              ['date', 'Fechamento'],
            ]}
          />
          <button
            onClick={() => setOnlyOpen(!onlyOpen)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[10px] shadow-2xs transition',
              onlyOpen
                ? 'border-amber-500/30 bg-amber-50 text-amber-700'
                : 'border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]',
            )}
          >
            <span
              className={cn(
                'grid size-3 place-items-center rounded-sm border',
                onlyOpen ? 'border-amber-500 bg-amber-500 text-white' : 'border-[#cbd5e1]',
              )}
            >
              {onlyOpen && <Check className="size-2.5" />}
            </span>{' '}
            Somente abertos
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[960px]">
          {groups.map(([label, items]) => (
            <section key={label}>
              <div
                data-tour-id="deals-table-header"
                className="flex h-8 items-center border-b border-[#ded2c3] bg-[#f5ede2] px-3 text-[9px] font-bold uppercase tracking-wider text-[#5c4735]"
              >
                <ChevronDown className="mr-1.5 size-3 text-[#8c531b]" />
                {label}
                <span className="ml-1.5 rounded bg-white/80 border border-[#d6c7b6] px-1.5 font-mono text-[8px] text-[#2b1c13] font-bold">
                  {items.length}
                </span>
                <span className="ml-auto font-mono font-bold text-[#5c4735]">
                  {money.format(items.reduce((sum, item) => sum + item.value, 0))}
                </span>
              </div>
              <div className="grid h-8 grid-cols-[32px_82px_minmax(160px,1.2fr)_120px_110px_80px_80px_85px_95px_80px_75px_76px] items-center border-b border-[#ded2c3] bg-[#f3ece0] px-2 text-[9px] font-semibold text-[#5c4735]">
                <span />
                <span>Código</span>
                <span>Título</span>
                <span>Contato</span>
                <span>Empresa</span>
                <span>Temperatura</span>
                <span>Sem contato</span>
                <span>Dias parado</span>
                <span>Estágio</span>
                <span>Valor</span>
                <span>Fechamento</span>
                <span>Status</span>
              </div>
              {!items.length && (
                <div className="py-8 text-center text-xs text-[#94a3b8]">
                  Nenhum negócio cadastrado neste grupo.
                </div>
              )}
              {items.map((deal, index) => {
                const days = daysSince(deal.last_contact_at || deal.created)
                const daysIdle = getDealDaysIdle(deal, activities)
                const isIdleWarning = daysIdle >= 7 && deal.status === 'aberto'
                const isIdleDanger = daysIdle >= 14 && deal.status === 'aberto'

                return (
                  <div
                    key={deal.id}
                    {...(index === 0 ? { 'data-tour-id': 'deals-first-row' } : {})}
                    onClick={() => open(deal)}
                    className="group grid min-h-9 animate-row-fade cursor-pointer grid-cols-[32px_82px_minmax(160px,1.2fr)_120px_110px_80px_80px_85px_95px_80px_75px_76px] items-center border-b border-[#f1f5f9] px-2 text-[10px] transition hover:bg-[#f8fafc]"
                    style={{ animationDelay: `${Math.min(index * 15, 150)}ms` }}
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle(deal.id)
                      }}
                      className={cn(
                        'grid size-3.5 place-items-center rounded-sm border',
                        selected.has(deal.id)
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-[#cbd5e1] hover:border-[#94a3b8]',
                      )}
                    >
                      {selected.has(deal.id) && <Check className="size-2.5" />}
                    </span>
                    <span className="font-mono text-[#64748b]">{deal.code}</span>
                    <span className="truncate pr-3 font-semibold text-[#1c1c1e]">{deal.title}</span>
                    <span className="truncate pr-3 text-[#475569]">
                      {deal.expand?.contact?.name}
                    </span>
                    <span className="truncate pr-3 text-[#64748b]">
                      {deal.expand?.empresa?.name ||
                        deal.expand?.contact?.expand?.empresa?.name ||
                        deal.expand?.contact?.company ||
                        '—'}
                    </span>
                    <span>
                      <TemperatureBadge temperature={deal.temperature} />
                    </span>
                    <span className="font-mono text-[9px] text-[#64748b]">
                      {days === 0 ? 'Hoje' : `${days} dias`}
                    </span>
                    <span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9px] font-medium',
                          isIdleDanger
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                            : isIdleWarning
                              ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold'
                              : 'text-[#64748b]',
                        )}
                        title={
                          deal.status === 'aberto'
                            ? `${daysIdle} dias sem mudar de estágio`
                            : 'Concluído'
                        }
                      >
                        {deal.status === 'aberto' ? `${daysIdle}d` : '—'}
                      </span>
                    </span>
                    <span>
                      <span
                        className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium truncate max-w-[90px]"
                        style={{
                          color: deal.expand?.stage?.color,
                          backgroundColor: `${deal.expand?.stage?.color}16`,
                          border: `1px solid ${deal.expand?.stage?.color}40`,
                        }}
                      >
                        {deal.expand?.stage?.name}
                      </span>
                    </span>
                    <span className="font-mono font-medium text-[#1c1c1e]">
                      {money.format(deal.value)}
                    </span>
                    <span className="font-mono text-[9px] text-[#64748b]">
                      {datePt(deal.expected_close)}
                    </span>
                    <span className="relative">
                      <Status status={deal.status} />
                      <span className="absolute right-0 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 bg-[#f8fafc] pl-1 group-hover:flex">
                        <button
                          title="Enviar e-mail"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEmailDeal(deal)
                          }}
                          className="rounded p-1 text-amber-600 hover:bg-amber-50"
                        >
                          <Mail className="size-3" />
                        </button>
                        <button
                          title="Editar"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(deal)
                            setDialogOpen(true)
                          }}
                          className="rounded p-1 text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1c1c1e]"
                        >
                          <Edit3 className="size-3" />
                        </button>
                        <button
                          title="Ganho"
                          onClick={(e) => {
                            e.stopPropagation()
                            quick(deal, 'ganho')
                          }}
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                        >
                          <CheckCircle2 className="size-3" />
                        </button>
                        <button
                          title="Perdido"
                          onClick={(e) => {
                            e.stopPropagation()
                            quick(deal, 'perdido')
                          }}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                        >
                          <CircleX className="size-3" />
                        </button>
                      </span>
                    </span>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      </div>
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.15)]">
          <span className="mr-2 font-mono text-[10px] text-[#475569]">
            {selected.size} selecionados
          </span>
          <button
            onClick={() => bulk('ganho')}
            className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
          >
            Marcar ganho
          </button>
          <button
            onClick={() => bulk('perdido')}
            className="rounded bg-red-50 border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-700"
          >
            Marcar perdido
          </button>
        </div>
      )}
      <DealDrawer
        deal={detail}
        onClose={() => navigate('/negocios')}
        onEdit={(deal) => {
          setEditing(deal)
          setDialogOpen(true)
        }}
      />
      <DealDialog open={dialogOpen} onOpenChange={setDialogOpen} deal={editing} />
      <EmailComposerModal
        open={Boolean(emailDeal)}
        onClose={() => setEmailDeal(null)}
        deal={emailDeal}
        contact={emailDeal?.expand?.contact}
        onSent={async () => {
          await refresh()
        }}
      />
    </div>
  )
}
function Select({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon: typeof Filter
  value: string
  onChange: (value: string) => void
  options: string[][]
}) {
  return (
    <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2 text-[#64748b] shadow-2xs">
      <Icon className="mr-1.5 size-3" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[10px] text-[#1c1c1e] outline-none"
      >
        {options.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
function Status({ status }: { status: Deal['status'] }) {
  const style =
    status === 'ganho'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : status === 'perdido'
        ? 'bg-red-50 text-red-700 border border-red-200'
        : 'bg-blue-50 text-blue-700 border border-blue-200'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium capitalize ${style}`}>
      {status}
    </span>
  )
}
