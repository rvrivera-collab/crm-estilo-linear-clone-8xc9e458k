import { useMemo, useState } from 'react'
import {
  Award,
  Cake,
  Calendar,
  Clock,
  Coffee,
  Crown,
  Flame,
  HeartHandshake,
  MessageCircle,
  Search,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  datePt,
  getCustomerJourneyStage,
  getDaysSinceLastPurchase,
  getLoyaltyLevel,
  initials,
  money,
  type Contact,
  type CustomerJourneyStage,
  type CustomerJourneyStageInfo,
} from '@/types/crm'
import { cn } from '@/lib/utils'

interface JourneyKanbanBoardProps {
  contacts: Contact[]
  onSelectContact?: (contact: Contact) => void
  onQuickWhatsApp?: (
    contact: Contact,
    moment: 'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado',
  ) => void
}

const STAGE_ORDER: {
  key: CustomerJourneyStage
  label: string
  subtitle: string
  icon: typeof Sparkles
  headerBg: string
  borderAccent: string
  badgeBg: string
  textColor: string
  columnBg: string
}[] = [
  {
    key: 'novo',
    label: 'Novos & Boas-Vindas',
    subtitle: 'Primeira impressão Disney · Apresentar método e grãos',
    icon: Sparkles,
    headerBg: 'bg-[#edf4fd]',
    borderAccent: 'border-[#cce0f5]',
    badgeBg: 'bg-blue-100 text-blue-900 border border-blue-300',
    textColor: 'text-[#1d4f8f]',
    columnBg: 'bg-[#f4f8fd]',
  },
  {
    key: 'ativo',
    label: 'Ativos & Recorrentes',
    subtitle: 'Compras regulares nos últimos 30 dias',
    icon: HeartHandshake,
    headerBg: 'bg-[#ecf7f1]',
    borderAccent: 'border-[#c4e8d8]',
    badgeBg: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    textColor: 'text-[#126343]',
    columnBg: 'bg-[#f2f9f5]',
  },
  {
    key: 'em_risco',
    label: 'Em Risco / Vencendo',
    subtitle: '30 a 59 dias sem comprar · Grãos acabando',
    icon: Clock,
    headerBg: 'bg-[#fbf4eb]',
    borderAccent: 'border-[#ecdcc6]',
    badgeBg: 'bg-amber-100 text-amber-900 border border-amber-300',
    textColor: 'text-[#693910]',
    columnBg: 'bg-[#faf2ea]',
  },
  {
    key: 'reengajamento',
    label: 'Reengajamento Urgente',
    subtitle: '60+ dias sem comprar · Resgate com carinho e cupom',
    icon: Flame,
    headerBg: 'bg-[#faecec]',
    borderAccent: 'border-[#f5c7c7]',
    badgeBg: 'bg-rose-100 text-rose-900 border border-rose-300',
    textColor: 'text-[#8c1d1d]',
    columnBg: 'bg-[#fdf5f5]',
  },
  {
    key: 'fa_incentivador',
    label: 'Fãs & Embaixadores VIP',
    subtitle: 'Nível 3+ (20+ compras) · Amantes do café especial',
    icon: Crown,
    headerBg: 'bg-[#f4effc]',
    borderAccent: 'border-[#dfd0f7]',
    badgeBg: 'bg-purple-100 text-purple-900 border border-purple-300',
    textColor: 'text-[#552796]',
    columnBg: 'bg-[#f9f5fd]',
  },
]

