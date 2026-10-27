import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { AGENDA_TYPE_COLORS } from '@/services/crm'
import type { AgendaEvent, AgendaEventType, Contact } from '@/types/crm'
import { cn } from '@/lib/utils'

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

const MINI_WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface AgendaAnnualViewProps {
  year: number
  onYearChange: (year: number) => void
  selectedDateStr: string
  onSelectDate: (dateStr: string) => void
  onDoubleClickDate?: (dateStr: string) => void
  eventsByDate: Map<string, AgendaEvent[]>
  birthdaysMap: Map<string, Contact[]>
  typeFilter: 'todos' | AgendaEventType | 'aniversarios'
  searchQuery?: string
  todayStr: string
}

interface MiniMonthDay {
  dateStr: string
  dayNum: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  events: AgendaEvent[]
  birthdays: Contact[]
}

export function AgendaAnnualView({
  year,
  onYearChange,
  selectedDateStr,
  onSelectDate,
  onDoubleClickDate,
  eventsByDate,
  birthdaysMap,
  typeFilter,
  searchQuery = '',
  todayStr,
}: AgendaAnnualViewProps) {
  // Gera os dados para cada um dos 12 meses do ano selecionado
  const monthsData = useMemo(() => {
    return MONTH_NAMES.map((monthName, monthIndex) => {
      const firstDayOfMonth = new Date(year, monthIndex, 1)
      const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Domingo
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
      const daysInPrevMonth = new Date(year, monthIndex, 0).getDate()

      const days: MiniMonthDay[] = []

      // Dias do mês anterior para completar o alinhamento
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i
        const prevDate = new Date(year, monthIndex - 1, dayNum)
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
          isSelected: dateStr === selectedDateStr,
          events: eventsByDate.get(dateStr) || [],
          birthdays: birthdaysMap.get(mmdd) || [],
        })
      }

      // Dias do mês atual
      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const m = String(monthIndex + 1).padStart(2, '0')
        const d = String(dayNum).padStart(2, '0')
        const dateStr = `${year}-${m}-${d}`
        const mmdd = `${m}-${d}`

        days.push({
          dateStr,
          dayNum,
          isCurrentMonth: true,
          isToday: dateStr === todayStr,
          isSelected: dateStr === selectedDateStr,
          events: eventsByDate.get(dateStr) || [],
          birthdays: birthdaysMap.get(mmdd) || [],
        })
      }

      // Preenche os dias restantes da última semana (grid 7 colunas)
      const remainder = (7 - (days.length % 7)) % 7
      for (let i = 1; i <= remainder; i++) {
        const nextDate = new Date(year, monthIndex + 1, i)
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
          isSelected: dateStr === selectedDateStr,
          events: eventsByDate.get(dateStr) || [],
          birthdays: birthdaysMap.get(mmdd) || [],
        })
      }

      // Contagem total de compromissos e aniversários no mês
      let totalMonthEvents = 0
      let totalMonthBirthdays = 0
      days.forEach((d) => {
        if (d.isCurrentMonth) {
          totalMonthEvents += d.events.length
          totalMonthBirthdays += d.birthdays.length
        }
      })

      return {
        monthIndex,
        monthName,
        days,
        totalMonthEvents,
        totalMonthBirthdays,
      }
    })
  }, [year, todayStr, selectedDateStr, eventsByDate, birthdaysMap])

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de controle de Ano estilo Linear */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-[#cbd5e1] bg-white shadow-2xs">
            <button
              type="button"
              onClick={() => onYearChange(year - 1)}
              title="Ano anterior"
              className="p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition rounded-l-md"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="px-4 text-sm font-extrabold text-[#1c1c1e] min-w-[90px] text-center select-none font-mono">
              {year}
            </div>
            <button
              type="button"
              onClick={() => onYearChange(year + 1)}
              title="Próximo ano"
              className="p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition rounded-r-md"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onYearChange(new Date().getFullYear())}
            className="text-xs font-semibold text-[#475569] hover:text-amber-700 rounded-md border border-[#cbd5e1] px-2.5 py-1.5 hover:bg-[#f8fafc] transition"
          >
            Ano Atual
          </button>
        </div>

        {/* Legenda visual dos marcadores */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748b]">
          <span className="font-semibold text-[#334155]">Legenda:</span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
            <span>Hoje</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-purple-600" />
            <span>Lembretes</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-blue-500" />
            <span>Follow-up</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-600" />
            <span>Degustação</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-600" />
            <span>Entrega</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-rose-500" />
            <span>Aniversário</span>
          </span>
        </div>
      </div>

      {/* Grade de 12 meses (3 colunas em lg, 2 em md, 1 em telas pequenas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {monthsData.map((m) => {
          const isCurrentMonthOfSystem =
            new Date().getFullYear() === year && new Date().getMonth() === m.monthIndex

          return (
            <div
              key={m.monthIndex}
              className={cn(
                'rounded-lg border bg-white p-3 shadow-2xs transition hover:border-[#cbd5e1] flex flex-col',
                isCurrentMonthOfSystem
                  ? 'border-amber-300 ring-1 ring-amber-200'
                  : 'border-[#e5e7eb]',
              )}
            >
              {/* Header do mini mês */}
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-extrabold text-[#1c1c1e] uppercase tracking-wider">
                    {m.monthName}
                  </h3>
                  {isCurrentMonthOfSystem && (
                    <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                      Mês atual
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#64748b]">
                  {m.totalMonthEvents > 0 && (
                    <span
                      title={`${m.totalMonthEvents} compromissos no mês`}
                      className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700"
                    >
                      {m.totalMonthEvents} ev
                    </span>
                  )}
                  {m.totalMonthBirthdays > 0 && (
                    <span
                      title={`${m.totalMonthBirthdays} aniversariantes no mês`}
                      className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-800"
                    >
                      🎂 {m.totalMonthBirthdays}
                    </span>
                  )}
                </div>
              </div>

              {/* Dias da semana em formato mini */}
              <div className="grid grid-cols-7 text-center mb-1">
                {MINI_WEEKDAYS.map((w, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'text-[9px] font-bold font-mono',
                      idx === 0 || idx === 6 ? 'text-amber-800' : 'text-[#94a3b8]',
                    )}
                  >
                    {w}
                  </span>
                ))}
              </div>

              {/* Grade dos dias do mini mês */}
              <div className="grid grid-cols-7 gap-1">
                {m.days.map((cell) => {
                  // Filtra eventos conforme tipo e busca
                  const filteredEvents = cell.events.filter((ev) => {
                    if (typeFilter !== 'todos' && typeFilter !== 'aniversarios') {
                      if (ev.type !== typeFilter) return false
                    }
                    if (typeFilter === 'aniversarios') return false
                    if (searchQuery.trim()) {
                      const s = searchQuery.toLowerCase()
                      const matchTitle = ev.title.toLowerCase().includes(s)
                      const matchNotes = (ev.notes || '').toLowerCase().includes(s)
                      return matchTitle || matchNotes
                    }
                    return true
                  })

                  const showBirthdays =
                    (typeFilter === 'todos' || typeFilter === 'aniversarios') &&
                    cell.birthdays.length > 0

                  const hasItems = filteredEvents.length > 0 || showBirthdays
                  const isSelected = cell.dateStr === selectedDateStr

                  // Coleta cores dos dots de eventos (máximo 3 dots para não estourar a célula)
                  const dots: Array<{ key: string; color: string; title: string }> = []

                  filteredEvents.slice(0, 2).forEach((ev) => {
                    const c = AGENDA_TYPE_COLORS[ev.type] || AGENDA_TYPE_COLORS.outro
                    dots.push({
                      key: `ev-${ev.id}`,
                      color: c.dot,
                      title: `${ev.time ? `${ev.time} - ` : ''}${ev.title}`,
                    })
                  })

                  if (showBirthdays) {
                    dots.push({
                      key: `bday-${cell.dateStr}`,
                      color: 'bg-rose-500',
                      title: `🎂 Aniversariante: ${cell.birthdays.map((b) => b.name).join(', ')}`,
                    })
                  }

                  const tooltip = [
                    `${cell.dayNum} de ${m.monthName}`,
                    cell.isToday ? '(Hoje)' : '',
                    filteredEvents.length > 0 ? `• ${filteredEvents.length} evento(s)` : '',
                    cell.birthdays.length > 0
                      ? `• 🎂 ${cell.birthdays.map((b) => b.name).join(', ')}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      title={tooltip}
                      onClick={() => onSelectDate(cell.dateStr)}
                      onDoubleClick={() => onDoubleClickDate?.(cell.dateStr)}
                      className={cn(
                        'group relative flex flex-col items-center justify-between rounded py-1 px-0.5 text-center transition min-h-[34px]',
                        !cell.isCurrentMonth && 'opacity-25 hover:opacity-70',
                        cell.isToday &&
                          'bg-amber-100 font-extrabold text-amber-900 ring-1 ring-amber-400',
                        isSelected &&
                          'bg-[#1c1c1e] text-white ring-2 ring-amber-500 z-10 shadow-xs',
                        !cell.isToday && !isSelected && 'hover:bg-[#f1f5f9]',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[10px] leading-none font-semibold',
                          cell.isToday && !isSelected && 'text-amber-900 font-bold',
                          isSelected && 'text-white font-bold',
                          !cell.isToday && !isSelected && 'text-[#334155]',
                        )}
                      >
                        {cell.dayNum}
                      </span>

                      {/* Dots coloridos por evento / aniversário */}
                      <div className="flex items-center justify-center gap-0.5 h-1.5 mt-0.5">
                        {dots.map((d) => (
                          <span
                            key={d.key}
                            title={d.title}
                            className={cn('size-1 rounded-full shrink-0', d.color)}
                          />
                        ))}
                        {filteredEvents.length > 2 && (
                          <span
                            className={cn(
                              'size-1 rounded-full shrink-0',
                              isSelected ? 'bg-amber-300' : 'bg-slate-400',
                            )}
                          />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
