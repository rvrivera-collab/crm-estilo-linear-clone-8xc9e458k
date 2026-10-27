import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  Cake,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  ExternalLink,
  Flame,
  HeartHandshake,
  History,
  Info,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Package,
  Phone,
  Plus,
  Send,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Ticket,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import {
  datePt,
  getBirthdayInfo,
  getCustomerJourneyStage,
  getDaysSinceLastPurchase,
  getLoyaltyLevel,
  money,
  relativeTime,
  type Activity,
  type Contact,
  type JourneyEvent,
  type Order,
  type Purchase,
} from '@/types/crm'
import {
  applyBirthdayCouponToContact,
  createJourneyEvent,
  deletePurchase,
  listJourneyEvents,
  listOrders,
  listPurchases,
  markReengagementTreated,
  registerPurchase,
  ORDER_STAGE_LABELS,
} from '@/services/crm'
import { EmailComposerModal } from '@/components/forms/EmailComposerModal'
import { SendWhatsAppModal } from '@/components/SendWhatsAppModal'
import { OrderDialog } from '@/components/forms/OrderDialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function ContactDrawer({
  contact,
  onClose,
  onEdit,
}: {
  contact: Contact | null
  onClose: () => void
  onEdit: (contact: Contact) => void
}) {
  const { activities, empresas, refresh } = useCrm()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [emailModalOpen, setEmailModalOpen] = useState(false)

  // Modal WhatsApp
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)
  const [whatsAppMoment, setWhatsAppMoment] = useState<
    'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  >('personalizado')

  // Linha do tempo de jornada oficial
  const [journeyEvents, setJourneyEvents] = useState<JourneyEvent[]>([])
  const [loadingJourney, setLoadingJourney] = useState(false)

  // Pedidos e Compras do cliente
  const [clientOrders, setClientOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)

  // Compras do cliente
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false)
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchaseItems, setPurchaseItems] = useState('')
  const [purchaseNotes, setPurchaseNotes] = useState('')
  const [savingPurchase, setSavingPurchase] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  // Carregar compras e linha do tempo de jornada do contato
  useEffect(() => {
    if (!contact?.id) {
      setPurchases([])
      setClientOrders([])
      setJourneyEvents([])
      return
    }
    let active = true
    setLoadingPurchases(true)
    setLoadingOrders(true)
    setLoadingJourney(true)

    Promise.all([
      listPurchases(contact.id).catch(() => []),
      listOrders(contact.id).catch(() => []),
      listJourneyEvents(contact.id).catch(() => []),
    ])
      .then(([purchasesData, ordersData, journeyData]) => {
        if (active) {
          setPurchases(purchasesData)
          setClientOrders(ordersData)
          setJourneyEvents(journeyData)
        }
      })
      .finally(() => {
        if (active) {
          setLoadingPurchases(false)
          setLoadingOrders(false)
          setLoadingJourney(false)
        }
      })

    return () => {
      active = false
    }
  }, [contact?.id])

  const loyalty = useMemo(() => {
    return getLoyaltyLevel(contact?.purchase_count || 0)
  }, [contact?.purchase_count])

  const stageInfo = useMemo(() => {
    return contact ? getCustomerJourneyStage(contact) : null
  }, [contact])

  const bdayInfo = useMemo(() => {
    return getBirthdayInfo(contact?.birthday)
  }, [contact?.birthday])

  const daysSincePurchase = useMemo(() => {
    return getDaysSinceLastPurchase(contact?.last_purchase_date)
  }, [contact?.last_purchase_date])

  const relatedEmpresa = useMemo(() => {
    if (!contact) return null
    if (contact.empresa) {
      return empresas.find((e) => e.id === contact.empresa) || contact.expand?.empresa || null
    }
    if (contact.company) {
      return empresas.find((e) => e.name.toLowerCase() === contact.company.toLowerCase()) || null
    }
    return null
  }, [contact, empresas])

  const timeline = useMemo(
    () => activities.filter((item) => item.contact === contact?.id),
    [activities, contact],
  )

  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contact) return
    const numAmount = parseFloat(purchaseAmount.replace(',', '.'))
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Informe um valor de compra válido.',
      })
      return
    }

    setSavingPurchase(true)
    try {
      const res = await registerPurchase({
        contactId: contact.id,
        amount: numAmount,
        purchaseDate: purchaseDate
          ? new Date(purchaseDate).toISOString()
          : new Date().toISOString(),
        itemsDescription: purchaseItems.trim(),
        notes: purchaseNotes.trim(),
      })

      setPurchases((prev) => [res.purchase, ...prev])
      setPurchaseAmount('')
      setPurchaseItems('')
      setPurchaseNotes('')
      setPurchaseDate('')
      setNewPurchaseOpen(false)
      await refresh()

      toast({
        title: 'Compra registrada com sucesso!',
        description: `Adicionado ${money.format(numAmount)} ao cliente. Total de compras: ${res.contact.purchase_count}.`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar compra',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setSavingPurchase(false)
    }
  }

  const handleDeletePurchase = async (purchaseId: string) => {
    if (!contact) return
    try {
      await deletePurchase(purchaseId, contact.id)
      setPurchases((prev) => prev.filter((p) => p.id !== purchaseId))
      await refresh()
      toast({
        title: 'Compra removida',
        description: 'Histórico e contador recalculados.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover compra',
      })
    }
  }

  const handleGenerateBirthdayCoupon = async () => {
    if (!contact) return
    setActionBusy(true)
    try {
      const { couponCode } = await applyBirthdayCouponToContact(contact.id, 15)
      await refresh()
      toast({
        title: 'Cupom de Aniversário gerado!',
        description: `Código ${couponCode} (15% OFF) gerado e registrado no cliente.`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar cupom',
      })
    } finally {
      setActionBusy(false)
    }
  }

  const handleMarkReengagement = async () => {
    if (!contact) return
    setActionBusy(true)
    try {
      await markReengagementTreated(contact.id)
      await refresh()
      toast({
        title: 'Retomada registrada com sucesso!',
        description: 'Contato de retenção marcado como tratado hoje.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar retomada',
      })
    } finally {
      setActionBusy(false)
    }
  }

  if (!contact) return null
  return (
    <>
      <button
        aria-label="Fechar detalhes"
        className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-[70] flex w-full sm:max-w-[440px] animate-drawer-in flex-col border-l border-[#e5e7eb] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.1)]">
        <header className="flex h-12 items-center border-b border-[#e5e7eb] px-4">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[#64748b]">
            Contato
          </span>
          <div className="flex-1" />
          <button
            onClick={() => onEdit(contact)}
            className="mr-1 rounded px-2 py-1 text-[10px] font-medium text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e]"
          >
            Editar
          </button>
          <button onClick={onClose} className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]">
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="border-b border-[#e5e7eb] p-5">
            <div className="grid size-10 place-items-center rounded-full bg-amber-50 border border-amber-200 text-sm font-bold text-amber-700">
              {contact.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="mt-3 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e]">
                  {contact.name}
                </h2>
                {contact.nickname && (
                  <p className="text-xs font-semibold text-amber-700">
                    Prefere ser chamado de: <span className="underline">"{contact.nickname}"</span>
                  </p>
                )}
                <p className="mt-0.5 text-xs text-[#64748b]">
                  {contact.position || 'Cliente'} {contact.company ? `· ${contact.company}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-2xs ${loyalty.badgeColor}`}
                  title={loyalty.description}
                >
                  <Award className="size-3.5" />
                  <span>
                    Nível {loyalty.level}: {loyalty.name}
                  </span>
                </span>
                {stageInfo && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${stageInfo.badgeBg} ${stageInfo.badgeText}`}
                  >
                    <Sparkles className="size-2.5" /> {stageInfo.label}
                  </span>
                )}
              </div>
            </div>

            {/* Informações de contato */}
            <div className="mt-4 space-y-2 text-[11px] text-[#475569]">
              <p className="flex items-center gap-2">
                <Mail className="size-3.5 text-[#94a3b8]" /> {contact.email || 'Sem e-mail'}
              </p>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2">
                  <Phone className="size-3.5 text-[#94a3b8]" /> {contact.phone || 'Sem telefone'}
                </p>
                {contact.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsAppMoment('personalizado')
                      setWhatsAppModalOpen(true)
                    }}
                    className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                  >
                    <MessageCircle className="size-3 text-emerald-600" /> WhatsApp Disney
                  </button>
                )}
              </div>
              {contact.birthday && (
                <p className="flex items-center gap-2">
                  <Cake className="size-3.5 text-rose-500 shrink-0" />
                  <span>
                    Aniversário: <strong>{bdayInfo.formattedDate}</strong>
                    {bdayInfo.isToday && (
                      <span className="ml-2 inline-flex items-center rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700 animate-pulse">
                        É HOJE! 🎉
                      </span>
                    )}
                    {!bdayInfo.isToday && bdayInfo.isNext7Days && (
                      <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                        Em {bdayInfo.daysUntil} dias
                      </span>
                    )}
                  </span>
                </p>
              )}
              {(contact.city || contact.state) && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-[#94a3b8] shrink-0" />
                  <span>{[contact.city, contact.state].filter(Boolean).join(' - ')}</span>
                </p>
              )}
              {contact.address && (
                <p className="flex items-start gap-2 text-[10px] text-[#64748b]">
                  <span className="font-semibold text-[#475569] shrink-0">Envio:</span>
                  <span className="break-words">{contact.address}</span>
                </p>
              )}
              {contact.cpf_cnpj && (
                <p className="flex items-center gap-2 text-[10px] text-[#64748b]">
                  <span className="font-semibold text-[#475569] shrink-0">Doc:</span>
                  <span className="font-mono">{contact.cpf_cnpj}</span>
                </p>
              )}
            </div>

            {/* BOX DISNEY: O QUE FAZ ESSE CLIENTE SE SENTIR ÚNICO */}
            <div className="mt-4 rounded-lg border border-amber-300 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-3.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <Sparkles className="size-3.5 text-amber-600" />
                  <span>Experiência Disney · Atenção aos Detalhes</span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                  Fazer Sentir Único
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-amber-200/60">
                <div>
                  <span className="block text-[9px] uppercase font-bold text-[#64748b]">
                    Café Favorito
                  </span>
                  <p className="font-semibold text-amber-950 truncate">
                    {contact.favorite_coffee || (
                      <span className="text-[#94a3b8] font-normal">Não informado</span>
                    )}
                  </p>
                  {contact.coffee_preference &&
                    contact.coffee_preference !== contact.favorite_coffee && (
                      <p
                        className="text-[10px] text-amber-800/80 truncate mt-0.5"
                        title={contact.coffee_preference}
                      >
                        📋 {contact.coffee_preference}
                      </p>
                    )}
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-[#64748b]">
                    Torra Preferida
                  </span>
                  <p className="font-semibold text-amber-950 truncate">
                    {contact.roast_preference || (
                      <span className="text-[#94a3b8] font-normal">Não informada</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-[#64748b]">
                    Método Preferido
                  </span>
                  <p className="font-semibold text-amber-950 truncate">
                    {contact.brew_method_preference || (
                      <span className="text-[#94a3b8] font-normal">Não informado</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-[#64748b]">
                    Intensidade / Paladar
                  </span>
                  <p className="font-semibold text-amber-950 truncate">
                    {contact.intensity_preference || (
                      <span className="text-[#94a3b8] font-normal">Não informada</span>
                    )}
                  </p>
                </div>
              </div>

              {contact.dietary_restrictions && (
                <div className="rounded bg-rose-50/80 border border-rose-200 p-1.5 text-[10px] text-rose-900 flex items-center gap-1.5">
                  <ShieldAlert className="size-3 text-rose-600 shrink-0" />
                  <span>
                    Alergias / Restrições: <strong>{contact.dietary_restrictions}</strong>
                  </span>
                </div>
              )}

              {contact.special_date && (
                <div className="rounded bg-amber-100/60 border border-amber-200 p-1.5 text-[10px] text-amber-900 flex items-center gap-1.5">
                  <Calendar className="size-3 text-amber-700 shrink-0" />
                  <span>
                    {contact.special_date_description || 'Data Especial'}:{' '}
                    <strong>{datePt(contact.special_date)}</strong>
                  </span>
                </div>
              )}

              {contact.acquisition_channel && (
                <p className="text-[10px] text-[#64748b]">
                  Como conheceu a loja:{' '}
                  <span className="text-[#1c1c1e] font-medium">{contact.acquisition_channel}</span>
                </p>
              )}

              {contact.service_notes && (
                <div className="rounded bg-white/90 border border-amber-200 p-2 text-[10px] text-[#475569] leading-relaxed">
                  <span className="font-bold text-amber-950 block mb-0.5">
                    Observações para o Atendente:
                  </span>
                  {contact.service_notes}
                </div>
              )}
            </div>

            {/* BOX PROGRAMA DE FIDELIDADE */}
            <div className="mt-5 rounded-lg border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-950">
                <div className="flex items-center gap-1.5">
                  <Coffee className="size-3.5 text-amber-700" />
                  <span>Programa de Fidelidade</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-amber-900">
                  {contact.purchase_count || 0} compras
                </span>
              </div>
              <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
                {loyalty.description}
              </p>

              {/* Barra de progresso */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-medium text-amber-900 mb-1">
                  <span>
                    Nível {loyalty.level} ({loyalty.name})
                  </span>
                  <span>
                    {loyalty.level >= 5
                      ? 'Nível Máximo Atingido'
                      : `Faltam ${loyalty.remainingToNext} compras para Nível ${loyalty.level + 1}`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200/70">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-700 transition-all duration-300 rounded-full"
                    style={{ width: `${loyalty.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* BOX DE LEMBRETES E AÇÕES RÁPIDAS (ANIVERSÁRIO E RETENÇÃO COM WHATSAPP DISNEY) */}
            <div className="mt-3 space-y-2">
              {/* Alerta de Aniversário */}
              {(bdayInfo.isToday || bdayInfo.isNext7Days) && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-bold text-rose-900">
                      <Cake className="size-3.5 text-rose-600" />
                      {bdayInfo.isToday
                        ? 'Aniversariante de Hoje!'
                        : `Aniversário em ${bdayInfo.daysUntil} dias`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={handleGenerateBirthdayCoupon}
                        className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-rose-700 transition disabled:opacity-60"
                      >
                        <Sparkles className="size-2.5" />
                        {contact.last_coupon_code ? 'Regerar Cupom' : 'Gerar Cupom'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsAppMoment('aniversario')
                          setWhatsAppModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                      >
                        <MessageCircle className="size-2.5" />
                        Enviar WhatsApp
                      </button>
                    </div>
                  </div>
                  {contact.last_coupon_code && (
                    <div className="mt-2 flex items-center justify-between border-t border-rose-200/60 pt-2 text-[11px] text-rose-950 font-mono">
                      <span>
                        Último cupom: <strong>{contact.last_coupon_code}</strong>
                      </span>
                      <span className="text-[10px] text-rose-800">
                        ({datePt(contact.last_coupon_date || '')})
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Alerta de 30+ dias sem compra */}
              {daysSincePurchase !== null && daysSincePurchase >= 30 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3 text-xs shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-bold text-orange-950">
                      <History className="size-3.5 text-orange-600" />
                      {daysSincePurchase} dias sem comprar (Retomada)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={handleMarkReengagement}
                        className="inline-flex items-center gap-1 rounded-md border border-orange-300 bg-white px-2 py-1 text-[10px] font-bold text-orange-800 shadow-2xs hover:bg-orange-50 transition disabled:opacity-60"
                      >
                        Marcar Tratado
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsAppMoment('recorrencia')
                          setWhatsAppModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                      >
                        <MessageCircle className="size-2.5" />
                        WhatsApp Reengajar
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-orange-800">
                    Última compra há {daysSincePurchase} dias. Envie uma mensagem calorosa Disney
                    para reativar o cliente.
                    {contact.last_reengagement_date && (
                      <span className="block mt-0.5">
                        Último contato registrado em: {datePt(contact.last_reengagement_date)}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {contact.notes && (
              <p className="mt-4 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[11px] leading-5 text-[#475569]">
                {contact.notes}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEmailModalOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white py-1.5 text-xs font-semibold text-[#475569] shadow-2xs hover:bg-[#f8fafc] transition"
              >
                <Send className="size-3 text-[#64748b]" /> Enviar e-mail
              </button>
              <button
                type="button"
                onClick={() => setNewPurchaseOpen(!newPurchaseOpen)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-500 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-600 transition"
              >
                <ShoppingBag className="size-3.5 text-white" /> Registrar compra
              </button>
            </div>
          </section>

          {/* SESSÃO: PEDIDOS / NEGOCIAÇÕES NO FUNIL */}
          <section className="border-b border-[#e5e7eb] p-5 bg-[#fafbfc]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-[#1c1c1e] flex items-center gap-1.5">
                  <Package className="size-3.5 text-amber-600" />
                  Pedidos & Negociação ({clientOrders.length})
                </h3>
                <p className="text-[10px] text-[#64748b]">
                  Funil do cliente: do pedido feito até avaliação no Google
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderDialogOpen(true)}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-800 hover:bg-amber-100 transition"
              >
                <Plus className="size-3" /> Novo Pedido
              </button>
            </div>

            {loadingOrders ? (
              <div className="py-4 text-center text-xs text-[#94a3b8]">Carregando pedidos...</div>
            ) : clientOrders.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#cbd5e1] p-3 text-center text-[11px] text-[#94a3b8]">
                Nenhum pedido no funil para este cliente.
              </div>
            ) : (
              <div className="space-y-2">
                {clientOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-md border border-[#e2e8f0] bg-white p-2.5 shadow-2xs hover:border-[#cbd5e1] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[11px] text-[#1c1c1e] block truncate">
                          {ord.title}
                        </span>
                        {ord.items_description && (
                          <span className="text-[10px] text-[#64748b] block truncate mt-0.5">
                            {ord.items_description}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-800 border border-slate-200">
                        {ORDER_STAGE_LABELS[ord.stage] || ord.stage}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono border-t border-[#f1f5f9] pt-1.5">
                      <span className="font-bold text-[#1c1c1e]">
                        {money.format(ord.value || 0)}
                      </span>
                      {ord.google_review_requested ? (
                        <span className="text-purple-700 font-semibold text-[9px]">
                          ⭐ Avaliação solicitada
                        </span>
                      ) : ord.stage === 'pedir_avaliacao_google' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setWhatsAppMoment('personalizado')
                            setWhatsAppModalOpen(true)
                          }}
                          className="text-purple-600 font-bold hover:underline"
                        >
                          Pedir avaliação agora →
                        </button>
                      ) : (
                        <span className="text-[#94a3b8]">{relativeTime(ord.created)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SESSÃO: HISTÓRICO DE COMPRAS E REGISTRO */}
          <section className="border-b border-[#e5e7eb] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-[#1c1c1e] flex items-center gap-1.5">
                  <ShoppingBag className="size-3.5 text-amber-600" />
                  Compras do Cliente ({purchases.length})
                </h3>
                <p className="text-[10px] text-[#64748b]">
                  Total gasto: <strong>{money.format(contact.total_spent || 0)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewPurchaseOpen(!newPurchaseOpen)}
                className="flex items-center gap-1 rounded border border-[#cbd5e1] px-2 py-1 text-[9px] font-medium text-[#475569] hover:bg-[#f8fafc]"
              >
                <Plus className="size-3" /> Nova compra
              </button>
            </div>

            {/* Formulário de inclusão rápida de compra */}
            {newPurchaseOpen && (
              <form
                onSubmit={handleRegisterPurchase}
                className="mb-4 rounded-lg border border-amber-300 bg-amber-50/50 p-3 shadow-2xs space-y-2.5 animate-panel-rise"
              >
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5 text-[11px] font-bold text-amber-900">
                  <span>Nova Venda / Compra</span>
                  <button
                    type="button"
                    onClick={() => setNewPurchaseOpen(false)}
                    className="text-amber-800 hover:text-amber-950"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#475569] mb-1">
                      Valor (R$) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 85,00"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      className="w-full rounded border border-[#cbd5e1] bg-white px-2 py-1 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#475569] mb-1">
                      Data da Compra
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full rounded border border-[#cbd5e1] bg-white px-2 py-1 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#475569] mb-1">
                    Itens / Descrição do Café
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2x Catuaí Amarelo 250g, 1x Pacote Drip Coffee"
                    value={purchaseItems}
                    onChange={(e) => setPurchaseItems(e.target.value)}
                    className="w-full rounded border border-[#cbd5e1] bg-white px-2 py-1 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#475569] mb-1">
                    Observações da Venda
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Balcão cafeteria, moagem para Prensa Francesa..."
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    className="w-full rounded border border-[#cbd5e1] bg-white px-2 py-1 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setNewPurchaseOpen(false)}
                    className="rounded border border-[#e2e8f0] bg-white px-2.5 py-1 text-[10px] text-[#475569] hover:bg-[#f8fafc]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingPurchase}
                    className="inline-flex items-center gap-1 rounded bg-amber-500 px-3 py-1 text-[10px] font-bold text-white hover:bg-amber-600 disabled:opacity-60"
                  >
                    {savingPurchase ? <LoaderCircle className="size-3 animate-spin" /> : null}
                    Confirmar Compra
                  </button>
                </div>
              </form>
            )}

            {loadingPurchases ? (
              <div className="py-6 text-center text-xs text-[#94a3b8]">Carregando compras...</div>
            ) : purchases.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#cbd5e1] p-4 text-center text-xs text-[#94a3b8]">
                Nenhuma compra registrada ainda. Clique em "Nova compra" para adicionar a primeira
                venda e iniciar o programa de fidelidade.
              </div>
            ) : (
              <div className="space-y-1.5">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="group flex items-center justify-between rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-left hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1c1c1e]">
                          {money.format(purchase.amount)}
                        </span>
                        <span className="font-mono text-[10px] text-[#64748b]">
                          {datePt(purchase.purchase_date)}
                        </span>
                      </div>
                      {purchase.items_description && (
                        <p className="truncate text-[11px] text-[#475569] mt-0.5">
                          {purchase.items_description}
                        </p>
                      )}
                      {purchase.notes && (
                        <p className="truncate text-[10px] text-[#94a3b8]">{purchase.notes}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePurchase(purchase.id)}
                      title="Excluir registro de compra"
                      className="ml-2 rounded p-1 text-[#94a3b8] opacity-0 transition hover:bg-[#f1f5f9] hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          {/* SESSÃO: LINHA DO TEMPO DA JORNADA DISNEY (OFICIAL PERSISTIDA) */}
          <section className="p-5 border-b border-[#e5e7eb] bg-[#fafafa]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-[#1c1c1e] flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-600" />
                  Linha do Tempo da Jornada ({journeyEvents.length})
                </h3>
                <p className="text-[10px] text-[#64748b]">
                  Todos os momentos de encantamento, marcos de fidelidade e WhatsApp
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWhatsAppMoment('personalizado')
                  setWhatsAppModalOpen(true)
                }}
                className="inline-flex items-center gap-1 rounded bg-white border border-[#cbd5e1] px-2 py-1 text-[9px] font-bold text-[#475569] hover:bg-[#f1f5f9]"
              >
                <MessageCircle className="size-3 text-emerald-600" /> Nova Mensagem
              </button>
            </div>

            {loadingJourney ? (
              <div className="py-4 text-center text-xs text-[#94a3b8]">Carregando jornada...</div>
            ) : journeyEvents.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#cbd5e1] p-4 text-center text-xs text-[#94a3b8]">
                Nenhum evento registrado na jornada deste cliente.
              </div>
            ) : (
              <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e2e8f0]">
                {journeyEvents.map((evt) => {
                  const isWhatsApp =
                    evt.type === 'whatsapp_enviado' || evt.type === 'whatsapp_falha'
                  const isLevel = evt.type === 'nivel_alcancado'
                  const isCoupon = evt.type === 'cupom_aniversario'
                  const isPurchase = evt.type === 'compra'

                  return (
                    <div key={evt.id} className="relative group flex gap-3 text-left">
                      {/* Ponto / Ícone da linha do tempo */}
                      <span
                        className={cn(
                          'absolute -left-4 mt-0.5 grid size-5 place-items-center rounded-full border bg-white shadow-2xs',
                          isWhatsApp
                            ? 'border-emerald-400 text-emerald-600'
                            : isLevel
                              ? 'border-purple-400 text-purple-600'
                              : isCoupon
                                ? 'border-rose-400 text-rose-600'
                                : isPurchase
                                  ? 'border-amber-400 text-amber-600'
                                  : 'border-blue-400 text-blue-600',
                        )}
                      >
                        {isWhatsApp ? (
                          <MessageCircle className="size-2.5" />
                        ) : isLevel ? (
                          <Award className="size-2.5" />
                        ) : isCoupon ? (
                          <Ticket className="size-2.5" />
                        ) : isPurchase ? (
                          <ShoppingBag className="size-2.5" />
                        ) : (
                          <Sparkles className="size-2.5" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1 rounded-md border border-[#e2e8f0] bg-white p-2.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[11px] text-[#1c1c1e] truncate">
                            {evt.title}
                          </span>
                          <span className="font-mono text-[9px] text-[#94a3b8] shrink-0">
                            {relativeTime(evt.created)}
                          </span>
                        </div>
                        {evt.description && (
                          <p className="mt-1 whitespace-pre-line text-[10px] text-[#475569] leading-relaxed">
                            {evt.description}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#94a3b8] font-mono border-t border-[#f1f5f9] pt-1">
                          <span>Canal: {evt.channel || 'crm'}</span>
                          <span>{datePt(evt.created)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* SESSÃO: HISTÓRICO GERAL DE ATIVIDADES */}
          <section className="p-5">
            <h3 className="mb-4 text-xs font-extrabold text-[#1c1c1e]">Histórico de Atividades</h3>
            <div className="space-y-4">
              {timeline.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
                    <MessageSquareText className="size-3 text-[#64748b]" />
                  </span>
                  <div>
                    <p className="text-[11px] leading-5 text-[#334155] whitespace-pre-line">
                      {activity.content}
                    </p>
                    <p className="mt-1 text-[9px] text-[#94a3b8]">
                      {relativeTime(activity.created)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
      <EmailComposerModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        contact={contact}
        deal={null}
        onSent={async () => {
          await refresh()
        }}
      />

      {/* Modal de Disparo de WhatsApp caloroso Disney */}
      <SendWhatsAppModal
        open={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        contact={contact}
        initialMoment={whatsAppMoment}
        couponCode={contact.last_coupon_code}
        onSent={async () => {
          if (contact.id) {
            const freshEvents = await listJourneyEvents(contact.id).catch(() => [])
            setJourneyEvents(freshEvents)
          }
          await refresh()
        }}
      />

      {/* Dialog de Novo Pedido / Negociação */}
      <OrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        presetContactId={contact.id}
        onCreated={async (created) => {
          setClientOrders((prev) => [created, ...prev])
        }}
      />
    </>
  )
}