export function JourneyKanbanBoard({
  contacts,
  onSelectContact,
  onQuickWhatsApp,
}: JourneyKanbanBoardProps) {
  const navigate = useNavigate()
  const [filterQuery, setFilterQuery] = useState('')

  // Agrupar contatos por estágio da jornada
  const groupedContacts = useMemo(() => {
    const map: Record<CustomerJourneyStage, Contact[]> = {
      novo: [],
      ativo: [],
      em_risco: [],
      reengajamento: [],
      fa_incentivador: [],
    }

    contacts.forEach((contact) => {
      const q = filterQuery.toLowerCase()
      const matches =
        !q ||
        `${contact.name} ${contact.email} ${contact.phone} ${contact.favorite_coffee || ''} ${contact.nickname || ''}`
          .toLowerCase()
          .includes(q)

      if (matches) {
        const stageInfo = getCustomerJourneyStage(contact)
        map[stageInfo.stage].push(contact)
      }
    })

    return map
  }, [contacts, filterQuery])

  return (
    <div className="flex flex-col h-full bg-[#f4ede3]">
      {/* Barra de cabeçalho do Quadro de Jornada */}
      <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#ded2c3] bg-[#fbf9f5] px-4 py-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
              Visão do Todo · Experiência Disney
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-[#693910]">
              <Users className="size-3" /> {contacts.length} clientes na jornada
            </span>
          </div>
          <h2 className="mt-0.5 text-base font-extrabold text-[#2b1c13] tracking-tight">
            Quadro Geral da Jornada do Cliente
          </h2>
          <p className="text-[11px] text-[#705e4d]">
            Acompanhe onde cada apreciador está na sua experiência com colunas claramente
            diferenciadas em tons de café e âmbar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex h-8 w-64 items-center rounded-md border border-[#d6c7b6] bg-white px-2.5 shadow-2xs">
            <Search className="mr-2 size-3.5 text-[#8c7865]" />
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrar por nome, apelido, café..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#2b1c13] outline-none placeholder:text-[#9c8978]"
            />
          </label>
        </div>
      </div>

      {/* Colunas do Kanban da Jornada (touch scroll horizontal fluído) */}
      <div className="flex-1 min-h-0 overflow-x-auto p-3 sm:p-4 touch-pan-x bg-[#ede4d8]">
        <div className="flex gap-3.5 h-full min-w-[1100px] sm:min-w-[1280px]">
          {STAGE_ORDER.map((stage) => {
            const Icon = stage.icon
            const stageList = groupedContacts[stage.key] || []

            return (
              <div
                key={stage.key}
                className={cn(
                  'flex flex-col w-[250px] sm:w-[265px] lg:w-[285px] shrink-0 rounded-lg border shadow-xs transition-colors',
                  stage.columnBg,
                  stage.borderAccent,
                )}
              >
                {/* Header da Coluna */}
                <div
                  className={cn('p-3 border-b rounded-t-lg', stage.headerBg, stage.borderAccent)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn('size-4', stage.textColor)} />
                      <span className={cn('text-xs font-bold truncate', stage.textColor)}>
                        {stage.label}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-mono font-bold',
                        stage.badgeBg,
                      )}
                    >
                      {stageList.length}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#64748b] leading-tight line-clamp-2">
                    {stage.subtitle}
                  </p>
                </div>

                {/* Lista de Clientes nesta Coluna */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 bg-black/[0.015]">
                  {stageList.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-[#8c7865] border border-dashed border-[#d8c8b6] rounded-md my-2 bg-white/40">
                      Nenhum cliente neste estágio
                    </div>
                  ) : (
                    stageList.map((contact) => {
                      const loyalty = getLoyaltyLevel(contact.purchase_count || 0)
                      const daysSince = getDaysSinceLastPurchase(contact.last_purchase_date)

                      return (
                        <div
                          key={contact.id}
                          className="group rounded-md border border-[#ded2c3] bg-white p-2.5 shadow-2xs hover:border-[#bda895] hover:shadow-xs transition flex flex-col justify-between"
                        >
                          <div>
                            {/* Linha 1: Nome, Apelido e Nível */}
                            <div className="flex items-start justify-between gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onSelectContact) onSelectContact(contact)
                                  else navigate(`/contatos?contact=${contact.id}`)
                                }}
                                className="text-left font-bold text-xs text-[#1c1c1e] group-hover:text-amber-700 transition truncate flex-1 block"
                              >
                                {contact.name}
                                {contact.nickname && (
                                  <span className="block text-[10px] font-normal text-amber-800">
                                    "{contact.nickname}"
                                  </span>
                                )}
                              </button>
                              <span
                                className={cn(
                                  'shrink-0 text-[8px] font-bold px-1.5 py-0.2 rounded border',
                                  loyalty.badgeColor,
                                )}
                                title={loyalty.name}
                              >
                                Nv.{loyalty.level}
                              </span>
                            </div>

                            {/* Linha 2: Detalhes sensoriais Disney */}
                            {(contact.favorite_coffee ||
                              contact.roast_preference ||
                              contact.brew_method_preference) && (
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-900 bg-amber-50/60 rounded px-1.5 py-0.5 truncate">
                                <Coffee className="size-2.5 text-amber-700 shrink-0" />
                                <span className="truncate">
                                  {contact.favorite_coffee ||
                                    `${contact.roast_preference || ''} ${contact.brew_method_preference || ''}`}
                                </span>
                              </div>
                            )}

                            {/* Linha 3: Métricas de compras e última visita */}
                            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                              <span>
                                {contact.purchase_count || 0} compras (
                                {money.format(contact.total_spent || 0)})
                              </span>
                              <span>
                                {daysSince !== null ? `${daysSince}d atrás` : 'Sem compras'}
                              </span>
                            </div>
                          </div>

                          {/* Ações rápidas no rodapé do card */}
                          <div className="mt-2.5 pt-2 border-t border-[#f1f5f9] flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectContact) onSelectContact(contact)
                                else navigate(`/contatos?contact=${contact.id}`)
                              }}
                              className="text-[10px] font-semibold text-[#64748b] hover:text-[#1c1c1e]"
                            >
                              Ver jornada
                            </button>

                            {onQuickWhatsApp && (
                              <button
                                type="button"
                                title="Enviar mensagem calorosa Disney via WhatsApp"
                                onClick={() => {
                                  const moment =
                                    stage.key === 'reengajamento' || stage.key === 'em_risco'
                                      ? 'recorrencia'
                                      : stage.key === 'fa_incentivador'
                                        ? 'nivel_fidelidade'
                                        : 'personalizado'
                                  onQuickWhatsApp(contact, moment)
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition"
                              >
                                <MessageCircle className="size-3 text-emerald-600" />
                                WhatsApp
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
