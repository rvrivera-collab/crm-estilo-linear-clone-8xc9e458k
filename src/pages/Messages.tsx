import { useState, useMemo, useEffect } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Ticket,
  User,
  XCircle,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import { ConnectorButton } from '@/components/skip/ConnectorButton'
import { SendWhatsAppModal } from '@/components/SendWhatsAppModal'
import { listJourneyEvents } from '@/services/crm'
import { listConnectors, type ConnectorStatus } from '@/lib/skipConnectors'
import {
  datePt,
  getLoyaltyLevel,
  money,
  relativeTime,
  type Contact,
  type JourneyEvent,
} from '@/types/crm'
import { cn } from '@/lib/utils'

interface ClientConversation {
  contactId: string
  contact: Contact | null
  events: JourneyEvent[]
  lastEvent: JourneyEvent
  totalMessages: number
  failedCount: number
}

type FilterCategory = 'todos' | 'recompra' | 'aniversario' | 'avaliacao' | 'nivel' | 'outros'

export default function Messages() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { contacts, loading: crmLoading, refresh: refreshCrm } = useCrm()

  const [events, setEvents] = useState<JourneyEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('todos')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'warning'>('all')

  // Conector WhatsApp
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatus | null>(null)

  // Modal para envio de nova mensagem
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [targetContact, setTargetContact] = useState<Contact | null>(null)
  const [initialMoment, setInitialMoment] = useState<
    'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  >('personalizado')

  // Carregar status do conector
  const loadConnector = () => {
    listConnectors()
      .then((all) => {
        const zap = all.find((c) => c.toolkit === 'whatsapp')
        setConnectorStatus(zap ? zap.status : 'not_connected')
      })
      .catch(() => {
        setConnectorStatus('not_connected')
      })
  }

  useEffect(() => {
    loadConnector()
  }, [])

  // Carregar todos os eventos de jornada
  const fetchEvents = async () => {
    setLoadingEvents(true)
    try {
      const data = await listJourneyEvents()
      setEvents(data)
    } catch (e) {
      console.error('Erro ao carregar journey_events:', e)
    } finally {
      setLoadingEvents(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  // Mapa de contatos por ID para enriquecimento rápido
  const contactsMap = useMemo(() => {
    const map = new Map<string, Contact>()
    contacts.forEach((c) => map.set(c.id, c))
    return map
  }, [contacts])

  // Filtrar eventos que são mensagens/WhatsApp ou comunicações relevantes da jornada
  // (whatsapp_enviado, whatsapp_falha, cupom_aniversario, reengajamento, avaliacao_google, channel === 'whatsapp')
  const messageEvents = useMemo(() => {
    return events.filter((ev) => {
      const isZapType =
        ev.type === 'whatsapp_enviado' ||
        ev.type === 'whatsapp_falha' ||
        ev.type === 'cupom_aniversario' ||
        ev.type === 'reengajamento' ||
        ev.type === 'atendimento_especial' ||
        ev.type === 'nivel_alcancado'
      const isZapChannel = ev.channel === 'whatsapp' || ev.channel === 'crm'
      return isZapType || isZapChannel
    })
  }, [events])

  // Agrupar eventos por cliente em formato de conversas/inbox
  const conversations = useMemo(() => {
    const map = new Map<string, JourneyEvent[]>()

    messageEvents.forEach((ev) => {
      const cId = ev.contact
      if (!cId) return
      const list = map.get(cId) || []
      list.push(ev)
      map.set(cId, list)
    })

    const list: ClientConversation[] = []
    map.forEach((contactEvents, contactId) => {
      // Ordenar eventos deste cliente do mais recente para o mais antigo
      const sorted = [...contactEvents].sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
      )
      const lastEvent = sorted[0]
      const contact = contactsMap.get(contactId) || (lastEvent.expand?.contact as Contact) || null
      const failedCount = sorted.filter((e) => e.type === 'whatsapp_falha').length

      list.push({
        contactId,
        contact,
        events: sorted,
        lastEvent,
        totalMessages: sorted.length,
        failedCount,
      })
    })

    // Ordenar a lista de conversas pela mensagem mais recente de cada cliente
    return list.sort(
      (a, b) => new Date(b.lastEvent.created).getTime() - new Date(a.lastEvent.created).getTime(),
    )
  }, [messageEvents, contactsMap])

  // Inicializar contato ativo via searchParams ou primeiro da lista
  useEffect(() => {
    const paramContact = searchParams.get('contact')
    if (paramContact) {
      setActiveContactId(paramContact)
    } else if (!activeContactId && conversations.length > 0) {
      setActiveContactId(conversations[0].contactId)
    }
  }, [conversations, searchParams, activeContactId])

  // Classificar evento em categoria
  const getEventCategory = (ev: JourneyEvent): FilterCategory => {
    const t = ev.type || ''
    const title = (ev.title || '').toLowerCase()
    const desc = (ev.description || '').toLowerCase()

    if (
      t === 'cupom_aniversario' ||
      title.includes('aniversário') ||
      desc.includes('aniversário')
    ) {
      return 'aniversario'
    }
    if (
      t === 'reengajamento' ||
      title.includes('recorrência') ||
      title.includes('reengajamento') ||
      title.includes('saudade') ||
      desc.includes('saudade')
    ) {
      return 'recompra'
    }
    if (title.includes('google') || title.includes('avaliação') || desc.includes('google')) {
      return 'avaliacao'
    }
    if (t === 'nivel_alcancado' || title.includes('nível') || title.includes('fidelidade')) {
      return 'nivel'
    }
    return 'outros'
  }

  // Conversas filtradas por busca e filtros
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const name = c.contact?.name || c.lastEvent.expand?.contact?.name || 'Cliente'
      const phone = c.contact?.phone || ''
      const nickname = c.contact?.nickname || ''
      const lastTitle = c.lastEvent.title || ''
      const lastDesc = c.lastEvent.description || ''

      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        name.toLowerCase().includes(q) ||
        phone.includes(q) ||
        nickname.toLowerCase().includes(q) ||
        lastTitle.toLowerCase().includes(q) ||
        lastDesc.toLowerCase().includes(q)

      if (!matchSearch) return false

      if (categoryFilter !== 'todos') {
        const hasCategory = c.events.some((ev) => getEventCategory(ev) === categoryFilter)
        if (!hasCategory) return false
      }

      if (statusFilter === 'warning') {
        if (c.failedCount === 0) return false
      } else if (statusFilter === 'success') {
        if (c.failedCount === c.events.length) return false
      }

      return true
    })
  }, [conversations, search, categoryFilter, statusFilter])

  // Conversa ativa selecionada
  const activeConversation = useMemo(() => {
    if (!activeContactId) return null
    return (
      conversations.find((c) => c.contactId === activeContactId) || {
        contactId: activeContactId,
        contact: contactsMap.get(activeContactId) || null,
        events: [],
        lastEvent: null as any,
        totalMessages: 0,
        failedCount: 0,
      }
    )
  }, [conversations, activeContactId, contactsMap])

  // Contato selecionado
  const activeContact =
    activeConversation?.contact || contactsMap.get(activeContactId || '') || null

  const handleSelectConversation = (contactId: string) => {
    setActiveContactId(contactId)
    setSearchParams({ contact: contactId })
  }

  const handleOpenComposer = (
    contact: Contact | null,
    moment: 'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado' = 'personalizado',
  ) => {
    if (!contact) return
    setTargetContact(contact)
    setInitialMoment(moment)
    setSendModalOpen(true)
  }

  const handleComposerSent = async () => {
    await fetchEvents()
    await refreshCrm()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fafbfc]">
      {/* Topo / Header Linear */}
      <header className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-emerald-600 font-bold">
                WhatsApp & Comunicação Disney
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                <MessageCircle className="size-3" /> {conversations.length} conversas
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono font-medium text-[#475569]">
                {messageEvents.length} mensagens enviadas
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e] flex items-center gap-2">
              Mensagens (WhatsApp)
            </h1>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Histórico unificado de conversas, aniversários, recompra em 30 dias e avaliações do
              Google por cliente.
            </p>
          </div>

          {/* Área de Conexão do WhatsApp & Ações */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Indicador de Estado da Conexão */}
            <div className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-xs">
              <span
                className={cn(
                  'size-2 rounded-full',
                  connectorStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400',
                )}
              />
              <span className="font-medium text-[#334155] text-[11px]">
                {connectorStatus === 'connected' ? (
                  <span className="text-emerald-700 font-bold">WhatsApp Conectado</span>
                ) : connectorStatus === 'expired' ? (
                  <span className="text-amber-700">Sessão Expirada</span>
                ) : (
                  <span className="text-[#64748b]">WhatsApp Desconectado (Link wa.me ativo)</span>
                )}
              </span>
            </div>

            {/* Botão de Conectar/Desconectar do Conector */}
            <ConnectorButton
              toolkit="whatsapp"
              name="WhatsApp"
              buttonClassName="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
              onStatusChange={(status) => setConnectorStatus(status)}
            />

            <button
              onClick={() => {
                fetchEvents()
                refreshCrm()
                loadConnector()
              }}
              title="Recarregar mensagens"
              className="inline-flex items-center gap-1 rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#475569] shadow-2xs hover:bg-[#f8fafc] transition"
            >
              <RefreshCw className="size-3.5" />
            </button>

            {/* Botão Nova Mensagem (abre seletor rápido caso não haja cliente ativo) */}
            {activeContact && (
              <button
                type="button"
                onClick={() => handleOpenComposer(activeContact)}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition"
              >
                <Plus className="size-3.5" /> Nova Mensagem
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Layout Inbox Linear de 2 Colunas (Mobile: Lista -> Detalhe com botão voltar) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Painel Esquerdo: Lista de Conversas por Cliente */}
        <aside
          className={cn(
            'w-full md:w-[320px] lg:w-[360px] shrink-0 border-r border-[#e5e7eb] bg-white flex flex-col min-h-0',
            activeContactId ? 'max-md:hidden' : 'flex',
          )}
        >
          {/* Barra de busca e filtros rápidos */}
          <div className="p-3 border-b border-[#e5e7eb] space-y-2 shrink-0 bg-[#fafafa]">
            <label className="flex h-8 w-full items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs">
              <Search className="mr-2 size-3.5 text-[#94a3b8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, café ou texto..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
              />
            </label>

            {/* Filtros em pílulas */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar">
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'recompra', label: '☕ Recompra 30d' },
                  { id: 'aniversario', label: '🎂 Aniversário' },
                  { id: 'avaliacao', label: '⭐ Google' },
                  { id: 'nivel', label: '🎖️ Nível' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 font-medium transition',
                    categoryFilter === cat.id
                      ? 'bg-amber-500 text-white font-bold'
                      : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista scrollável de conversas */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#f1f5f9]">
            {loadingEvents || crmLoading ? (
              <div className="p-8 text-center text-xs text-[#94a3b8]">
                <RefreshCw className="size-4 animate-spin mx-auto mb-2 text-amber-500" />
                Carregando conversas...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748b] space-y-2">
                <MessageCircle className="size-8 mx-auto text-[#cbd5e1]" />
                <p className="font-bold text-[#1c1c1e]">Nenhuma conversa encontrada</p>
                <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                  As mensagens enviadas pelo CRM (aniversários, recompra de 30 dias e avaliações)
                  aparecem agrupadas aqui por cliente.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const contact = conv.contact
                const last = conv.lastEvent
                const isSelected = activeContactId === conv.contactId
                const loyalty = contact ? getLoyaltyLevel(contact.purchase_count || 0) : null
                const category = getEventCategory(last)

                return (
                  <button
                    key={conv.contactId}
                    type="button"
                    onClick={() => handleSelectConversation(conv.contactId)}
                    className={cn(
                      'w-full text-left p-3.5 transition flex items-start gap-3 hover:bg-[#f8fafc]',
                      isSelected
                        ? 'bg-amber-50/70 border-l-3 border-amber-500 pl-2.5'
                        : 'border-l-3 border-transparent',
                    )}
                  >
                    {/* Avatar do cliente */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="size-9 rounded-full bg-amber-100 border border-amber-200 text-amber-900 grid place-items-center font-bold text-xs">
                        {(contact?.name || 'C').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-emerald-500 text-white text-[8px] border-2 border-white">
                        <MessageCircle className="size-2" />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[#1c1c1e] truncate">
                          {contact?.name || last.expand?.contact?.name || 'Cliente'}
                        </span>
                        <span className="font-mono text-[9px] text-[#94a3b8] shrink-0">
                          {relativeTime(last.created)}
                        </span>
                      </div>

                      {contact?.nickname && (
                        <p className="text-[10px] text-amber-800 truncate font-normal">
                          "{contact.nickname}"
                        </p>
                      )}

                      <p className="mt-1 text-[11px] text-[#475569] line-clamp-2 leading-relaxed">
                        {last.title}
                        {last.description ? ` · ${last.description}` : ''}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-[#94a3b8]">
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          {conv.totalMessages} {conv.totalMessages === 1 ? 'mensagem' : 'mensagens'}
                        </span>
                        {loyalty && (
                          <span
                            className={cn(
                              'text-[8px] font-bold px-1.5 py-0.2 rounded border',
                              loyalty.badgeColor,
                            )}
                          >
                            Nv.{loyalty.level}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Painel Direito: Linha do Tempo e Detalhes da Conversa do Cliente */}
        <main
          className={cn(
            'flex-1 min-h-0 flex-col bg-[#fafbfc]',
            activeContactId ? 'flex' : 'max-md:hidden flex',
          )}
        >
          {activeContact ? (
            <>
              {/* Header do Cliente na Conversa */}
              <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 py-3 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveContactId(null)}
                    className="md:hidden rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
                    title="Voltar para lista"
                  >
                    <ArrowLeft className="size-4" />
                  </button>

                  <div className="size-9 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-900 grid place-items-center font-bold text-xs shrink-0">
                    {(activeContact.name || 'C').slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-extrabold text-[#1c1c1e] truncate">
                        {activeContact.name}
                      </h2>
                      {activeContact.nickname && (
                        <span className="text-[11px] text-amber-800 font-medium hidden sm:inline">
                          ({activeContact.nickname})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#64748b] font-mono mt-0.5">
                      {activeContact.phone ? (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <Phone className="size-2.5" /> {activeContact.phone}
                        </span>
                      ) : (
                        <span className="text-amber-700">Sem telefone cadastrado</span>
                      )}
                      <span>·</span>
                      <span>{activeContact.purchase_count || 0} compras</span>
                      {activeContact.total_spent ? (
                        <>
                          <span>·</span>
                          <span>{money.format(activeContact.total_spent)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Ações da conversa */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Atalho wa.me direto */}
                  {activeContact.phone && (
                    <a
                      href={`https://wa.me/${activeContact.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                      title="Abrir conversa no WhatsApp Web"
                    >
                      <MessageCircle className="size-3" />
                      <span className="hidden sm:inline">Abrir Web</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  )}

                  {/* Botão de Ver Ficha Completa do Cliente */}
                  <button
                    type="button"
                    onClick={() => navigate(`/contatos?contact=${activeContact.id}`)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] hover:bg-[#f8fafc] transition shadow-2xs"
                  >
                    <User className="size-3" />
                    <span className="hidden sm:inline">Ficha</span>
                  </button>

                  {/* Disparar Mensagem Disney */}
                  <button
                    type="button"
                    onClick={() => handleOpenComposer(activeContact)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                  >
                    <Send className="size-3" />
                    <span>Escrever Mensagem</span>
                  </button>
                </div>
              </div>

              {/* Informações sensoriais / Disney do Cliente (Acolhimento) */}
              <div className="border-b border-[#e5e7eb] bg-amber-50/40 px-4 py-2 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 text-amber-950 font-medium">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-600" /> Preferências Disney:
                </span>
                {activeContact.favorite_coffee && (
                  <span>
                    Café: <strong>{activeContact.favorite_coffee}</strong>
                  </span>
                )}
                {activeContact.brew_method_preference && (
                  <span>
                    Método: <strong>{activeContact.brew_method_preference}</strong>
                  </span>
                )}
                {activeContact.roast_preference && (
                  <span>
                    Torra: <strong>{activeContact.roast_preference}</strong>
                  </span>
                )}
                {activeContact.dietary_restrictions && (
                  <span className="text-rose-800">
                    Restrições: <strong>{activeContact.dietary_restrictions}</strong>
                  </span>
                )}
              </div>

              {/* Linha do tempo das mensagens do cliente */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                {activeConversation?.events && activeConversation.events.length > 0 ? (
                  <div className="relative pl-5 sm:pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e2e8f0]">
                    {activeConversation.events.map((evt) => {
                      const isZapSent = evt.type === 'whatsapp_enviado'
                      const isZapFail = evt.type === 'whatsapp_falha'
                      const isCoupon = evt.type === 'cupom_aniversario'
                      const isReengagement = evt.type === 'reengajamento'
                      const isLevel = evt.type === 'nivel_alcancado'

                      let iconColor = 'border-emerald-500 text-emerald-600'
                      let cardBorder = 'border-[#e2e8f0]'
                      let badge = 'WhatsApp'

                      if (isCoupon) {
                        iconColor = 'border-rose-400 text-rose-600'
                        badge = '🎂 Aniversário'
                      } else if (isReengagement) {
                        iconColor = 'border-orange-400 text-orange-600'
                        badge = '☕ Recompra 30d'
                      } else if (isLevel) {
                        iconColor = 'border-purple-400 text-purple-600'
                        badge = '⭐ Fidelidade'
                      } else if (isZapFail) {
                        iconColor = 'border-amber-400 text-amber-600'
                        badge = 'Registro Manual / Link'
                      }

                      return (
                        <div key={evt.id} className="relative group flex gap-3 text-left">
                          {/* Marcador na linha */}
                          <span
                            className={cn(
                              'absolute -left-5 sm:-left-6 mt-0.5 grid size-6 place-items-center rounded-full border bg-white shadow-2xs',
                              iconColor,
                            )}
                          >
                            {isCoupon ? (
                              <Ticket className="size-3" />
                            ) : isReengagement ? (
                              <Clock className="size-3" />
                            ) : isLevel ? (
                              <Star className="size-3" />
                            ) : isZapFail ? (
                              <AlertCircle className="size-3" />
                            ) : (
                              <MessageCircle className="size-3" />
                            )}
                          </span>

                          {/* Card de Mensagem estilo balão Linear */}
                          <div
                            className={cn(
                              'min-w-0 flex-1 rounded-xl border bg-white p-4 shadow-2xs transition hover:border-[#cbd5e1]',
                              cardBorder,
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-[#f1f5f9] pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-[#1c1c1e]">
                                  {evt.title}
                                </span>
                                <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-mono text-[#475569]">
                                  {badge}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-[#94a3b8] shrink-0">
                                {datePt(evt.created)} · {relativeTime(evt.created)}
                              </span>
                            </div>

                            {evt.description && (
                              <div className="mt-2.5 rounded-lg bg-[#f8fafc] border border-[#eef2f6] p-3 text-xs leading-relaxed text-[#334155] whitespace-pre-line font-sans">
                                {evt.description}
                              </div>
                            )}

                            {/* Rodapé com detalhes de entrega e fallback */}
                            <div className="mt-3 flex items-center justify-between text-[10px] text-[#64748b]">
                              <span className="font-mono text-[9px]">
                                Canal: {evt.channel || 'whatsapp'}
                              </span>

                              {activeContact.phone && (
                                <a
                                  href={`https://wa.me/${activeContact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                    evt.description || evt.title,
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800"
                                >
                                  Reenviar no WhatsApp Web <ExternalLink className="size-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white p-8 text-center text-xs text-[#64748b] space-y-3">
                    <MessageCircle className="size-8 mx-auto text-[#94a3b8]" />
                    <div>
                      <p className="font-bold text-[#1c1c1e]">
                        Nenhuma mensagem registrada ainda para este cliente
                      </p>
                      <p className="text-[11px] text-[#94a3b8] mt-1 max-w-sm mx-auto">
                        Clique em "Escrever Mensagem" acima para disparar mensagens personalizadas
                        de aniversário, recompra em 30 dias ou novidades.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenComposer(activeContact)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                    >
                      <Plus className="size-3.5" /> Enviar Primeira Mensagem
                    </button>
                  </div>
                )}
              </div>

              {/* Barra de ação rápida inferior para responder/compor */}
              <div className="shrink-0 border-t border-[#e5e7eb] bg-white p-3 sm:px-6 flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#64748b] hidden sm:inline">
                  Deseja encantar este cliente agora?
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenComposer(activeContact, 'recorrencia')}
                    className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50/80 px-2.5 py-1 text-[11px] font-bold text-orange-900 hover:bg-orange-100 transition"
                  >
                    ☕ Recompra 30d
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenComposer(activeContact, 'aniversario')}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50/80 px-2.5 py-1 text-[11px] font-bold text-rose-900 hover:bg-rose-100 transition"
                  >
                    🎂 Aniversário
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenComposer(activeContact, 'personalizado')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                  >
                    <Send className="size-3" /> Escrever
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-[#64748b] space-y-3">
              <div className="size-12 rounded-full bg-emerald-50 border border-emerald-200 grid place-items-center text-emerald-600">
                <MessageCircle className="size-6" />
              </div>
              <h2 className="text-base font-bold text-[#1c1c1e]">
                Selecione uma conversa ou cliente
              </h2>
              <p className="text-[11px] text-[#94a3b8] max-w-sm leading-relaxed">
                Navegue pelas conversas de WhatsApp à esquerda para acompanhar os eventos enviados,
                ou clique em "Contatos" para iniciar uma nova jornada.
              </p>
              {contacts.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleOpenComposer(contacts[0])}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-600 transition"
                >
                  <Plus className="size-3.5" /> Enviar Mensagem para um Cliente
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modal Reusado de Envio de Mensagem WhatsApp no Estilo Disney */}
      <SendWhatsAppModal
        open={sendModalOpen}
        onClose={() => {
          setSendModalOpen(false)
          setTargetContact(null)
        }}
        contact={targetContact}
        initialMoment={initialMoment}
        couponCode={targetContact?.last_coupon_code}
        onSent={handleComposerSent}
      />
    </div>
  )
}
