import { useState, useMemo, useEffect } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  GripVertical,
  LoaderCircle,
  MessageCircle,
  Package,
  Pencil,
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
import { OrderShippingStatus } from '@/components/OrderShippingStatus'
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
import { isSameLocalDay } from '@/lib/order-shipping'
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
  columnBg: string
}

const ORDER_COLUMNS: OrderFunnelColumn[] = [
  {
    key: 'orcamento',
    label: 'Orçamento',
    subtitle: 'Cotação em levantamento, aguardando aprovação antes de virar pedido',
    icon: ClipboardList,
    accentBg: 'bg-[#f1e6d2]',
    accentBorder: 'border-[#d9c39c]',
    accentBadge: 'bg-[#f3dfae] text-[#6b4d0e] border border-[#d9b96a]',
    textColor: 'text-[#7a5a17]',
    columnBg: 'bg-[#faf5ea]',
  },
  {
    key: 'pedido_feito',
    label: 'Pedido feito',
    subtitle: 'Pedido recebido, separando cafés frescos e calibrando moagem',
    icon: ShoppingBag,
    accentBg: 'bg-[#f7efe0]',
    accentBorder: 'border-[#e8d5be]',
    accentBadge: 'bg-amber-100 text-amber-900 border border-amber-300',
    textColor: 'text-[#633a10]',
    columnBg: 'bg-[#fbf7f0]',
  },
  {
    key: 'pedido_enviado',
    label: 'Pedido enviado',
    subtitle: 'Despachado via Correios / transportadora ou motoboy local',
    icon: Truck,
    accentBg: 'bg-[#e7f0fa]',
    accentBorder: 'border-[#c9def5]',
    accentBadge: 'bg-blue-100 text-blue-900 border border-blue-300',
    textColor: 'text-[#1d4f8f]',
    columnBg: 'bg-[#f5f8fc]',
  },
  {
    key: 'pedido_recebido',
    label: 'Pedido recebido',
    subtitle: 'Cliente confirmou entrega ou encomenda chegou com sucesso',
    icon: Package,
    accentBg: 'bg-[#e2f3ec]',
    accentBorder: 'border-[#c1e6d7]',
    accentBadge: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    textColor: 'text-[#126343]',
    columnBg: 'bg-[#f3f9f6]',
  },
  {
    key: 'pedir_avaliacao_google',
    label: 'Pedir avaliação do Google',
    subtitle: 'Acolher a experiência e convidar com carinho para avaliar no Google',
    icon: Star,
    accentBg: 'bg-[#efe9fa]',
    accentBorder: 'border-[#decff7]',
    accentBadge: 'bg-purple-100 text-purple-900 border border-purple-300',
    textColor: 'text-[#5b299e]',
    columnBg: 'bg-[#f8f5fc]',
  },
  {
    key: 'concluido',
    label: 'Concluído',
    subtitle: 'Negociação e experiência finalizadas com excelência Disney',
    icon: CheckCircle2,
    accentBg: 'bg-[#ede5da]',
    accentBorder: 'border-[#d6c4b2]',
    accentBadge: 'bg-[#dfd3c3] text-[#4d3a2b] border border-[#cbbca9]',
    textColor: 'text-[#3d2c1e]',
    columnBg: 'bg-[#f5ede2]',
  },
]

