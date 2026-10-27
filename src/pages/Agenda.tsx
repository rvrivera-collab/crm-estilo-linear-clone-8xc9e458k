import { useMemo, useState } from 'react'
import {
  Calendar as CalendarIcon,
  Cake,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  ExternalLink,
  Flame,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import { ContactDrawer } from '@/components/ContactDrawer'
import { ContactDialog } from '@/components/forms/ContactDialog'
import { AgendaEventDialog } from '@/components/forms/AgendaEventDialog'
import { AGENDA_TYPE_COLORS, AGENDA_TYPE_LABELS, updateAgendaEvent } from '@/services/crm'
import {
  datePt,
  getBirthdayInfo,
  getDaysSinceLastPurchase,
  getLoyaltyLevel,
  type AgendaEvent,
  type AgendaEventType,
  type Contact,
} from '@/types/crm'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Agenda() {
  const { agendaEvents, contacts, loading, refresh } = useCrm()
  const navigate = useNavigate()
  const { toast } = useToast()

  // Data atual do sistema
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => today.toISOString().slice(0, 10), [today])

  // Mês e ano navegados no calendário
  const [currentYear, setCurrentYear] = useState(() => today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => today.getMonth()) // 0-indexed

  // Dia selecionado (para ver a lista do dia ao lado)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr)

  // Filtro de tipo e busca rápida
  const [typeFilter, setTypeFilter] = useState<'todos' | AgendaEventType | 'aniversarios'>('todos')
  const [search, setSearch] = useState('')

  // Modais de Agenda e Contato
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null)
  const [presetModalDate, setPresetModalDate] = useState<string>(todayStr)

  // Drawer de visualização de contato
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null)
  const [contactEditOpen, setContactEditOpen] = useState(false)

  // Ações de navegação do calendário
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((prev) => prev - 1)
    } else {
      setCurrentMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((prev) => prev + 1)
    } else {
      setCurrentMonth((prev) => prev + 1)
    }
  }

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
    setSelectedDateStr(todayStr)
  }

  // Mapa de aniversários por MM-DD
  // Ex: "04-25" -> Array de Contatos
  const birthdaysMap = useMemo(() => {
    const map = new Map<string, Contact[]>()
    for (const c of contacts) {
      if (!c.birthday) continue
      try {
        const bdate = new Date(c.birthday)
        if (isNaN(bdate.getTime())) continue
        const mm = String(bdate.getUTCMonth() + 1).padStart(2, '0')
        const dd = String(bdate.getUTCDate()).padStart(2, '0')
        const key = `${mm}-${dd}`
        const existing = map.get(key) || []
        existing.push(c)
        map.set(key, existing)
      } catch {
        /* skip invalid */
      }
    }
    return map
  }, [contacts])

  // Mapa de eventos da agenda por YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>()
    for (const ev of agendaEvents) {
      if (!ev.date) continue
      const dStr = ev.date.slice(0, 10)
      const list = map.get(dStr) || []
      list.push(ev)
      map.set(dStr, list)
    }
    // Ordenar por hora e título
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time)
        if (a.time) return -1
        if (b.time) return 1
        return a.title.localeCompare(b.title)
      })
    }
    return map
  }, [agendaEvents])

  // 1. Grade do calendário mensal (dias anteriores do mês anterior + dias do mês + dias posteriores)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Domingo, 1 = Segunda...
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate()

    const days = []

    // Dias do mês anterior
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum)
      const y = prevDate.getFullYear()
      const m = String(prevDate.getMonth() + 1).padStart(2, '0')
      const d = String(dayNum).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      const mmdd = `${m}-${d}`
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        events: eventsByDate.get(dateStr) || [],
        birthdays: birthdaysMap.get(mmdd) || [],
      })
    }

    // Dias do mês atual
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const m = String(currentMonth + 1).padStart(2, '0')
      const d = String(dayNum).padStart(2, '0')
      const dateStr = `${currentYear}-${m}-${d}`
      const mmdd = `${m}-${d}`
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        events: eventsByDate.get(dateStr) || [],
        birthdays: birthdaysMap.get(mmdd) || [],
      })
    }

    // Dias do próximo mês para completar semanas cheias de 7 dias (até 35 ou 42 células)
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(currentYear, currentMonth + 1, i)
      const y = nextDate.getFullYear()
      const m = String(nextDate.getMonth() + 1).padStart(2, '0')
      const d = String(i).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      const mmdd = `${m}-${d}`
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        events: eventsByDate.get(dateStr) || [],
        birthdays: birthdaysMap.get(mmdd) || [],
      })
    }

    return days
  }, [currentYear, currentMonth, todayStr, eventsByDate, birthdaysMap])

  // 2. Eventos e Aniversários do Dia Selecionado
  const selectedDayData = useMemo(() => {
    const events = eventsByDate.get(selectedDateStr) || []
    const m = selectedDateStr.slice(5, 7)
    const d = selectedDateStr.slice(8, 10)
    const mmdd = `${m}-${d}`
    const birthdays = birthdaysMap.get(mmdd) || []
    return { events, birthdays }
  }, [selectedDateStr, eventsByDate, birthdaysMap])

  // 3. Painel "Próximos 7 Dias" (União de eventos da agenda + aniversariantes + clientes com 30+ dias sem compra)
  const next7DaysHighlights = useMemo(() => {
    const list: Array<{
      id: string
      dateStr: string
      title: string
      subtitle?: string
      kind: 'evento' | 'aniversario' | 'recorrencia'
      event?: AgendaEvent
      contact?: Contact
      isToday: boolean
      daysFromNow: number
    }> = []

    const nowDate = new Date()
    const todayMidnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())

    // A) Eventos da agenda nos próximos 7 dias
    agendaEvents.forEach((ev) => {
      if (!ev.date) return
      const d = new Date(ev.date)
      const evMidnight = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      const diffDays = Math.round(
        (evMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24),
      )
      if (diffDays >= 0 && diffDays <= 7) {
        const c = contacts.find((item) => item.id === ev.customer) || ev.expand?.customer
        list.push({
          id: `ev-${ev.id}`,
          dateStr: ev.date.slice(0, 10),
          title: ev.title,
          subtitle: `${ev.time ? `${ev.time} · ` : ''}${AGENDA_TYPE_LABELS[ev.type] || ev.type}${c ? ` · ${c.name}` : ''}`,
          kind: 'evento',
          event: ev,
          contact: c,
          isToday: diffDays === 0,
          daysFromNow: diffDays,
        })
      }
    })

    // B) Aniversariantes nos próximos 7 dias
    contacts.forEach((c) => {
      const bday = getBirthdayInfo(c.birthday)
      if (bday.isNext7Days && bday.daysUntil !== null) {
        list.push({
          id: `bday-${c.id}`,
          dateStr: '',
          title: `🎂 Aniversário: ${c.name}`,
          subtitle: bday.isToday
            ? 'Hoje é o grande dia!'
            : `Em ${bday.daysUntil} dias (${bday.formattedDate})`,
          kind: 'aniversario',
          contact: c,
          isToday: bday.isToday,
          daysFromNow: bday.daysUntil,
        })
      }
    })

    // C) Clientes com 30+ dias sem compra (recorrência)
    contacts.forEach((c) => {
      const daysSince = getDaysSinceLastPurchase(c.last_purchase_date)
      if (daysSince !== null && daysSince >= 30) {
        list.push({
          id: `rec-${c.id}`,
          dateStr: '',
          title: `☕ Retomada: ${c.name}`,
          subtitle: `${daysSince} dias sem comprar · Fidelidade: ${getLoyaltyLevel(c.purchase_count || 0).name}`,
          kind: 'recorrencia',
          contact: c,
          isToday: false,
          daysFromNow: 0,
        })
      }
    })

    // Ordenar: primeiro os mais próximos
    list.sort((a, b) => a.daysFromNow - b.daysFromNow)

    return list
  }, [agendaEvents, contacts])

  // Ação rápida: alternar status done do evento
  const handleToggleDone = async (ev: AgendaEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    const newDone = !ev.done
    try {
      await updateAgendaEvent(ev.id, { done: newDone })
      toast({
        title: newDone ? 'Compromisso concluído! 🎉' : 'Compromisso reaberto',
        description: `"${ev.title}" marcado como ${newDone ? 'concluído' : 'pendente'}.`,
      })
      await refresh()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
      })
    }
  }

  // Abrir modal de criação com data pré-selecionada
  const handleOpenCreateEvent = (dateStr?: string) => {
    setEditingEvent(null)
    setPresetModalDate(dateStr || selectedDateStr)
    setEventModalOpen(true)
  }

  // Abrir modal de edição
  const handleOpenEditEvent = (ev: AgendaEvent, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingEvent(ev)
    setEventModalOpen(true)
  }

  // Formatar texto da data selecionada em português
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateStr) return ''
    try {
      const [y, m, d] = selectedDateStr.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date)
    } catch {
      return selectedDateStr
    }
  }, [selectedDateStr])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* HEADER ESTILO LINEAR */}
      <div className="shrink-0 border-b border-[#e5e7eb] px-4 py-3.5 sm:px-6 bg-[#fafafa]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-700 font-bold">
                Rotina & Atendimento · Cafés Especiais
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                Linear View
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-.035em] text-[#1c1c1e] flex items-center gap-2">
              <CalendarIcon className="size-6 text-amber-600" />
              Agenda & Calendário
            </h1>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Acompanhe follow-ups, degustações presenciais, entregas de grãos frescos e
              aniversários da base.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              title="Recarregar eventos"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#475569] shadow-2xs hover:bg-[#f8fafc] transition"
            >
              <RefreshCw className="size-3.5" /> Atualizar
            </button>

            <button
              type="button"
              onClick={handleGoToday}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-bold text-[#1c1c1e] shadow-2xs hover:bg-[#f8fafc] transition"
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateEvent()}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition"
            >
              <Plus className="size-4" />
              Novo Compromisso
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DO MÊS E FILTROS */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-[#f1f5f9]">
          {/* Navegador de Mês */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-[#cbd5e1] bg-white shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Mês anterior"
                className="p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition rounded-l-md"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="px-3 text-xs font-bold text-[#1c1c1e] min-w-[130px] text-center select-none">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Próximo mês"
                className="p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition rounded-r-md"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Destaque rápido se o dia selecionado for diferente de hoje */}
            {selectedDateStr !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDateStr(todayStr)}
                className="text-[11px] font-semibold text-amber-700 hover:underline"
              >
                Ir para o dia selecionado de hoje
              </button>
            )}
          </div>

          {/* Filtros e Busca rápida */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1 text-xs font-semibold text-[#475569] shadow-2xs outline-none"
            >
              <option value="todos">Todos os tipos de evento</option>
              {(Object.keys(AGENDA_TYPE_LABELS) as AgendaEventType[]).map((t) => (
                <option key={t} value={t}>
                  {AGENDA_TYPE_LABELS[t]}
                </option>
              ))}
              <option value="aniversarios">🎂 Aniversariantes apenas</option>
            </select>

            <label className="flex h-7.5 items-center rounded-md border border-[#cbd5e1] bg-white px-2 shadow-2xs sm:w-56">
              <Search className="mr-1.5 size-3.5 text-[#94a3b8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar compromisso ou cliente..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-[#94a3b8] hover:text-[#1c1c1e]"
                >
                  <X className="size-3" />
                </button>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: DIVIDIDA EM CALENDÁRIO MENSAL + PAINEL LATERAL (LISTA DO DIA & PRÓXIMOS 7 DIAS) */}
      <div className="min-h-0 flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* LADO ESQUERDO: GRADE MENSAL ESTILO LINEAR */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col border-b lg:border-b-0 lg:border-r border-[#e5e7eb]">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 border-b border-[#e5e7eb] pb-2 text-center">
            {WEEKDAY_NAMES.map((w, idx) => (
              <div
                key={w}
                className={cn(
                  'text-[11px] font-bold uppercase tracking-wider',
                  idx === 0 || idx === 6 ? 'text-amber-800' : 'text-[#64748b]',
                )}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Grade dos dias do mês */}
          <div className="grid grid-cols-7 gap-px bg-[#e5e7eb] mt-1 rounded-lg overflow-hidden border border-[#e5e7eb] flex-1 min-h-[500px]">
            {calendarDays.map((cell) => {
              const isSelected = cell.dateStr === selectedDateStr
              // Filtragem dos eventos do dia
              const filteredEvents = cell.events.filter((ev) => {
                if (typeFilter !== 'todos' && typeFilter !== 'aniversarios') {
                  if (ev.type !== typeFilter) return false
                }
                if (typeFilter === 'aniversarios') return false
                if (search.trim()) {
                  const s = search.toLowerCase()
                  const customer = contacts.find((c) => c.id === ev.customer)
                  const matchTitle = ev.title.toLowerCase().includes(s)
                  const matchNotes = (ev.notes || '').toLowerCase().includes(s)
                  const matchCustomer = customer ? customer.name.toLowerCase().includes(s) : false
                  return matchTitle || matchNotes || matchCustomer
                }
                return true
              })

              const showBirthdays = typeFilter === 'todos' || typeFilter === 'aniversarios'
              const filteredBirthdays = showBirthdays
                ? cell.birthdays.filter((c) => {
                    if (search.trim()) {
                      return c.name.toLowerCase().includes(search.toLowerCase())
                    }
                    return true
                  })
                : []

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={cn(
                    'group relative flex flex-col bg-white p-1.5 sm:p-2 transition cursor-pointer min-h-[90px] sm:min-h-[110px]',
                    !cell.isCurrentMonth && 'bg-[#f8fafc] text-[#94a3b8]',
                    cell.isToday && 'bg-amber-50/40 ring-1 ring-inset ring-amber-400',
                    isSelected && 'ring-2 ring-inset ring-amber-500 z-10 bg-amber-50/20',
                    'hover:bg-[#f1f5f9]/70',
                  )}
                >
                  {/* Topo do dia: número do dia + botão de adicionar rápido */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full text-xs font-bold transition',
                        cell.isToday
                          ? 'bg-amber-500 text-white shadow-2xs font-extrabold'
                          : isSelected
                            ? 'bg-[#1c1c1e] text-white'
                            : cell.isCurrentMonth
                              ? 'text-[#1c1c1e]'
                              : 'text-[#94a3b8]',
                      )}
                    >
                      {cell.dayNum}
                    </span>

                    {/* Botão de + rápido no hover */}
                    <button
                      type="button"
                      title="Agendar neste dia"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenCreateEvent(cell.dateStr)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1c1c1e] transition"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  {/* Chips compactos dos Eventos no calendário (estilo Linear) */}
                  <div className="space-y-1 overflow-hidden flex-1">
                    {/* Aniversariantes do dia */}
                    {filteredBirthdays.map((c) => (
                      <div
                        key={`bday-${c.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDrawerContact(c)
                        }}
                        title={`Aniversariante: ${c.name} (clique para ver cliente)`}
                        className="truncate rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 hover:bg-rose-100 transition flex items-center gap-1 shadow-2xs"
                      >
                        <span className="shrink-0">🎂</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                    ))}

                    {/* Eventos normais da agenda */}
                    {filteredEvents.slice(0, 3).map((ev) => {
                      const colors = AGENDA_TYPE_COLORS[ev.type] || AGENDA_TYPE_COLORS.outro
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => handleOpenEditEvent(ev, e)}
                          title={`${ev.time ? `${ev.time} - ` : ''}${ev.title} (${AGENDA_TYPE_LABELS[ev.type] || ev.type})`}
                          className={cn(
                            'group/item truncate rounded border px-1.5 py-0.5 text-[10px] font-medium transition flex items-center justify-between gap-1 shadow-2xs',
                            colors.bg,
                            colors.border,
                            colors.text,
                            ev.done &&
                              'line-through opacity-60 border-slate-200 bg-slate-50 text-slate-500',
                          )}
                        >
                          <div className="flex items-center gap-1 truncate min-w-0">
                            <span className={cn('size-1.5 rounded-full shrink-0', colors.dot)} />
                            {ev.time && (
                              <span className="font-mono text-[9px] shrink-0 font-bold">
                                {ev.time}
                              </span>
                            )}
                            <span className="truncate">{ev.title}</span>
                          </div>
                          <button
                            type="button"
                            title={ev.done ? 'Reabrir' : 'Marcar concluído'}
                            onClick={(e) => handleToggleDone(ev, e)}
                            className="opacity-0 group-hover/item:opacity-100 shrink-0 text-slate-500 hover:text-emerald-600 transition"
                          >
                            <Check className="size-2.5" />
                          </button>
                        </div>
                      )
                    })}

                    {/* Indicador de mais eventos se passar de 3 */}
                    {filteredEvents.length > 3 && (
                      <div className="text-[9px] font-bold text-[#64748b] text-center">
                        +{filteredEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* LADO DIREITO: AGENDA DO DIA SELECIONADO & PAINEL PRÓXIMOS 7 DIAS */}
        <div className="w-full lg:w-88 shrink-0 flex flex-col bg-[#fafafa] overflow-y-auto">
          {/* SEÇÃO 1: AGENDA DO DIA SELECIONADO */}
          <div className="p-4 border-b border-[#e5e7eb] bg-white">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-amber-700 tracking-wider">
                  Agenda do Dia
                </span>
                <h2 className="text-base font-bold text-[#1c1c1e] capitalize">
                  {selectedDateFormatted}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => handleOpenCreateEvent(selectedDateStr)}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-600 transition shadow-2xs"
              >
                <Plus className="size-3.5" /> Adicionar
              </button>
            </div>

            {/* Lista de eventos do dia selecionado */}
            <div className="mt-3 space-y-2">
              {/* Aniversariantes do dia */}
              {selectedDayData.birthdays.map((c) => (
                <div
                  key={`bday-detail-${c.id}`}
                  onClick={() => setDrawerContact(c)}
                  className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 shadow-2xs transition hover:border-rose-300 cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎂</span>
                      <div>
                        <h4 className="text-xs font-bold text-rose-950 hover:underline">
                          {c.name}
                        </h4>
                        <p className="text-[10px] text-rose-700">
                          {c.phone || c.email || 'Cliente cadastrado'}
                        </p>
                      </div>
                    </div>
                    <span className="rounded bg-rose-200/70 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-900">
                      Aniversário
                    </span>
                  </div>
                  {c.favorite_coffee && (
                    <p className="mt-1.5 text-[11px] text-amber-900 flex items-center gap-1">
                      <Coffee className="size-3 text-amber-700 shrink-0" />
                      <span>Gosta de: {c.favorite_coffee}</span>
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-rose-800 font-medium">
                    <span>Clique para abrir perfil / cupom</span>
                    <ExternalLink className="size-3" />
                  </div>
                </div>
              ))}

              {/* Eventos da agenda no dia selecionado */}
              {selectedDayData.events.length === 0 && selectedDayData.birthdays.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#cbd5e1] p-5 text-center text-xs text-[#94a3b8]">
                  Nenhum compromisso ou aniversário agendado para este dia.
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCreateEvent(selectedDateStr)}
                      className="text-amber-700 font-bold hover:underline"
                    >
                      + Agendar um compromisso agora
                    </button>
                  </div>
                </div>
              ) : (
                selectedDayData.events.map((ev) => {
                  const colors = AGENDA_TYPE_COLORS[ev.type] || AGENDA_TYPE_COLORS.outro
                  const customer = contacts.find((c) => c.id === ev.customer) || ev.expand?.customer

                  return (
                    <div
                      key={ev.id}
                      onClick={() => handleOpenEditEvent(ev)}
                      className={cn(
                        'rounded-lg border p-3 shadow-2xs transition hover:border-[#cbd5e1] cursor-pointer bg-white flex flex-col justify-between',
                        ev.done ? 'border-[#e2e8f0] opacity-75 bg-[#f8fafc]' : 'border-[#cbd5e1]',
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => handleToggleDone(ev, e)}
                              className={cn(
                                'mt-0.5 size-4 rounded border flex items-center justify-center transition shrink-0',
                                ev.done
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-[#94a3b8] hover:border-amber-600',
                              )}
                              title={ev.done ? 'Marcar como pendente' : 'Marcar como concluído'}
                            >
                              {ev.done && <Check className="size-3" />}
                            </button>
                            <div className="min-w-0">
                              <h4
                                className={cn(
                                  'text-xs font-bold text-[#1c1c1e] truncate',
                                  ev.done && 'line-through text-[#64748b]',
                                )}
                              >
                                {ev.title}
                              </h4>
                              {customer && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDrawerContact(customer)
                                  }}
                                  className="text-[11px] font-semibold text-amber-700 hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  <User className="size-3" />
                                  <span>{customer.name}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <span
                            className={cn(
                              'shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border',
                              colors.bg,
                              colors.border,
                              colors.text,
                            )}
                          >
                            {AGENDA_TYPE_LABELS[ev.type] || ev.type}
                          </span>
                        </div>

                        {ev.time && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-mono text-[#64748b]">
                            <Clock className="size-3 text-amber-600" />
                            <span>{ev.time}</span>
                          </div>
                        )}

                        {ev.notes && (
                          <p className="mt-1.5 text-[11px] text-[#475569] line-clamp-2 italic">
                            "{ev.notes}"
                          </p>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] text-[#94a3b8]">
                        <span>{ev.done ? 'Concluído ✓' : 'Pendente'}</span>
                        <span className="text-amber-700 font-semibold hover:underline">
                          Editar / Excluir →
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* SEÇÃO 2: PAINEL "PRÓXIMOS 7 DIAS" (União de eventos + aniversariantes + retenção 30d+) */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-600" />
                <h3 className="text-xs font-bold text-[#1c1c1e] uppercase tracking-wider">
                  Próximos 7 Dias & Retenção
                </h3>
              </div>
              <span className="font-mono text-[10px] text-[#64748b]">
                {next7DaysHighlights.length} alerta(s)
              </span>
            </div>

            <p className="text-[11px] text-[#64748b] mb-3">
              Visão 360° unindo compromissos da agenda, aniversários e clientes que precisam de
              recompra.
            </p>

            <div className="space-y-2">
              {next7DaysHighlights.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.kind === 'evento' && item.event) {
                      handleOpenEditEvent(item.event)
                    } else if (item.contact) {
                      setDrawerContact(item.contact)
                    }
                  }}
                  className={cn(
                    'rounded-lg border p-2.5 shadow-2xs transition hover:border-[#cbd5e1] cursor-pointer bg-white text-xs',
                    item.kind === 'aniversario' && 'border-rose-200 bg-rose-50/40',
                    item.kind === 'recorrencia' && 'border-orange-200 bg-orange-50/40',
                    item.kind === 'evento' && 'border-blue-200 bg-blue-50/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <h5 className="font-bold text-[#1c1c1e] truncate">{item.title}</h5>
                    <span
                      className={cn(
                        'shrink-0 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono',
                        item.kind === 'aniversario' && 'bg-rose-100 text-rose-800',
                        item.kind === 'recorrencia' && 'bg-orange-100 text-orange-800',
                        item.kind === 'evento' && 'bg-blue-100 text-blue-800',
                      )}
                    >
                      {item.isToday
                        ? 'Hoje!'
                        : item.daysFromNow === 0
                          ? '30d+ sem compra'
                          : `Em ${item.daysFromNow}d`}
                    </span>
                  </div>
                  {item.subtitle && (
                    <p className="text-[10px] text-[#64748b] mt-0.5 truncate">{item.subtitle}</p>
                  )}
                </div>
              ))}

              {next7DaysHighlights.length === 0 && (
                <div className="rounded border border-dashed border-[#cbd5e1] p-3 text-center text-[11px] text-[#94a3b8]">
                  Tudo em dia! Sem compromissos ou retenções urgentes para a semana.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE COMPROMISSO NA AGENDA */}
      <AgendaEventDialog
        open={eventModalOpen}
        onOpenChange={setEventModalOpen}
        event={editingEvent}
        presetDate={presetModalDate}
      />

      {/* DRAWER DE DETALHES DO CLIENTE (aberto ao clicar no chip de aniversário) */}
      <ContactDrawer
        contact={drawerContact}
        onClose={() => setDrawerContact(null)}
        onEdit={(c) => {
          setDrawerContact(null)
          setContactEditOpen(true)
        }}
      />

      {/* MODAL DE EDIÇÃO DE CONTATO */}
      <ContactDialog
        open={contactEditOpen}
        onOpenChange={setContactEditOpen}
        contact={drawerContact}
      />
    </div>
  )
}
