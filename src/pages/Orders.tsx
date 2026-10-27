import { useState, useMemo } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  GripVertical,
  LoaderCircle,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Truck,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import { OrderDialog } from '@/components/forms/OrderDialog'
import { SendWhatsAppModal } from '@/components/SendWhatsAppModal'
import {
  deleteOrder,
  markGoogleReviewRequested,
  ORDER_STAGE_LABELS,
  updateOrder,
} from '@/services/crm'
import { formatTemplateText, DISNEY_MESSAGE_TEMPLATES } from '@/data/messageTemplates'
import {
  datePt,
  getLoyaltyLevel,
  initials,
  money,
  relativeTime,
  type Contact,
  type Order,
  type OrderStage,
} from '@/types/crm'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface OrderFunnelColumn {
  key: OrderStage
  label: string
  subtitle: string
  icon: typeof ShoppingBag
  accentBg: string
  accentBorder: string
  accentBadge: string
  textColor: string
}

const ORDER_COLUMNS: OrderFunnelColumn[] = [
  {
    key: 'pedido_feito',
    label: 'Pedido feito',
    subtitle: 'Pedido recebido, separando cafés frescos e calibrando moagem',
    icon: ShoppingBag,
    accentBg: 'bg-amber-50/70',
    accentBorder: 'border-amber-200',
    accentBadge: 'bg-amber-100 text-amber-900',
    textColor: 'text-amber-950',
  },
  {
    key: 'pedido_enviado',
    label: 'Pedido enviado',
    subtitle: 'Despachado via Correios / transportadora ou motoboy local',
    icon: Truck,
    accentBg: 'bg-blue-50/70',
    accentBorder: 'border-blue-200',
    accentBadge: 'bg-blue-100 text-blue-900',
    textColor: 'text-blue-950',
  },
  {
    key: 'pedido_recebido',
    label: 'Pedido recebido',
    subtitle: 'Cliente confirmou entrega ou encomenda chegou com sucesso',
    icon: Package,
    accentBg: 'bg-emerald-50/70',
    accentBorder: 'border-emerald-200',
    accentBadge: 'bg-emerald-100 text-emerald-900',
    textColor: 'text-emerald-950',
  },
  {
    key: 'pedir_avaliacao_google',
    label: 'Pedir avaliação do Google',
    subtitle: 'Acolher a experiência e convidar com carinho para avaliar no Google',
    icon: Star,
    accentBg: 'bg-purple-50/70',
    accentBorder: 'border-purple-300 ring-1 ring-purple-200',
    accentBadge: 'bg-purple-100 text-purple-900',
    textColor: 'text-purple-950',
  },
  {
    key: 'concluido',
    label: 'Concluído',
    subtitle: 'Negociação e experiência finalizadas com excelência Disney',
    icon: CheckCircle2,
    accentBg: 'bg-slate-50/70',
    accentBorder: 'border-slate-200',
    accentBadge: 'bg-slate-100 text-slate-800',
    textColor: 'text-slate-900',
  },
]

