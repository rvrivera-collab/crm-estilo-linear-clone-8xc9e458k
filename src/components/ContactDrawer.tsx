import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  Cake,
  Calendar,
  Coffee,
  ExternalLink,
  History,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import {
  datePt,
  getBirthdayInfo,
  getDaysSinceLastPurchase,
  getLoyaltyLevel,
  money,
  relativeTime,
  type Contact,
  type Purchase,
} from '@/types/crm'
import {
  applyBirthdayCouponToContact,
  deletePurchase,
  listPurchases,
  markReengagementTreated,
  registerPurchase,
} from '@/services/crm'
import { EmailComposerModal } from '@/components/forms/EmailComposerModal'
import { useToast } from '@/hooks/use-toast'

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

  // Carregar compras do contato
  useEffect(() => {
    if (!contact?.id) {
      setPurchases([])
      return
    }
    let active = true
    setLoadingPurchases(true)
    listPurchases(contact.id)
      .then((data) => {
        if (active) setPurchases(data)
      })
      .catch(() => {
        if (active) setPurchases([])
      })
      .finally(() => {
        if (active) setLoadingPurchases(false)
      })
    return () => {
      active = false
    }
  }, [contact?.id])

  const loyalty = useMemo(() => {
    return getLoyaltyLevel(contact?.purchase_count || 0)
  }, [contact?.purchase_count])

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
      <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[440px] animate-drawer-in flex-col border-l border-[#e5e7eb] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.1)]">
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
                <p className="mt-0.5 text-xs text-[#64748b]">
                  {contact.position || 'Cliente'} {contact.company ? `· ${contact.company}` : ''}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-2xs ${loyalty.badgeColor}`}
                title={loyalty.description}
              >
                <Award className="size-3.5" />
                <span>
                  Nível {loyalty.level}: {loyalty.name}
                </span>
              </span>
            </div>

            {/* Informações de contato */}
            <div className="mt-4 space-y-2 text-[11px] text-[#475569]">
              <p className="flex items-center gap-2">
                <Mail className="size-3.5 text-[#94a3b8]" /> {contact.email || 'Sem e-mail'}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-3.5 text-[#94a3b8]" /> {contact.phone || 'Sem telefone'}
              </p>
              {contact.favorite_coffee && (
                <p className="flex items-center gap-2 text-amber-900 font-medium">
                  <Coffee className="size-3.5 text-amber-700 shrink-0" />
                  <span>
                    Café Favorito: <strong>{contact.favorite_coffee}</strong>
                  </span>
                </p>
              )}
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

            {/* BOX DE LEMBRETES E AÇÕES RÁPIDAS (ANIVERSÁRIO E RETENÇÃO) */}
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
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleGenerateBirthdayCoupon}
                      className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-rose-700 transition disabled:opacity-60"
                    >
                      <Sparkles className="size-3" />
                      Gerar Cupom
                    </button>
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
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleMarkReengagement}
                      className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-orange-700 transition disabled:opacity-60"
                    >
                      Marcar Tratado
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-orange-800">
                    Última compra há {daysSincePurchase} dias. Ofereça um café recém-torrado para
                    reativar o cliente.
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
          <section className="p-5">
            <h3 className="mb-4 text-xs font-extrabold text-[#1c1c1e]">Histórico</h3>
            <div className="space-y-4">
              {timeline.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
                    <MessageSquareText className="size-3 text-[#64748b]" />
                  </span>
                  <div>
                    <p className="text-[11px] leading-5 text-[#334155]">{activity.content}</p>
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
    </>
  )
}
