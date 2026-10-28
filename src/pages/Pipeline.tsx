import { useEffect, useMemo, useState } from 'react'
import { GripVertical, Mail, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DealDialog } from '@/components/forms/DealDialog'
import { EmailComposerModal } from '@/components/forms/EmailComposerModal'
import { PageSkeleton } from '@/components/PageSkeleton'
import { TemperatureBadge } from '@/components/TemperatureBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { useCrm } from '@/contexts/CrmContext'
import { useToast } from '@/hooks/use-toast'
import { updateDeal } from '@/services/crm'
import { daysSince, getDealDaysIdle, isDealCold, money, type Deal } from '@/types/crm'
import { cn } from '@/lib/utils'

export default function Pipeline() {
  const { stages, deals, activities, loading, refresh } = useCrm()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals)
  const [dragging, setDragging] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presetStage, setPresetStage] = useState<string | undefined>()
  const [emailDeal, setEmailDeal] = useState<Deal | null>(null)
  useEffect(() => setLocalDeals(deals), [deals])
  useEffect(() => {
    const handler = () => {
      setPresetStage(undefined)
      setDialogOpen(true)
    }
    window.addEventListener('crm:new-deal', handler)
    return () => window.removeEventListener('crm:new-deal', handler)
  }, [])
  const active = useMemo(() => localDeals.filter((deal) => deal.status !== 'perdido'), [localDeals])
  if (loading) return <PageSkeleton />
  async function drop(stageId: string) {
    if (!dragging) return
    const deal = localDeals.find((item) => item.id === dragging)
    const stage = stages.find((item) => item.id === stageId)
    if (!deal || !stage || deal.stage === stageId) {
      setDragging(null)
      setOverStage(null)
      return
    }
    const before = localDeals
    const position =
      Math.max(0, ...active.filter((item) => item.stage === stageId).map((item) => item.position)) +
      1
    const nextStatus =
      stage.name === 'Fechamento' ? 'ganho' : deal.status === 'ganho' ? 'aberto' : deal.status
    setLocalDeals((items) =>
      items.map((item) =>
        item.id === deal.id
          ? {
              ...item,
              stage: stageId,
              status: nextStatus,
              position,
              expand: { ...item.expand, stage },
            }
          : item,
      ),
    )
    setDragging(null)
    setOverStage(null)
    try {
      await updateDeal(deal.id, { stage: stageId, status: nextStatus, position })
      toast({
        title: `Negócio movido para ${stage.name}`,
        description: `${deal.code} · ${deal.title}`,
      })
      await refresh()
    } catch {
      setLocalDeals(before)
      toast({ variant: 'destructive', title: 'Não foi possível mover o negócio' })
    }
  }
  const stageTones = [
    {
      bg: 'bg-[#faf2ea]',
      border: 'border-[#ecdcc6]',
      header: 'bg-[#f7ece0]',
      text: 'text-[#693910]',
    },
    {
      bg: 'bg-[#fdf9ee]',
      border: 'border-[#ede0be]',
      header: 'bg-[#faf1d9]',
      text: 'text-[#714705]',
    },
    {
      bg: 'bg-[#f5f8fc]',
      border: 'border-[#cde0f7]',
      header: 'bg-[#e7f0fa]',
      text: 'text-[#1d4f8f]',
    },
    {
      bg: 'bg-[#f3f9f6]',
      border: 'border-[#c7e9dc]',
      header: 'bg-[#e2f3ec]',
      text: 'text-[#126343]',
    },
    {
      bg: 'bg-[#f8f5fc]',
      border: 'border-[#dfd3f4]',
      header: 'bg-[#efe9fa]',
      text: 'text-[#5b299e]',
    },
    {
      bg: 'bg-[#f7efe8]',
      border: 'border-[#e4d0c1]',
      header: 'bg-[#f1e0d2]',
      text: 'text-[#5c3821]',
    },
  ]

  return (
    <div className="flex h-full flex-col bg-[#f4ece1]">
      <div className="shrink-0 px-4 pb-3 pt-4 sm:px-5 border-b border-[#ded2c3] bg-[#fbf9f5] shadow-2xs">
        <div className="flex items-end">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
              Fluxo comercial · Cafés Especiais
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#2b1c13]">
              Pipeline de Oportunidades
            </h1>
            <p className="mt-1 text-xs text-[#705e4d]">
              Arraste os negócios entre as etapas demarcadas.
            </p>
          </div>
          <div className="flex-1" />
          <span
            data-tour-id="pipeline-header-stats"
            className="font-mono text-[9px] text-[#5c4735] bg-[#f3ece0] border border-[#d6c7b6] px-2.5 py-1 rounded font-bold"
          >
            {active.length} ATIVOS · {money.format(active.reduce((sum, d) => sum + d.value, 0))}
          </span>
        </div>
      </div>
      <div
        data-tour-id="pipeline-kanban-board"
        className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3.5 sm:p-5 bg-[#ede4d8]"
      >
        <div className="flex h-full min-w-max snap-x gap-3.5">
          {stages.map((stage, idx) => {
            const items = active
              .filter((deal) => deal.stage === stage.id)
              .sort((a, b) => a.position - b.position)
            const total = items.reduce((sum, item) => sum + item.value, 0)
            const tone = stageTones[idx % stageTones.length]
            return (
              <section
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverStage(stage.id)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null)
                }}
                onDrop={() => drop(stage.id)}
                className={cn(
                  'flex w-[305px] snap-start flex-col rounded-lg border shadow-xs transition-colors',
                  tone.bg,
                  tone.border,
                  overStage === stage.id ? 'ring-2 ring-amber-500 shadow-md' : '',
                )}
              >
                <header
                  className={cn('shrink-0 border-b p-3 rounded-t-lg', tone.header, tone.border)}
                >
                  {' '}
                  <div className="flex items-center">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h2 className="ml-2 text-[11px] font-bold text-[#1c1c1e]">{stage.name}</h2>
                    <span className="ml-1.5 rounded bg-[#f1f5f9] px-1.5 font-mono text-[9px] font-medium text-[#475569]">
                      {items.length}
                    </span>
                    <span className="ml-auto font-mono text-[9px] font-semibold text-[#64748b]">
                      {money.format(total)}
                    </span>
                  </div>
                </header>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 bg-black/[0.015]">
                  {items.map((deal, dealIdx) => {
                    const cold = isDealCold(deal, 5)
                    const days = daysSince(deal.last_contact_at || deal.created)
                    const daysIdle = getDealDaysIdle(deal, activities)
                    const isStalled = daysIdle >= 14
                    const isWarning = daysIdle >= 7

                    return (
                      <article
                        key={deal.id}
                        {...(dealIdx === 0 ? { 'data-tour-id': 'pipeline-deal-card' } : {})}
                        draggable
                        onClick={() => navigate(`/negocios?deal=${deal.id}`)}
                        onDragStart={(e) => {
                          setDragging(deal.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setDragging(null)
                          setOverStage(null)
                        }}
                        className={cn(
                          'group cursor-grab rounded-md border bg-white p-3 shadow-2xs transition hover:border-[#bda895] hover:shadow-xs active:cursor-grabbing border-[#ded2c3]',
                          isStalled
                            ? 'border-amber-300 bg-amber-50/30'
                            : cold
                              ? 'border-blue-200 bg-blue-50/20'
                              : '',
                          dragging === deal.id && 'animate-drag-lift opacity-55',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-[#94a3b8]">{deal.code}</span>
                          <div className="flex items-center gap-1.5">
                            {/* Indicador de dias parado quando >= 7 dias */}
                            {isWarning && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold border',
                                  isStalled
                                    ? 'border-amber-300 bg-amber-100 text-amber-900'
                                    : 'border-amber-200 bg-amber-50 text-amber-800',
                                )}
                                title={`Sem mudar de estágio há ${daysIdle} dias`}
                              >
                                {daysIdle}d parado
                              </span>
                            )}
                            <TemperatureBadge temperature={deal.temperature} />
                            <GripVertical className="size-3 opacity-0 text-[#94a3b8] group-hover:opacity-100" />
                          </div>
                        </div>
                        <h3 className="mt-2 line-clamp-2 text-[12px] font-semibold leading-[1.45] text-[#1c1c1e]">
                          {deal.title}
                        </h3>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-[#64748b]">
                          <span className="truncate pr-1">
                            {deal.expand?.contact?.name} · {deal.expand?.contact?.company}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 font-mono text-[9px]',
                              cold ? 'text-blue-700 font-semibold' : 'text-[#94a3b8]',
                            )}
                            title="Dias desde o último contato"
                          >
                            {days === 0 ? 'contato hoje' : `${days}d sem contato`}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center border-t border-[#f1f5f9] pt-2.5">
                          <span className="font-mono text-[11px] font-semibold text-[#1c1c1e]">
                            {money.format(deal.value)}
                          </span>
                          <div className="flex-1" />
                          <button
                            type="button"
                            title="Enviar e-mail de follow-up"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEmailDeal(deal)
                            }}
                            className="mr-1.5 opacity-0 group-hover:opacity-100 rounded p-1 text-[#64748b] hover:bg-[#f1f5f9] hover:text-amber-600 transition"
                          >
                            <Mail className="size-3.5" />
                          </button>
                          <UserAvatar user={deal.expand?.owner} className="size-5" />
                        </div>
                      </article>
                    )
                  })}
                  <button
                    data-tour-id="pipeline-new-deal-btn"
                    onClick={() => {
                      setPresetStage(stage.id)
                      setDialogOpen(true)
                    }}
                    className="flex h-8 w-full items-center gap-1.5 rounded-md border border-dashed border-[#cbd5e1] bg-white/70 px-2 text-[10px] text-[#64748b] transition hover:border-[#94a3b8] hover:bg-white hover:text-[#1c1c1e]"
                  >
                    <Plus className="size-3.5" /> Novo negócio
                  </button>
                </div>
              </section>
            )
          })}
        </div>
      </div>
      <DealDialog open={dialogOpen} onOpenChange={setDialogOpen} presetStage={presetStage} />
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
