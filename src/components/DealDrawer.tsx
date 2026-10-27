import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Flame,
  Lightbulb,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  Sparkles,
  StickyNote,
  Video,
  X,
  LoaderCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/contexts/CrmContext'
import { createActivity, leadAiAction, updateDeal } from '@/services/crm'
import { daysSince, datePt, money, relativeTime, type Activity, type Deal } from '@/types/crm'
import { UserAvatar } from '@/components/UserAvatar'
import { TemperatureBadge } from '@/components/TemperatureBadge'
import { EmailComposerModal } from '@/components/forms/EmailComposerModal'
import { useToast } from '@/hooks/use-toast'

const activityIcons: Record<Activity['type'], typeof Clock3> = {
  nota: MessageSquareText,
  email: Mail,
  ligacao: Phone,
  reuniao: Video,
  sistema: Clock3,
}

export function DealDrawer({
  deal,
  onClose,
  onEdit,
}: {
  deal: Deal | null
  onClose: () => void
  onEdit: (deal: Deal) => void
}) {
  const { activities, stages, empresas, refresh } = useCrm()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [type, setType] = useState<'nota' | 'ligacao' | 'reuniao'>('nota')
  const [busy, setBusy] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)

  const relatedEmpresa = useMemo(() => {
    if (!deal) return null
    if (deal.empresa) {
      return empresas.find((e) => e.id === deal.empresa) || deal.expand?.empresa || null
    }
    if (deal.expand?.contact?.empresa) {
      return (
        empresas.find((e) => e.id === deal.expand?.contact?.empresa) ||
        deal.expand?.contact?.expand?.empresa ||
        null
      )
    }
    if (deal.expand?.contact?.company) {
      return (
        empresas.find(
          (e) => e.name.toLowerCase() === deal.expand?.contact?.company.toLowerCase(),
        ) || null
      )
    }
    return null
  }, [deal, empresas])

  // AI states
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiNextStep, setAiNextStep] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState<string | null>(null)

  const timeline = useMemo(
    () => activities.filter((item) => item.deal === deal?.id),
    [activities, deal],
  )

  useEffect(() => {
    setNote('')
    setAiSummary(null)
    setAiNextStep(null)
    setLoadingAi(null)
  }, [deal?.id])

  if (!deal) return null

  const daysNoContact = daysSince(deal.last_contact_at || deal.created)

  async function handleAiSummary() {
    setLoadingAi('summary')
    try {
      const res = await leadAiAction({ dealId: deal.id, action: 'summary' })
      if (res.summary) setAiSummary(res.summary)
      toast({ title: 'Resumo do lead gerado pela IA' })
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao gerar resumo do lead' })
    } finally {
      setLoadingAi(null)
    }
  }

  async function handleAiNextStep() {
    setLoadingAi('next_step')
    try {
      const res = await leadAiAction({ dealId: deal.id, action: 'next_step' })
      if (res.nextStep) setAiNextStep(res.nextStep)
      toast({ title: 'Próximo passo sugerido pela IA' })
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao sugerir próximo passo' })
    } finally {
      setLoadingAi(null)
    }
  }

  async function handleAiClassifyTemp() {
    setLoadingAi('temp')
    try {
      const res = await leadAiAction({ dealId: deal.id, action: 'classify_temperature' })
      toast({
        title: `Temperatura classificada: ${res.temperature?.toUpperCase()}`,
        description: res.justification,
      })
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao classificar temperatura' })
    } finally {
      setLoadingAi(null)
    }
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setBusy(true)
    try {
      await createActivity({
        type,
        content: note.trim(),
        deal: deal.id,
        contact: deal.contact,
        author: user?.id,
      })
      // Update last_contact_at
      await updateDeal(deal.id, { last_contact_at: new Date().toISOString() })
      setNote('')
      await refresh()
      toast({ title: 'Atividade registrada' })
    } finally {
      setBusy(false)
    }
  }

  async function mark(status: 'ganho' | 'perdido') {
    await updateDeal(deal.id, { status })
    await refresh()
    toast({ title: `Negócio marcado como ${status}` })
  }

  return (
    <>
      <button
        aria-label="Fechar detalhes"
        className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[480px] animate-drawer-in flex-col border-l border-[#e5e7eb] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.1)]">
        <header className="flex h-12 items-center border-b border-[#e5e7eb] px-4 bg-[#f8fafc]">
          <span className="font-mono text-[11px] font-semibold text-[#64748b]">{deal.code}</span>
          <div className="flex-1" />
          <button
            onClick={() => onEdit(deal)}
            className="mr-1 rounded px-2 py-1 text-[10px] font-medium text-[#475569] hover:bg-[#e2e8f0] hover:text-[#1c1c1e]"
          >
            Editar
          </button>
          <button onClick={onClose} className="rounded p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Main Deal Header */}
          <section className="border-b border-[#e5e7eb] p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e]">
                {deal.title}
              </h2>
              <TemperatureBadge temperature={deal.temperature} />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/contatos?contact=${deal.contact}`)}
                  className="text-xs font-semibold text-[#1c1c1e] hover:text-amber-600 truncate"
                >
                  {deal.expand?.contact?.name}
                </button>
                {relatedEmpresa && (
                  <button
                    type="button"
                    onClick={() => navigate(`/empresas?empresa=${relatedEmpresa.id}`)}
                    className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200 hover:bg-amber-100 transition"
                  >
                    <Building2 className="size-3 text-amber-600" />
                    <span>{relatedEmpresa.name}</span>
                    <ExternalLink className="size-2 text-amber-600" />
                  </button>
                )}
              </div>
              <span className="font-mono text-[10px] text-[#94a3b8]">
                {daysNoContact === 0 ? 'Contato hoje' : `Sem contato há ${daysNoContact}d`}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Info icon={CircleDollarSign} label="Valor" value={money.format(deal.value)} />
              <Info icon={Calendar} label="Fechamento" value={datePt(deal.expected_close)} />
              <Info
                icon={Clock3}
                label="Estágio"
                value={
                  deal.expand?.stage?.name || stages.find((s) => s.id === deal.stage)?.name || '—'
                }
              />
              <Info icon={CheckCircle2} label="Status" value={deal.status} />
              {deal.expand?.campaign && (
                <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50/50 p-2.5">
                  <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-amber-700 font-bold">
                    <span>Campanha de Origem</span>
                  </div>
                  <p className="mt-1 font-semibold text-[11px] text-[#1c1c1e]">
                    {deal.expand.campaign.name}
                  </p>
                </div>
              )}
            </div>

            {/* Dados do Lead & Campos Personalizados */}
            {deal.expand?.contact && (
              <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs">
                <p className="font-bold text-[#1c1c1e] text-[11px] mb-2">Dados do Lead</p>
                <div className="space-y-1.5 text-[11px] text-[#475569]">
                  {deal.expand.contact.email && (
                    <p className="flex items-center justify-between">
                      <span className="text-[#94a3b8]">E-mail:</span>
                      <span className="font-medium text-[#1c1c1e]">
                        {deal.expand.contact.email}
                      </span>
                    </p>
                  )}
                  {deal.expand.contact.phone && (
                    <p className="flex items-center justify-between">
                      <span className="text-[#94a3b8]">Telefone:</span>
                      <span className="font-medium text-[#1c1c1e]">
                        {deal.expand.contact.phone}
                      </span>
                    </p>
                  )}
                  {deal.expand.contact.position && (
                    <p className="flex items-center justify-between">
                      <span className="text-[#94a3b8]">Cargo:</span>
                      <span className="font-medium text-[#1c1c1e]">
                        {deal.expand.contact.position}
                      </span>
                    </p>
                  )}
                  {deal.expand.contact.custom_fields &&
                    Object.entries(deal.expand.contact.custom_fields).length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-[#e2e8f0] space-y-1.5">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          Campos personalizados do formulário
                        </span>
                        {Object.entries(deal.expand.contact.custom_fields).map(([key, value]) => {
                          let displayVal = String(value)
                          if (typeof value === 'boolean') displayVal = value ? 'Sim' : 'Não'
                          return (
                            <div key={key} className="flex items-start justify-between gap-2">
                              <span className="text-[#64748b] text-[10px]">{key}:</span>
                              <span className="font-semibold text-[#1c1c1e] text-[11px] text-right break-words max-w-[200px]">
                                {displayVal}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Quick Actions (Email & Status) */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setEmailModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-amber-600 transition"
              >
                <Send className="size-3.5" /> Enviar e-mail
              </button>

              <button
                onClick={() => mark('ganho')}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
              >
                Marcar ganho
              </button>
              <button
                onClick={() => mark('perdido')}
                className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-100"
              >
                Marcar perdido
              </button>
            </div>
          </section>

          {/* AI Actions Section */}
          <section className="border-b border-[#e5e7eb] p-5 bg-amber-50/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1c1c1e]">
                <Sparkles className="size-3.5 text-amber-600" />
                <span>Inteligência do Lead</span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-amber-700 font-bold">
                Ask CRM Copilot
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={handleAiSummary}
                disabled={loadingAi !== null}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-[#1c1c1e] hover:bg-amber-50 disabled:opacity-50 transition"
              >
                {loadingAi === 'summary' ? (
                  <LoaderCircle className="size-3 animate-spin text-amber-600" />
                ) : (
                  <Sparkles className="size-3 text-amber-600" />
                )}
                Resumir lead
              </button>

              <button
                onClick={handleAiNextStep}
                disabled={loadingAi !== null}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-[#1c1c1e] hover:bg-amber-50 disabled:opacity-50 transition"
              >
                {loadingAi === 'next_step' ? (
                  <LoaderCircle className="size-3 animate-spin text-amber-600" />
                ) : (
                  <Lightbulb className="size-3 text-amber-600" />
                )}
                Sugerir próximo passo
              </button>

              <button
                onClick={handleAiClassifyTemp}
                disabled={loadingAi !== null}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-[#1c1c1e] hover:bg-amber-50 disabled:opacity-50 transition"
              >
                {loadingAi === 'temp' ? (
                  <LoaderCircle className="size-3 animate-spin text-amber-600" />
                ) : (
                  <Flame className="size-3 text-amber-600" />
                )}
                Classificar temperatura
              </button>
            </div>

            {aiSummary && (
              <div className="mt-2.5 rounded-md border border-amber-200 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                  Resumo executivo do lead:
                </p>
                <p className="text-xs leading-relaxed text-[#334155]">{aiSummary}</p>
              </div>
            )}

            {aiNextStep && (
              <div className="mt-2.5 rounded-md border border-emerald-200 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                  Próxima ação recomendada:
                </p>
                <p className="text-xs leading-relaxed text-[#334155]">{aiNextStep}</p>
              </div>
            )}
          </section>

          {/* Timeline and Notes */}
          <section className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[#1c1c1e]">Timeline de Interações</h3>
              <div className="flex items-center gap-1.5">
                <UserAvatar user={deal.expand?.owner} className="size-4" />
                <span className="text-[10px] text-[#64748b]">{deal.expand?.owner?.name}</span>
              </div>
            </div>

            <form
              onSubmit={addActivity}
              className="mb-6 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2"
            >
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Registrar uma nota ou interação…"
                className="w-full resize-none bg-transparent p-1 text-xs text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
              />
              <div className="flex items-center gap-2 border-t border-[#e2e8f0] pt-2">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="bg-transparent text-[10px] text-[#475569] outline-none"
                >
                  <option value="nota">Nota rápida</option>
                  <option value="ligacao">Ligação</option>
                  <option value="reuniao">Reunião</option>
                </select>
                <div className="flex-1" />
                <button
                  disabled={busy || !note.trim()}
                  className="rounded bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-40"
                >
                  Registrar
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {timeline.map((activity) => {
                const Icon = activityIcons[activity.type] || MessageSquareText
                const isEmail = activity.type === 'email'
                return (
                  <div
                    key={activity.id}
                    className="relative flex gap-3 before:absolute before:bottom-[-18px] before:left-[13px] before:top-7 before:w-px before:bg-[#e2e8f0] last:before:hidden"
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border ${
                        isEmail
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]'
                      }`}
                    >
                      <Icon className="size-3" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <div className="text-[11px] leading-5 text-[#334155] whitespace-pre-wrap">
                        {activity.content}
                      </div>
                      <p className="mt-1 text-[9px] text-[#94a3b8]">
                        {activity.expand?.author?.name || 'Sistema'} ·{' '}
                        {relativeTime(activity.created)}
                      </p>
                    </div>
                  </div>
                )
              })}
              {!timeline.length && (
                <p className="text-xs text-[#94a3b8]">Nenhuma atividade registrada.</p>
              )}
            </div>
          </section>
        </div>
      </aside>

      <EmailComposerModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        deal={deal}
        contact={deal.expand?.contact}
        onSent={async () => {
          await refresh()
        }}
      />
    </>
  )
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e5e7eb] bg-[#f8fafc] p-2.5">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-[#64748b]">
        <Icon className="size-3" />
        {label}
      </div>
      <p className="mt-1.5 truncate font-mono text-[11px] font-semibold capitalize text-[#1c1c1e]">
        {value}
      </p>
    </div>
  )
}
