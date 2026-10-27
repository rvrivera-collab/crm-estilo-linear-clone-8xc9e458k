import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Award,
  Bell,
  Cake,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Copy,
  ExternalLink,
  History,
  LoaderCircle,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import {
  datePt,
  getBirthdayInfo,
  getDaysSinceLastPurchase,
  getLoyaltyLevel,
  money,
  type Contact,
} from '@/types/crm'
import { applyBirthdayCouponToContact, markReengagementTreated } from '@/services/crm'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Reminders() {
  const { contacts, loading, refresh } = useCrm()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'todos' | 'aniversarios' | 'recorrencia'>('todos')
  const [busyContactId, setBusyContactId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // 1. Filtrar aniversariantes (hoje e próximos 7 dias)
  const birthdayReminders = useMemo(() => {
    return contacts
      .map((c) => {
        const bday = getBirthdayInfo(c.birthday)
        return {
          contact: c,
          bday,
          loyalty: getLoyaltyLevel(c.purchase_count || 0),
        }
      })
      .filter((item) => item.bday.isNext7Days)
      .sort((a, b) => (a.bday.daysUntil ?? 999) - (b.bday.daysUntil ?? 999))
  }, [contacts])

  // 2. Filtrar clientes com 30 dias ou mais desde a última compra (recorrência)
  const reengagementReminders = useMemo(() => {
    return contacts
      .map((c) => {
        const daysSince = getDaysSinceLastPurchase(c.last_purchase_date)
        return {
          contact: c,
          daysSince,
          loyalty: getLoyaltyLevel(c.purchase_count || 0),
        }
      })
      .filter((item) => item.daysSince !== null && item.daysSince >= 30)
      .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0))
  }, [contacts])

  // Aniversariantes de hoje para destaque
  const birthdaysToday = useMemo(() => {
    return birthdayReminders.filter((r) => r.bday.isToday)
  }, [birthdayReminders])

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast({
      title: 'Cupom copiado!',
      description: `Código ${code} copiado para a área de transferência.`,
    })
    setTimeout(() => setCopiedCode(null), 3000)
  }

  const handleGenerateCoupon = async (contact: Contact) => {
    setBusyContactId(contact.id)
    try {
      const { couponCode } = await applyBirthdayCouponToContact(contact.id, 15)
      await refresh()
      toast({
        title: '🎉 Cupom gerado com sucesso!',
        description: `Código ${couponCode} (15% OFF) gerado e registrado para ${contact.name}.`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar cupom',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setBusyContactId(null)
    }
  }

  const handleMarkReengaged = async (contact: Contact) => {
    setBusyContactId(contact.id)
    try {
      await markReengagementTreated(contact.id)
      await refresh()
      toast({
        title: '☕ Contato marcado como tratado!',
        description: `Retomada de ${contact.name} registrada com a data de hoje.`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar contato',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setBusyContactId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 border-b border-[#e5e7eb] px-4 pb-4 pt-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-600">
                Atendimento Ativo · Cafés Especiais
              </span>
              {birthdaysToday.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 animate-pulse">
                  <Cake className="size-3" /> {birthdaysToday.length} aniversariante(s) hoje!
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-.035em] text-[#1c1c1e]">
              Lembretes & Recorrência
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Acompanhe aniversariantes para presentear com cupom de desconto e reative clientes sem
              compras há mais de 30 dias.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              title="Recarregar lembretes"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] shadow-2xs hover:bg-[#f8fafc] transition"
            >
              <RefreshCw className="size-3.5" /> Atualizar
            </button>
            <button
              onClick={() => navigate('/contatos')}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-600 transition"
            >
              <Coffee className="size-3.5" /> Ver Clientes
            </button>
          </div>
        </div>

        {/* CARDS RESUMO */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-900 uppercase tracking-wider">
                Aniversários Hoje
              </span>
              <Cake className="size-4 text-rose-600" />
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-rose-950">
              {birthdaysToday.length}
            </p>
            <p className="text-[10px] text-rose-800 mt-0.5">
              Envie um cupom e parabenize o cliente
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                Próximos 7 Dias
              </span>
              <Calendar className="size-4 text-amber-600" />
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-amber-950">
              {birthdayReminders.length}
            </p>
            <p className="text-[10px] text-amber-800 mt-0.5">
              Aniversários para antecipar ações de fidelização
            </p>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-orange-900 uppercase tracking-wider">
                Recorrência (30+ Dias)
              </span>
              <History className="size-4 text-orange-600" />
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-orange-950">
              {reengagementReminders.length}
            </p>
            <p className="text-[10px] text-orange-800 mt-0.5">
              Clientes prontos para recompra de grãos frescos
            </p>
          </div>
        </div>

        {/* Abas e Busca */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 border-b border-[#e5e7eb] pb-1">
            <button
              onClick={() => setActiveTab('todos')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                activeTab === 'todos'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e]',
              )}
            >
              Todos ({birthdayReminders.length + reengagementReminders.length})
            </button>
            <button
              onClick={() => setActiveTab('aniversarios')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition inline-flex items-center gap-1.5',
                activeTab === 'aniversarios'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50',
              )}
            >
              <Cake className="size-3.5" />
              Aniversariantes ({birthdayReminders.length})
            </button>
            <button
              onClick={() => setActiveTab('recorrencia')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition inline-flex items-center gap-1.5',
                activeTab === 'recorrencia'
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'text-orange-700 hover:bg-orange-50',
              )}
            >
              <History className="size-3.5" />
              Recorrência 30+ dias ({reengagementReminders.length})
            </button>
          </div>

          <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs sm:max-w-xs">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome ou e-mail..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
            />
          </label>
        </div>
      </div>

      {/* Conteúdo dos Lembretes */}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* SEÇÃO 1: ANIVERSARIANTES */}
        {(activeTab === 'todos' || activeTab === 'aniversarios') && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-2">
              <div className="flex items-center gap-2">
                <Cake className="size-4 text-rose-600" />
                <h2 className="text-sm font-bold text-[#1c1c1e]">
                  Aniversariantes (Hoje e Próximos 7 Dias)
                </h2>
              </div>
              <span className="font-mono text-xs text-[#64748b]">
                {birthdayReminders.length} lembrete(s)
              </span>
            </div>

            {birthdayReminders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#cbd5e1] p-6 text-center text-xs text-[#94a3b8]">
                Nenhum aniversário nos próximos 7 dias. Adicione a data de aniversário dos clientes
                para gerar lembretes automáticos.
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {birthdayReminders
                  .filter((r) =>
                    `${r.contact.name} ${r.contact.email} ${r.contact.favorite_coffee || ''}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map(({ contact, bday, loyalty }) => {
                    const isBusy = busyContactId === contact.id
                    const hasCoupon = Boolean(contact.last_coupon_code)

                    return (
                      <div
                        key={contact.id}
                        className={cn(
                          'rounded-lg border p-4 shadow-2xs transition hover:border-[#cbd5e1] flex flex-col justify-between',
                          bday.isToday
                            ? 'border-rose-300 bg-rose-50/50'
                            : 'border-[#e2e8f0] bg-white',
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <button
                                type="button"
                                onClick={() => navigate(`/contatos?contact=${contact.id}`)}
                                className="text-left font-bold text-[#1c1c1e] hover:text-amber-600 transition truncate block text-sm"
                              >
                                {contact.name}
                              </button>
                              <p className="text-[11px] text-[#64748b]">
                                {contact.phone || contact.email || 'Sem contato cadastrado'}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                                loyalty.badgeColor,
                              )}
                            >
                              Nv.{loyalty.level} {loyalty.name}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 font-bold text-xs rounded px-2 py-0.5',
                                bday.isToday
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-900',
                              )}
                            >
                              <Cake className="size-3 text-rose-600" />
                              {bday.isToday
                                ? '🎉 É HOJE!'
                                : `Em ${bday.daysUntil} dias (${bday.formattedDate})`}
                            </span>
                          </div>

                          {contact.favorite_coffee && (
                            <p className="mt-2 text-[11px] text-amber-900 flex items-center gap-1">
                              <Coffee className="size-3 text-amber-700 shrink-0" />
                              <span className="truncate">Gosta de: {contact.favorite_coffee}</span>
                            </p>
                          )}

                          {/* Seção do cupom */}
                          {hasCoupon && (
                            <div className="mt-3 rounded border border-rose-200 bg-white p-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-rose-700">
                                  Cupom Atribuído
                                </span>
                                <span className="text-[9px] text-[#94a3b8]">
                                  {datePt(contact.last_coupon_date || '')}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2 font-mono text-xs font-bold text-[#1c1c1e]">
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-900">
                                  {contact.last_coupon_code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyCoupon(contact.last_coupon_code || '')}
                                  className="inline-flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-900"
                                  title="Copiar código do cupom"
                                >
                                  {copiedCode === contact.last_coupon_code ? (
                                    <CheckCircle2 className="size-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                  <span>
                                    {copiedCode === contact.last_coupon_code
                                      ? 'Copiado!'
                                      : 'Copiar'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Ações do Lembrete */}
                        <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/contatos?contact=${contact.id}`)}
                            className="text-[11px] font-semibold text-[#64748b] hover:text-[#1c1c1e]"
                          >
                            Ver cliente
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleGenerateCoupon(contact)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs transition disabled:opacity-60',
                              hasCoupon
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-rose-600 hover:bg-rose-700',
                            )}
                          >
                            {isBusy ? (
                              <LoaderCircle className="size-3 animate-spin" />
                            ) : (
                              <Sparkles className="size-3" />
                            )}
                            {hasCoupon ? 'Regerar Cupom' : 'Presentear com Cupom'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </section>
        )}

        {/* SEÇÃO 2: RECORRÊNCIA E RETOMADA (30+ DIAS SEM COMPRA) */}
        {(activeTab === 'todos' || activeTab === 'recorrencia') && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-2">
              <div className="flex items-center gap-2">
                <History className="size-4 text-orange-600" />
                <h2 className="text-sm font-bold text-[#1c1c1e]">
                  Clientes para Retomar Contato (30+ dias sem comprar)
                </h2>
              </div>
              <span className="font-mono text-xs text-[#64748b]">
                {reengagementReminders.length} cliente(s)
              </span>
            </div>

            {reengagementReminders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#cbd5e1] p-6 text-center text-xs text-[#94a3b8]">
                Todos os clientes compraram nos últimos 30 dias! A taxa de retenção da cafeteria
                está excelente.
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {reengagementReminders
                  .filter((r) =>
                    `${r.contact.name} ${r.contact.email} ${r.contact.favorite_coffee || ''}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map(({ contact, daysSince, loyalty }) => {
                    const isBusy = busyContactId === contact.id
                    const isTreatedRecently =
                      contact.last_reengagement_date &&
                      new Date(contact.last_reengagement_date).getTime() >
                        Date.now() - 7 * 24 * 60 * 60 * 1000

                    return (
                      <div
                        key={contact.id}
                        className={cn(
                          'rounded-lg border p-4 shadow-2xs transition hover:border-[#cbd5e1] flex flex-col justify-between',
                          isTreatedRecently
                            ? 'border-emerald-300 bg-emerald-50/20'
                            : 'border-orange-200 bg-orange-50/30',
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <button
                                type="button"
                                onClick={() => navigate(`/contatos?contact=${contact.id}`)}
                                className="text-left font-bold text-[#1c1c1e] hover:text-amber-600 transition truncate block text-sm"
                              >
                                {contact.name}
                              </button>
                              <p className="text-[11px] text-[#64748b]">
                                {contact.phone || contact.email || 'Sem contato'}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                                loyalty.badgeColor,
                              )}
                            >
                              Nv.{loyalty.level} {loyalty.name}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-orange-950 rounded bg-orange-100 px-2 py-0.5">
                              <Clock className="size-3 text-orange-700" />
                              {daysSince} dias sem comprar
                            </span>
                            <span className="font-mono text-[10px] text-[#64748b]">
                              Última: {datePt(contact.last_purchase_date || '')}
                            </span>
                          </div>

                          {contact.favorite_coffee && (
                            <p className="mt-2 text-[11px] text-amber-900 flex items-center gap-1">
                              <Coffee className="size-3 text-amber-700 shrink-0" />
                              <span className="truncate">
                                Preferência: {contact.favorite_coffee}
                              </span>
                            </p>
                          )}

                          <div className="mt-2 font-mono text-[10px] text-[#64748b]">
                            Acumulado: {contact.purchase_count || 0} compras (
                            {money.format(contact.total_spent || 0)})
                          </div>

                          {contact.last_reengagement_date && (
                            <div className="mt-2 text-[10px] text-emerald-800 bg-emerald-100/60 rounded px-2 py-0.5 inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3 text-emerald-700" />
                              Retomada tratada em {datePt(contact.last_reengagement_date)}
                            </div>
                          )}
                        </div>

                        {/* Ações do Lembrete */}
                        <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/contatos?contact=${contact.id}`)}
                            className="text-[11px] font-semibold text-[#64748b] hover:text-[#1c1c1e]"
                          >
                            Ver histórico
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleMarkReengaged(contact)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs transition disabled:opacity-60',
                              isTreatedRecently
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-orange-600 hover:bg-orange-700',
                            )}
                          >
                            {isBusy ? (
                              <LoaderCircle className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            {isTreatedRecently ? 'Marcar Novamente' : 'Marcar como Tratado'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