export default function Orders() {
  const { orders, contacts, loading, refresh } = useCrm()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presetStage, setPresetStage] = useState<OrderStage>('pedido_feito')
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  // Drag-and-drop state
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<OrderStage | null>(null)

  // WhatsApp Review Modal
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)
  const [whatsAppContact, setWhatsAppContact] = useState<Contact | null>(null)
  const [activeOrderForReview, setActiveOrderForReview] = useState<Order | null>(null)

  // Modal de Exclusão de Pedido
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Feedback de cópia do rastreio: armazena orderId copiado
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null)

  // Dia corrente para o contador de envio: verifica a cada minuto e só re-renderiza ao virar o dia
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday((prev) => (isSameLocalDay(prev, new Date()) ? prev : new Date()))
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const handleCopyTracking = async (orderId: string, code: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(code)
      setCopiedTrackingId(orderId)
      toast({
        title: 'Código copiado!',
        description: `${code} copiado para a área de transferência.`,
      })
      setTimeout(() => {
        setCopiedTrackingId((curr) => (curr === orderId ? null : curr))
      }, 2500)
    } catch {
      // Fallback simples caso clipboard API falhe
      const textArea = document.createElement('textarea')
      textArea.value = code
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedTrackingId(orderId)
      toast({
        title: 'Código copiado!',
        description: `${code} copiado para a área de transferência.`,
      })
      setTimeout(() => {
        setCopiedTrackingId((curr) => (curr === orderId ? null : curr))
      }, 2500)
    }
  }

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
      orcamento: [],
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
    <div className="flex flex-col h-full bg-[#f4ece1]">
      {/* Header Linear com tema de café */}
      <div className="shrink-0 border-b border-[#ded2c3] bg-[#fbf9f5] px-4 py-3 sm:px-6 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
                Funil de Negociação · Cafés Especiais
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-[#693910]">
                <ShoppingBag className="size-3" /> {orders.length} pedidos
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#2b1c13] flex items-center gap-2">
              Funil de Pedidos & Negociação
            </h1>
            <p className="mt-0.5 text-xs text-[#705e4d]">
              Demarcação visual por etapas: desde o pedido feito até a solicitação de avaliação no
              Google.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-[#5c4735] bg-[#f3ece0] border border-[#d6c7b6] px-2.5 py-1 rounded-md hidden sm:inline-block">
              VALOR TOTAL: <strong className="text-[#2b1c13]">{money.format(totalValue)}</strong>
            </span>

            <button
              onClick={() => refresh()}
              title="Recarregar pedidos"
              className="inline-flex items-center gap-1 rounded-md border border-[#d6c7b6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#5c4735] shadow-2xs hover:bg-[#f3ece0] transition"
            >
              <RefreshCw className="size-3.5" />
            </button>

            <button
              onClick={() => {
                setEditingOrder(null)
                setPresetStage('pedido_feito')
                setDialogOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#8c531b] border border-[#6f3f12] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#724113] transition"
            >
              <Plus className="size-3.5" /> Novo Pedido
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex h-9 sm:h-8 w-full sm:w-80 items-center rounded-md border border-[#d6c7b6] bg-white px-2.5 shadow-2xs transition-colors focus-within:border-amber-600 focus-within:ring-1 focus-within:ring-amber-500/30">
            <Search className="mr-2 size-3.5 shrink-0 text-[#8c7865]" />
            <input
              id="orders-search-input"
              type="search"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, café ou item..."
              className="min-w-0 flex-1 bg-transparent text-xs sm:text-[11px] text-[#2b1c13] outline-none placeholder:text-[#9c8978]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="ml-1 text-[11px] font-bold text-[#8c7865] hover:text-[#2b1c13] px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board com demarcação nítida por coluna */}
      <div className="flex-1 min-h-0 overflow-x-auto p-3 sm:p-5 touch-pan-x bg-[#ede4d8]">
        <div className="flex gap-3.5 h-full min-w-[1100px] sm:min-w-[1300px]">
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
                  'flex flex-col w-[260px] sm:w-[285px] shrink-0 rounded-lg border shadow-xs transition-colors',
                  col.columnBg,
                  col.accentBorder,
                  isOver ? 'ring-2 ring-amber-500 shadow-md' : '',
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
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 bg-black/[0.015]">
                  {items.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-[#8c7865] border border-dashed border-[#d8c8b6] rounded-md my-2 bg-white/40">
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
                            'group cursor-grab rounded-md border bg-white p-3 shadow-2xs hover:border-[#bda895] hover:shadow-xs transition active:cursor-grabbing flex flex-col justify-between border-[#ded2c3]',
                            isGoogleStage && 'border-purple-300 bg-purple-50/30',
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

                            {/* Linha 3: Itens detalhados (produtos estruturados ou texto livre) */}
                            {Array.isArray(order.items) && order.items.length > 0 ? (
                              <div className="mt-1.5 space-y-0.5">
                                <div className="text-[10px] text-[#705e4d] leading-tight flex flex-wrap gap-1">
                                  {order.items.map((it, idx) => (
                                    <span
                                      key={it.id || idx}
                                      className="inline-flex items-center gap-1 rounded bg-[#f7efe0] border border-[#e8d5be] px-1.5 py-0.5 text-[9.5px] font-medium text-[#4a3420]"
                                    >
                                      <span className="font-bold text-[#8c531b]">
                                        {it.quantity}x
                                      </span>
                                      <span className="truncate max-w-[130px]">{it.name}</span>
                                    </span>
                                  ))}
                                </div>
                                {order.items_description &&
                                  order.items_description !==
                                    order.items
                                      .map((i) => `${i.quantity}x ${i.name}`)
                                      .join(' + ') && (
                                    <p className="text-[9.5px] text-[#8c7865] italic leading-tight line-clamp-1">
                                      Obs: {order.items_description}
                                    </p>
                                  )}
                              </div>
                            ) : order.items_description ? (
                              <p className="mt-1 text-[10px] text-[#64748b] leading-tight line-clamp-2">
                                ☕ {order.items_description}
                              </p>
                            ) : null}

                            {/* Rastreio dos Correios: Código clicável para cópia + Link oficial */}
                            <div
                              className="mt-2 space-y-1"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {/* Link Correios Empresas (portal de login) — acima do rastreio */}
                              <a
                                href="https://empresas.correios.com.br/#/login"
                                target="_blank"
                                rel="noopener noreferrer"
                                draggable={false}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => e.stopPropagation()}
                                title="Abrir portal Correios Empresas em nova aba"
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8c531b] hover:text-[#633a10] hover:underline px-1 py-1 rounded transition"
                              >
                                <ExternalLink className="size-2.5 shrink-0 text-[#8c531b]" />
                                <span>Correios Empresas</span>
                              </a>

                              {order.tracking_code && (
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleCopyTracking(order.id, order.tracking_code, e)
                                  }
                                  title="Clique para copiar o código de rastreio"
                                  className={cn(
                                    'w-full flex items-center justify-between gap-1.5 font-mono text-[9.5px] rounded px-2 py-1 transition border text-left',
                                    copiedTrackingId === order.id
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300'
                                      : 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-800 border-blue-200/80 hover:border-blue-300 shadow-2xs',
                                  )}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Truck className="size-3 shrink-0 text-blue-600" />
                                    <span className="font-semibold text-blue-900 shrink-0">
                                      Rastreio:
                                    </span>
                                    <span className="truncate font-bold tracking-wider">
                                      {order.tracking_code}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 ml-1">
                                    {copiedTrackingId === order.id ? (
                                      <span className="inline-flex items-center gap-0.5 font-sans font-bold text-[9px] text-emerald-700">
                                        <Check className="size-3" /> Copiado!
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 font-sans text-[8.5px] text-blue-600 opacity-80 hover:opacity-100">
                                        <Copy className="size-2.5" /> Copiar
                                      </span>
                                    )}
                                  </div>
                                </button>
                              )}

                              <a
                                href="https://rastreamento.correios.com.br/app/index.php"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => e.stopPropagation()}
                                title="Abrir portal de Rastreamento dos Correios em nova aba"
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8c531b] hover:text-[#633a10] hover:underline px-1 py-0.5 rounded transition"
                              >
                                <ExternalLink className="size-2.5 shrink-0 text-[#8c531b]" />
                                <span>Rastreamento Correios</span>
                              </a>

                              {/* Data do envio e contador de dias (ou "Recebido") */}
                              <OrderShippingStatus order={order} now={today} />

                              {/* Avaliação da ficha do Google — abre em nova aba */}
                              <a
                                href="https://g.page/r/Cc1UruBeWXaZEBE/review"
                                target="_blank"
                                rel="noopener noreferrer"
                                draggable={false}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => e.stopPropagation()}
                                title="Abrir a ficha do Google para avaliar a cafeteria em nova aba"
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8c531b] hover:text-[#633a10] hover:underline px-1 py-0.5 rounded transition"
                              >
                                <Star className="size-2.5 shrink-0 text-[#8c531b]" />
                                <span>Avaliar no Google</span>
                              </a>
                            </div>

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
                              {/* Botão de Editar Pedido (visível no hover e sempre acessível no mobile/toque) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingOrder(order)
                                  setDialogOpen(true)
                                }}
                                title="Editar pedido"
                                className="inline-flex items-center gap-1 rounded p-1 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-[#f3ece0] text-[#8c531b] hover:text-[#6f3f12] transition"
                              >
                                <Pencil className="size-3.5" />
                                <span className="text-[10px] font-semibold sm:hidden">Editar</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteOrder(order.id)
                                }}
                                title="Excluir pedido"
                                className="rounded p-1 text-[#94a3b8] sm:opacity-0 sm:group-hover:opacity-100 hover:bg-[#f3ece0] hover:text-red-600 transition"
                              >
                                <Trash2 className="size-3.5" />
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
                      setEditingOrder(null)
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

      {/* Dialog para Criar ou Editar Pedido */}
      <OrderDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => {
          setDialogOpen(isOpen)
          if (!isOpen) setEditingOrder(null)
        }}
        order={editingOrder}
        presetStage={presetStage}
      />

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