export default function Orders() {
  const { orders, contacts, loading, refresh } = useCrm()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presetStage, setPresetStage] = useState<OrderStage>('pedido_feito')

  // Drag-and-drop state
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<OrderStage | null>(null)

  // WhatsApp Review Modal
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)
  const [whatsAppContact, setWhatsAppContact] = useState<Contact | null>(null)
  const [activeOrderForReview, setActiveOrderForReview] = useState<Order | null>(null)

  // Modal de Exclusão de Pedido
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filtro
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const contactName = o.expand?.contact?.name || ''
      const items = o.items_description || ''
      const title = o.title || ''
      const q = search.toLowerCase()
      return (
        !q ||
        contactName.toLowerCase().includes(q) ||
        items.toLowerCase().includes(q) ||
        title.toLowerCase().includes(q)
      )
    })
  }, [orders, search])

  // Agrupados por coluna
  const ordersByStage = useMemo(() => {
    const map: Record<OrderStage, Order[]> = {
      pedido_feito: [],
      pedido_enviado: [],
      pedido_recebido: [],
      pedir_avaliacao_google: [],
      concluido: [],
    }
    filteredOrders.forEach((order) => {
      if (map[order.stage]) {
        map[order.stage].push(order)
      } else {
        map.pedido_feito.push(order)
      }
    })
    return map
  }, [filteredOrders])

  // Total negociado
  const totalValue = useMemo(() => {
    return orders.reduce((acc, o) => acc + (Number(o.value) || 0), 0)
  }, [orders])

  // Drag and drop handler
  const handleDrop = async (targetStage: OrderStage) => {
    if (!draggingOrderId) return
    const order = orders.find((o) => o.id === draggingOrderId)
    if (!order || order.stage === targetStage) {
      setDraggingOrderId(null)
      setOverStage(null)
      return
    }

    const previousStage = order.stage
    setDraggingOrderId(null)
    setOverStage(null)

    try {
      await updateOrder(order.id, { stage: targetStage })
      await refresh()
      toast({
        title: `Pedido movido para "${ORDER_STAGE_LABELS[targetStage]}"`,
        description: `${order.title} (${order.expand?.contact?.name || 'Cliente'})`,
      })

      // Se moveu para "pedir_avaliacao_google", disparar notificação amigável para enviar WhatsApp
      if (targetStage === 'pedir_avaliacao_google') {
        const contact = contacts.find((c) => c.id === order.contact) || order.expand?.contact
        if (contact) {
          toast({
            title: '🌟 Hora de pedir avaliação!',
            description: `O pedido de ${contact.name} foi recebido. Clique em "Pedir Avaliação do Google" para enviar a mensagem calorosa.`,
          })
        }
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível mover o pedido',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    }
  }

  // Ação rápida: Pedir avaliação do Google
  const handleRequestGoogleReview = (order: Order) => {
    const contact = contacts.find((c) => c.id === order.contact) || order.expand?.contact
    if (!contact) {
      toast({
        variant: 'destructive',
        title: 'Cliente não encontrado',
      })
      return
    }
    setActiveOrderForReview(order)
    setWhatsAppContact(contact)
    setWhatsAppModalOpen(true)
  }

  // Deletar pedido
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Deseja realmente excluir este pedido?')) return
    setDeletingId(orderId)
    try {
      await deleteOrder(orderId)
      await refresh()
      toast({ title: 'Pedido removido com sucesso' })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover pedido',
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#fafbfc]">
      {/* Header Linear */}
      <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-600 font-bold">
                Funil de Negociação · Cafés Especiais
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                <ShoppingBag className="size-3" /> {orders.length} pedidos
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e] flex items-center gap-2">
              Funil de Pedidos & Negociação
            </h1>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Acompanhe os cards desde o pedido feito até a solicitação de avaliação no Google.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-[#64748b] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md hidden sm:inline-block">
              VALOR TOTAL: <strong>{money.format(totalValue)}</strong>
            </span>

            <button
              onClick={() => refresh()}
              title="Recarregar pedidos"
              className="inline-flex items-center gap-1 rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#475569] shadow-2xs hover:bg-[#f8fafc] transition"
            >
              <RefreshCw className="size-3.5" />
            </button>

            <button
              onClick={() => {
                setPresetStage('pedido_feito')
                setDialogOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition"
            >
              <Plus className="size-3.5" /> Novo Pedido
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="mt-3 flex items-center justify-between">
          <label className="flex h-8 w-full sm:w-80 items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, café ou item..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
            />
          </label>
        </div>
      </div>

      {/* Kanban Board estilo Linear */}
      <div className="flex-1 min-h-0 overflow-x-auto p-3 sm:p-5 touch-pan-x">
        <div className="flex gap-3 h-full min-w-[1100px] sm:min-w-[1300px]">
          {ORDER_COLUMNS.map((col) => {
            const Icon = col.icon
            const items = ordersByStage[col.key] || []
            const columnTotal = items.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
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
                onDrop={() => handleDrop(col.key)}
                className={cn(
                  'flex flex-col w-[250px] sm:w-[275px] shrink-0 rounded-lg border bg-white shadow-2xs transition-colors',
                  isOver
                    ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-300/40'
                    : col.accentBorder,
                )}
              >
                {/* Header da Coluna */}
                <header
                  className={cn(
                    'p-3 border-b rounded-t-lg shrink-0',
                    col.accentBg,
                    col.accentBorder,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn('size-4', col.textColor)} />
                      <h2 className={cn('text-xs font-bold truncate', col.textColor)}>
                        {col.label}
                      </h2>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-mono font-bold',
                        col.accentBadge,
                      )}
                    >
                      {items.length}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] text-[#64748b] leading-tight line-clamp-2">
                    {col.subtitle}
                  </p>

                  <div className="mt-2 pt-1 border-t border-black/5 flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                    <span>Total coluna:</span>
                    <strong className="text-[#1c1c1e]">{money.format(columnTotal)}</strong>
                  </div>
                </header>

                {/* Cards da Coluna */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2.5 bg-[#fcfdfe]">
                  {items.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-[#94a3b8] border border-dashed border-[#e2e8f0] rounded-md my-2">
                      Nenhum pedido aqui
                    </div>
                  ) : (
                    items.map((order) => {
                      const contact = order.expand?.contact
                      const loyalty = contact ? getLoyaltyLevel(contact.purchase_count || 0) : null
                      const isGoogleStage = order.stage === 'pedir_avaliacao_google'

                      return (
                        <article
                          key={order.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggingOrderId(order.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            setDraggingOrderId(null)
                            setOverStage(null)
                          }}
                          className={cn(
                            'group cursor-grab rounded-md border bg-white p-3 shadow-2xs hover:border-[#cbd5e1] hover:shadow-xs transition active:cursor-grabbing flex flex-col justify-between',
                            isGoogleStage
                              ? 'border-purple-300 bg-purple-50/20'
                              : 'border-[#e2e8f0]',
                            draggingOrderId === order.id && 'opacity-40 scale-[0.98]',
                          )}
                        >
                          <div>
                            {/* Linha 1: Cliente e Fidelidade */}
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (order.contact) {
                                      navigate(`/contatos?contact=${order.contact}`)
                                    }
                                  }}
                                  className="text-left font-bold text-xs text-[#1c1c1e] hover:text-amber-600 transition truncate block"
                                >
                                  {contact?.name || 'Cliente'}
                                  {contact?.nickname && (
                                    <span className="block text-[10px] font-normal text-amber-800">
                                      "{contact.nickname}"
                                    </span>
                                  )}
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                {loyalty && (
                                  <span
                                    className={cn(
                                      'shrink-0 text-[8px] font-bold px-1.5 py-0.2 rounded border',
                                      loyalty.badgeColor,
                                    )}
                                    title={loyalty.name}
                                  >
                                    Nv.{loyalty.level}
                                  </span>
                                )}
                                <GripVertical className="size-3 text-[#94a3b8] opacity-0 group-hover:opacity-100" />
                              </div>
                            </div>

                            {/* Linha 2: Título do Pedido */}
                            <h3 className="mt-1.5 text-[11px] font-bold text-[#1c1c1e] leading-snug">
                              {order.title}
                            </h3>

                            {/* Linha 3: Itens detalhados */}
                            {order.items_description && (
                              <p className="mt-1 text-[10px] text-[#64748b] leading-tight line-clamp-2">
                                ☕ {order.items_description}
                              </p>
                            )}

                            {/* Rastreio */}
                            {order.tracking_code && (
                              <div className="mt-1.5 flex items-center gap-1 font-mono text-[9px] text-blue-700 bg-blue-50/80 rounded px-1.5 py-0.5">
                                <Truck className="size-2.5 shrink-0" />
                                <span className="truncate">Rastreio: {order.tracking_code}</span>
                              </div>
                            )}

                            {/* Valor e Data */}
                            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono border-t border-[#f1f5f9] pt-2">
                              <span className="font-bold text-[#1c1c1e]">
                                {money.format(order.value || 0)}
                              </span>
                              <span className="text-[#94a3b8] text-[9px]">
                                {relativeTime(order.created)}
                              </span>
                            </div>

                            {/* Status de Avaliação no Google */}
                            {order.google_review_requested && (
                              <div className="mt-2 flex items-center gap-1 text-[9px] text-purple-700 bg-purple-50 rounded px-1.5 py-0.5">
                                <CheckCircle2 className="size-2.5 text-purple-600" />
                                <span>
                                  Avaliação solicitada ({datePt(order.google_review_date || '')})
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Ações do Card */}
                          <div className="mt-3 pt-2 border-t border-[#f1f5f9] flex items-center justify-between gap-1">
                            {/* Botão de destaque para Pedir Avaliação do Google quando estiver na coluna */}
                            {isGoogleStage && (
                              <button
                                type="button"
                                onClick={() => handleRequestGoogleReview(order)}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition shadow-2xs',
                                  order.google_review_requested
                                    ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                                    : 'bg-purple-600 text-white hover:bg-purple-700 animate-pulse',
                                )}
                                title="Enviar mensagem de agradecimento com link de avaliação"
                              >
                                <Star className="size-2.5 fill-current" />
                                {order.google_review_requested
                                  ? 'Reenviar Google'
                                  : 'Pedir Avaliação Google'}
                              </button>
                            )}

                            {!isGoogleStage && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (order.contact) {
                                    navigate(`/contatos?contact=${order.contact}`)
                                  }
                                }}
                                className="text-[10px] font-semibold text-[#64748b] hover:text-[#1c1c1e]"
                              >
                                Ver cliente
                              </button>
                            )}

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(order.id)}
                                title="Excluir pedido"
                                className="rounded p-1 text-[#94a3b8] opacity-0 hover:bg-[#f1f5f9] hover:text-red-600 group-hover:opacity-100 transition"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })
                  )}

                  {/* Botão de adicionar pedido direto na coluna */}
                  <button
                    type="button"
                    onClick={() => {
                      setPresetStage(col.key)
                      setDialogOpen(true)
                    }}
                    className="flex h-7 w-full items-center justify-center gap-1 rounded border border-dashed border-[#cbd5e1] text-[10px] text-[#64748b] hover:border-[#94a3b8] hover:bg-white transition"
                  >
                    <Plus className="size-3" /> Adicionar nesta etapa
                  </button>
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {/* Dialog para Criar Novo Pedido */}
      <OrderDialog open={dialogOpen} onOpenChange={setDialogOpen} presetStage={presetStage} />

      {/* Modal de Disparo WhatsApp para Avaliação do Google */}
      <SendWhatsAppModal
        open={whatsAppModalOpen}
        onClose={() => {
          setWhatsAppModalOpen(false)
          setActiveOrderForReview(null)
          setWhatsAppContact(null)
        }}
        contact={whatsAppContact}
        initialMoment="personalizado"
        onSent={async () => {
          if (activeOrderForReview) {
            await markGoogleReviewRequested(activeOrderForReview.id)
          }
          await refresh()
        }}
      />
    </div>
  )
}
