import type { RecordModel } from 'pocketbase'

export type MetricAggregationType =
  | 'count_deals'
  | 'sum_value'
  | 'avg_value'
  | 'win_rate'
  | 'ticket_medio'
  | 'won_deals'
  | 'lost_deals'

export interface CustomMetric extends RecordModel {
  name: string
  aggregation: MetricAggregationType
  stage?: string
  status?: 'aberto' | 'ganho' | 'perdido'
  order: number
  owner?: string
  expand?: {
    stage?: Stage
    owner?: UserRecord
  }
}

export interface UserRecord extends RecordModel {
  name: string
  email: string
  avatar: string
  role: 'admin' | 'member'
  verified: boolean
  tour_seen_pages?: string[]
  tour_disabled?: boolean
}

export interface Stage extends RecordModel {
  name: string
  color: string
  order: number
}

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'phone'
  | 'email'
  | 'select'
  | 'checkbox'

export interface CustomFieldConfig {
  id: string
  label: string
  type: CustomFieldType
  required: boolean
  placeholder?: string
  options?: string[] // Usado quando type === 'select'
}

export type EmpresaSize = 'pequena' | 'média' | 'grande'

export interface Empresa extends RecordModel {
  name: string
  sector?: string
  size?: EmpresaSize
  website?: string
  phone?: string
  email?: string
  notes?: string
  owner: string
  expand?: {
    owner?: UserRecord
  }
}

export interface LoyaltyLevelInfo {
  level: number
  name: string
  badgeColor: string
  minPurchases: number
  maxPurchases: number
  nextThreshold: number
  remainingToNext: number
  progressPct: number
  reward: string
  description: string
}

/**
 * Programa de Fidelidade São Domingos — 10 níveis oficiais.
 * O cliente atinge o nível quando as compras acumuladas >= threshold (minPurchases).
 * 0–9 compras = ainda sem nível. Pode pular níveis (ex.: 35 compras → Nível 3).
 * REGRAS: recompensas são INTERNAS (só dentro do CRM, nunca em mensagens ao cliente).
 */
export const LOYALTY_LEVELS: Array<{
  level: number
  minPurchases: number
  name: string
  reward: string
  badgeColor: string
  description: string
}> = [
  {
    level: 1,
    minPurchases: 10,
    name: 'Semente Energética',
    reward: '1 café de 250g',
    badgeColor: 'border-amber-700/30 bg-amber-800/10 text-amber-900',
    description: 'Atingido a partir de 10 compras — primeira muda da jornada',
  },
  {
    level: 2,
    minPurchases: 20,
    name: 'Mudinha de CAFÉÉÉÉ',
    reward: '1 drip coffee',
    badgeColor: 'border-orange-600/30 bg-orange-600/10 text-orange-800',
    description: 'Atingido a partir de 20 compras',
  },
  {
    level: 3,
    minPurchases: 30,
    name: 'Doce Grão de Cereja',
    reward: '1 cápsula Nespresso',
    badgeColor: 'border-amber-600/30 bg-amber-500/15 text-amber-800',
    description: 'Atingido a partir de 30 compras',
  },
  {
    level: 4,
    minPurchases: 40,
    name: 'Catuaí Amarelo',
    reward: 'Caneta + chaveiro São Domingos',
    badgeColor: 'border-yellow-600/30 bg-yellow-500/10 text-yellow-800',
    description: 'Atingido a partir de 40 compras',
  },
  {
    level: 5,
    minPurchases: 50,
    name: 'Topázio',
    reward: 'Caneca São Domingos',
    badgeColor: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-800',
    description: 'Atingido a partir de 50 compras',
  },
  {
    level: 6,
    minPurchases: 60,
    name: 'Graúna Bordô',
    reward: '1 café de 500g',
    badgeColor: 'border-rose-600/30 bg-rose-600/10 text-rose-800',
    description: 'Atingido a partir de 60 compras',
  },
  {
    level: 7,
    minPurchases: 70,
    name: 'Jatobá Secreto',
    reward: '1 café, drip e cápsula',
    badgeColor: 'border-red-700/30 bg-red-700/10 text-red-800',
    description: 'Atingido a partir de 70 compras',
  },
  {
    level: 8,
    minPurchases: 80,
    name: 'Arara da SD',
    reward: 'Camisa São Domingos',
    badgeColor: 'border-sky-600/30 bg-sky-600/10 text-sky-800',
    description: 'Atingido a partir de 80 compras',
  },
  {
    level: 9,
    minPurchases: 90,
    name: 'Geisha Brasileño',
    reward: 'Garrafa de água personalizada São Domingos',
    badgeColor: 'border-violet-600/30 bg-violet-600/10 text-violet-800',
    description: 'Atingido a partir de 90 compras',
  },
  {
    level: 10,
    minPurchases: 100,
    name: 'Embaixador São Domingos',
    reward: 'Caneca embaixador personalizada + uma tarde de visita e café na fazenda São Domingos',
    badgeColor: 'border-purple-600/30 bg-purple-600/10 text-purple-800',
    description: 'Nível máximo — atingido a partir de 100 compras',
  },
]

export const MAX_LOYALTY_LEVEL = LOYALTY_LEVELS[LOYALTY_LEVELS.length - 1].level

export interface Purchase extends RecordModel {
  contact: string
  owner: string
  amount: number
  purchase_date: string
  items_description?: string
  notes?: string
  expand?: {
    contact?: Contact
    owner?: UserRecord
  }
}

export type OrderStage =
  | 'pedido_feito'
  | 'pedido_enviado'
  | 'pedido_recebido'
  | 'pedir_avaliacao_google'
  | 'concluido'

export interface Order extends RecordModel {
  contact: string
  owner: string
  title: string
  items_description?: string
  value?: number
  stage: OrderStage
  tracking_code?: string
  google_review_requested?: boolean
  google_review_date?: string
  notes?: string
  position?: number
  expand?: {
    contact?: Contact
    owner?: UserRecord
  }
}

export interface JourneyEvent extends RecordModel {
  contact: string
  owner: string
  type:
    | 'cadastro'
    | 'compra'
    | 'nivel_alcancado'
    | 'cupom_aniversario'
    | 'whatsapp_enviado'
    | 'whatsapp_falha'
    | 'reengajamento'
    | 'atendimento_especial'
    | 'pedido_criado'
    | 'pedido_movido'
    | 'avaliacao_google_solicitada'
    | 'indicacao_feita'
    | 'recompensa_indicacao'
    | 'agenda_criada'
    | 'agenda_concluida'
  title: string
  description?: string
  channel?: string
  metadata?: Record<string, unknown>
  expand?: {
    contact?: Contact
    owner?: UserRecord
  }
}

export type CustomerJourneyStage =
  | 'novo'
  | 'ativo'
  | 'em_risco'
  | 'reengajamento'
  | 'fa_incentivador'

export interface CustomerJourneyStageInfo {
  stage: CustomerJourneyStage
  label: string
  description: string
  color: string
  badgeBg: string
  badgeText: string
  iconName: string
}

export type ReferralStatus = 'indicado' | 'primeiro_contato' | 'primeira_compra' | 'cancelado'

export interface Referral extends RecordModel {
  referrer: string
  owner?: string
  referred_name: string
  referred_phone?: string
  referred_email?: string
  status: ReferralStatus
  notes?: string
  reward_coupon?: string
  converted_at?: string
  contact_converted?: string
  expand?: {
    referrer?: Contact
    owner?: UserRecord
    contact_converted?: Contact
  }
}

export type AgendaEventType =
  | 'follow_up'
  | 'reuniao_degustacao'
  | 'entrega'
  | 'lembrete_pessoal'
  | 'outro'

export interface AgendaEvent extends RecordModel {
  title: string
  date: string
  time?: string
  type: AgendaEventType
  customer?: string
  owner?: string
  notes?: string
  done?: boolean
  expand?: {
    customer?: Contact
    owner?: UserRecord
  }
}

export interface Contact extends RecordModel {
  name: string
  email: string
  phone: string
  company: string
  empresa?: string
  position: string
  status: 'lead' | 'ativo' | 'inativo'
  owner: string
  notes: string
  birthday?: string
  purchase_count?: number
  last_purchase_date?: string
  total_spent?: number
  last_coupon_code?: string
  last_coupon_date?: string
  last_reengagement_date?: string
  favorite_coffee?: string
  referral_code?: string
  // Detalhes Disney / Encantamento & Sensorial
  nickname?: string
  roast_preference?: string
  brew_method_preference?: string
  coffee_machine?: string
  sent_mug?: boolean
  sent_welcome_folder?: boolean
  sent_stickers?: boolean
  intensity_preference?: string
  dietary_restrictions?: string
  special_date_description?: string
  special_date?: string
  acquisition_channel?: string
  service_notes?: string
  city?: string
  state?: string
  address?: string
  cpf_cnpj?: string
  coffee_preference?: string
  custom_fields?: Record<string, string | number | boolean>
  expand?: { owner?: UserRecord; empresa?: Empresa }
}

export interface SpreadsheetImportSummary {
  clientsCreated: number
  clientsUpdated: number
  clientsUnchanged: number
  purchasesImported: number
  retriesCount?: number
  warnings: string[]
  contactsTouchedCount: number
}

/**
 * Calcula o estágio atual na jornada Disney de atendimento:
 * - novo: <= 1 compra ou cadastrado recentemente
 * - fa_incentivador: Nível 3+ de fidelidade (20+ compras) ou fã leal ativo
 * - ativo: comprou nos últimos 29 dias e tem 2+ compras
 * - em_risco: 30 a 59 dias sem comprar (precisa de carinho e aroma novo)
 * - reengajamento: 60+ dias sem comprar (resgate com encantamento e cupom)
 */
export function getCustomerJourneyStage(contact: Contact): CustomerJourneyStageInfo {
  const purchases = contact.purchase_count || 0
  const daysSince = getDaysSinceLastPurchase(contact.last_purchase_date)

  if (purchases >= 20) {
    return {
      stage: 'fa_incentivador',
      label: 'Fã & Embaixador VIP',
      description: 'Cliente fiel apaixonado por cafés especiais (Nível 3+)',
      color: '#9333ea',
      badgeBg: 'bg-purple-50 border-purple-200',
      badgeText: 'text-purple-700',
      iconName: 'Crown',
    }
  }

  if (daysSince !== null && daysSince >= 60) {
    return {
      stage: 'reengajamento',
      label: 'Reengajamento Urgente',
      description: 'Mais de 60 dias sem visita — momento de resgate acolhedor',
      color: '#e11d48',
      badgeBg: 'bg-rose-50 border-rose-200',
      badgeText: 'text-rose-700',
      iconName: 'Flame',
    }
  }

  if (daysSince !== null && daysSince >= 30) {
    return {
      stage: 'em_risco',
      label: 'Em Risco / Vencendo (30d+)',
      description: 'Grãos provavelmente acabando em casa, convite ideal',
      color: '#ea580c',
      badgeBg: 'bg-orange-50 border-orange-200',
      badgeText: 'text-orange-700',
      iconName: 'Clock',
    }
  }

  if (purchases <= 1 && (!daysSince || daysSince < 30)) {
    return {
      stage: 'novo',
      label: 'Novo / Primeiros Passos',
      description: 'Primeira impressão Disney — encantar e apresentar métodos',
      color: '#2563eb',
      badgeBg: 'bg-blue-50 border-blue-200',
      badgeText: 'text-blue-700',
      iconName: 'Sparkles',
    }
  }

  return {
    stage: 'ativo',
    label: 'Ativo & Frequente',
    description: 'Rotina de cafés frescos e relacionamento contínuo',
    color: '#16a34a',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-700',
    iconName: 'HeartHandshake',
  }
}

/**
 * Gerador de mensagem calorosa no estilo "Experiência Disney":
 * Personaliza com nome ou apelido, café favorito, método preferido e cupom quando houver.
 */
export function buildDisneyWhatsAppMessage(params: {
  contact: Contact
  moment: 'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  couponCode?: string
  customNote?: string
}): string {
  const { contact, moment, couponCode, customNote } = params
  const displayName = contact.nickname?.trim() || contact.name.trim().split(' ')[0]
  const coffeeDetail = contact.favorite_coffee?.trim()
  const brewMethod = contact.brew_method_preference?.trim()
  const loyalty = getLoyaltyLevel(contact.purchase_count || 0)
  const code = couponCode || contact.last_coupon_code

  if (moment === 'aniversario') {
    let msg = `Olá, ${displayName}! 🎂✨\n\nHoje é um dia verdadeiramente especial e aqui na nossa cafeteria nós celebramos a sua vida com muito carinho e aroma de café fresco!`
    if (coffeeDetail) {
      msg += `\n\nSabemos do seu bom gosto pelo nosso café *${coffeeDetail}*${brewMethod ? ` preparado na ${brewMethod}` : ''}, e queremos que o seu dia seja repleto de momentos doces e inspiradores.`
    }
    if (code) {
      msg += `\n\n🎁 Preparamos um presente exclusivo para você: *15% OFF* com o seu cupom pessoal *${code}* na sua próxima visita!`
    }
    msg += `\n\nQue o seu novo ciclo seja radiante! Te esperamos para um brinde com a xícara perfeita! ☕🎉`
    return msg
  }

  if (moment === 'recorrencia') {
    let msg = `Oi, ${displayName}! ☕💛 Sentimos sua falta por aqui!\n\nPassando para saber como você está e se os seus grãos especiais já estão no finzinho em casa.`
    if (coffeeDetail) {
      msg += ` Lembramos do quanto você aprecia nosso *${coffeeDetail}* e chegaram novos lotes fresquinhos com notas aromáticas incríveis!`
    }
    if (code) {
      msg += `\n\nPara tornar o seu retorno ainda mais especial, separamos um mimo: use o código *${code}* para garantir seu desconto de boas-vindas!`
    }
    msg += `\n\nQuando puder, passa aqui para batermos um papo e prepararmos aquela extração perfeita para você. Um abraço caloroso da nossa equipe! ✨`
    return msg
  }

  if (moment === 'nivel_fidelidade') {
    // IMPORTANTE: nunca revelar a recompensa do nível em mensagem ao cliente (uso interno do CRM)
    let msg = `Parabéns, ${displayName}! ⭐☕ Você atingiu o *Nível ${loyalty.level} — ${loyalty.name}* no nosso Clube de Fidelidade!\n\n`
    msg += `Cada visita sua enriquece a nossa história e nos enche de orgulho. A sua preferência pelo nosso trabalho artesanal e pelo café especial é motivo de muita comemoração.`
    if (coffeeDetail) {
      msg += `\n\nO seu amor por *${coffeeDetail}* faz toda a diferença para o nosso time!`
    }
    msg += `\n\nObrigado por confiar no nosso trabalho artesanal. Esperamos você em breve para brindar essa conquista! ✨🏆`
    return msg
  }

  // Personalizado Disney
  let msg = `Olá, ${displayName}! ☕✨ Esperamos que o seu dia esteja maravilhoso!\n\n`
  if (customNote) {
    msg += `${customNote}\n\n`
  } else {
    msg += `Passando para desejar momentos inspiradores e cheios de aconchego com uma xícara quentinha de café especial.\n\n`
  }
  if (coffeeDetail) {
    msg += `Qualquer novidade sobre safras do seu favorito (*${coffeeDetail}*), estamos sempre à sua disposição!`
  }
  return msg.trim()
}

/**
 * Mensagem automática de PROGRESSO DE FIDELIDADE enviada a cada nova compra registrada.
 * Tom Disney, personalizada com nome/apelido, café favorito e método preferido.
 * - levelUp = true → parabeniza o novo nível (reaproveita o texto de "nivel_fidelidade")
 * - caso contrário → mostra compra atual, nível atual e quantas faltam para o próximo nível.
 */
export function buildLoyaltyProgressMessage(params: {
  contact: Contact
  purchaseCount: number
  leveledUp?: boolean
  newLevel?: number
}): string {
  const { contact, purchaseCount, leveledUp } = params
  const displayName = contact.nickname?.trim() || contact.name.trim().split(' ')[0] || 'Cliente'
  const coffeeDetail = contact.favorite_coffee?.trim()
  const brewMethod = contact.brew_method_preference?.trim()
  const count = Math.max(1, purchaseCount)
  const loyalty = getLoyaltyLevel(count)

  const coffeeLine = coffeeDetail
    ? ` Sabemos do seu bom gosto pelo nosso café *${coffeeDetail}*${brewMethod ? ` preparado na ${brewMethod}` : ''} — cada xícara sua é um momento único.`
    : brewMethod
      ? ` Preparar o seu ${brewMethod} do jeitinho que você gosta é sempre um prazer.`
      : ''

  if (leveledUp) {
    // Reaproveita o texto caloroso de parabéns por novo nível
    // IMPORTANTE: nunca revelar a recompensa do nível em mensagem ao cliente (uso interno do CRM)
    let msg = `Parabéns, ${displayName}! ⭐☕ Você atingiu o *Nível ${loyalty.level} — ${loyalty.name}* no nosso Clube de Fidelidade!\n\n`
    msg += `Essa conquista veio com a sua *compra nº ${count}* e cada visita sua enriquece a nossa história. Temos uma surpresa especial reservada para celebrar você!`
    if (coffeeDetail) {
      msg += `\n\nO seu amor por *${coffeeDetail}* faz toda a diferença para o nosso time!`
    }
    msg += `\n\nObrigado por confiar no nosso trabalho artesanal. Esperamos você em breve para brindar essa conquista! ✨🏆`
    return msg
  }

  const remaining = loyalty.remainingToNext
  // Nome do próximo nível: o nível alcançado ao completar o limite atual (nextThreshold)
  const nextLevelName = getLoyaltyLevel(loyalty.nextThreshold).name

  let msg = `Oi, ${displayName}! ☕✨ Obrigado pela sua *compra nº ${count}* — é uma alegria imensa fazer parte do seu dia!`
  msg += `\n\n📊 *Seu progresso no Clube de Fidelidade:*\n• Nível atual: *${loyalty.level} — ${loyalty.name}*`
  if (remaining > 0) {
    msg += `\n• Faltam só *${remaining} ${remaining === 1 ? 'compra' : 'compras'}* para você desbloquear o seu próximo nível: *${nextLevelName}*!`
  } else {
    msg += `\n• Você já conquistou o nível máximo *${loyalty.name}* — você faz parte do seleto clube VIP da casa! 👑`
  }
  msg += coffeeLine
  msg += `\n\nTe esperamos de braços abertos para a próxima xícara! ✨💛`
  return msg
}

/**
 * Nível de fidelidade por CONTAGEM DE COMPRAS do cliente.
 * O cliente atinge o nível quando compras >= threshold do nível (pode pular níveis).
 * 0–9 compras = sem nível ainda (level 0, "Sem nível").
 * RECOMPENSAS SÃO INTERNAS: aparecem só dentro do CRM, nunca em mensagens ao cliente.
 */
export function getLoyaltyLevel(purchasesCount = 0): LoyaltyLevelInfo {
  const count = Math.max(0, purchasesCount)

  // Nível mais alto cujo threshold já foi alcançado (0 quando count < 10)
  const level = LOYALTY_LEVELS.reduce((acc, l) => (count >= l.minPurchases ? l.level : acc), 0)
  const meta = LOYALTY_LEVELS.find((l) => l.level === level)
  const nextMeta = LOYALTY_LEVELS.find((l) => l.level === level + 1)
  const maxed = level >= MAX_LOYALTY_LEVEL

  const minPurchases = meta?.minPurchases ?? 0
  // Faixa exibida: do threshold deste nível até véspera do próximo (ou "100+")
  const maxPurchases = maxed ? Number.POSITIVE_INFINITY : (nextMeta?.minPurchases ?? 0) - 1
  const nextThreshold = maxed ? minPurchases : (nextMeta?.minPurchases ?? 0)
  const remainingToNext = maxed ? 0 : Math.max(0, nextThreshold - count)
  // Progresso dentro da faixa atual: 0 no threshold, 99% véspera do próximo
  const span = maxed ? 1 : Math.max(1, nextThreshold - minPurchases)
  const progressPct = maxed ? 100 : Math.min(99, Math.round(((count - minPurchases) / span) * 100))

  return {
    level,
    name: meta?.name ?? 'Sem nível',
    badgeColor: meta?.badgeColor ?? 'border-slate-300/60 bg-slate-100 text-slate-600',
    minPurchases,
    maxPurchases,
    nextThreshold,
    remainingToNext,
    progressPct,
    reward: meta?.reward ?? '—',
    description:
      meta?.description ??
      `Cliente ainda sem nível de fidelidade (0 a ${LOYALTY_LEVELS[0].minPurchases - 1} compras)`,
  }
}

export function getBirthdayInfo(birthdayStr?: string) {
  if (!birthdayStr)
    return { isToday: false, isNext7Days: false, daysUntil: null, formattedDate: '—' }
  try {
    const birthDate = new Date(birthdayStr)
    if (isNaN(birthDate.getTime()))
      return { isToday: false, isNext7Days: false, daysUntil: null, formattedDate: '—' }

    const now = new Date()
    const birthMonth = birthDate.getUTCMonth()
    const birthDay = birthDate.getUTCDate()

    const currentYear = now.getUTCFullYear()
    // Comparar considerando o dia no ano corrente
    let nextBday = new Date(Date.UTC(currentYear, birthMonth, birthDay))
    const todayUTC = new Date(Date.UTC(currentYear, now.getUTCMonth(), now.getUTCDate()))

    // Se já passou este ano (e não é hoje), o próximo é no ano que vem
    if (nextBday.getTime() < todayUTC.getTime()) {
      nextBday = new Date(Date.UTC(currentYear + 1, birthMonth, birthDay))
    }

    const diffMs = nextBday.getTime() - todayUTC.getTime()
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))

    const isToday = daysUntil === 0
    const isNext7Days = daysUntil >= 0 && daysUntil <= 7

    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(birthDate)

    return {
      isToday,
      isNext7Days,
      daysUntil,
      formattedDate,
    }
  } catch {
    return { isToday: false, isNext7Days: false, daysUntil: null, formattedDate: '—' }
  }
}

export function getDaysSinceLastPurchase(lastPurchaseStr?: string) {
  if (!lastPurchaseStr) return null
  const diff = Date.now() - new Date(lastPurchaseStr).getTime()
  if (isNaN(diff)) return null
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export type DealTemperature = 'quente' | 'morno' | 'frio'

export interface Campaign extends RecordModel {
  name: string
  description?: string
  form?: string
  status: 'ativa' | 'pausada' | 'encerrada'
  owner?: string
  expand?: {
    form?: CaptureForm
    owner?: UserRecord
  }
}

export interface Deal extends RecordModel {
  code: string
  title: string
  value: number
  stage: string
  status: 'aberto' | 'ganho' | 'perdido'
  contact: string
  empresa?: string
  owner: string
  expected_close: string
  position: number
  temperature?: DealTemperature
  last_contact_at?: string
  campaign?: string
  expand?: {
    stage?: Stage
    contact?: Contact
    empresa?: Empresa
    owner?: UserRecord
    campaign?: Campaign
  }
}

export interface EmailTemplate extends RecordModel {
  name: string
  subject: string
  body: string
  owner?: string
}

export interface Activity extends RecordModel {
  type: 'nota' | 'email' | 'ligacao' | 'reuniao' | 'sistema'
  content: string
  contact: string
  deal: string
  author: string
  expand?: { contact?: Contact; deal?: Deal; author?: UserRecord }
}

export interface AskConversation extends RecordModel {
  title: string
  user: string
}

export interface AskMessage extends RecordModel {
  conversation: string
  role: 'user' | 'assistant'
  content: string
}

export interface CaptureForm extends RecordModel {
  name: string
  title: string
  subtitle: string
  submit_text: string
  success_message: string
  accent_color: string
  logo?: string
  show_phone: boolean
  require_phone: boolean
  show_company: boolean
  require_company: boolean
  show_position: boolean
  require_position: boolean
  show_message: boolean
  require_message: boolean
  custom_fields?: CustomFieldConfig[]
  owner?: string
}

export type CrmData = {
  stages: Stage[]
  contacts: Contact[]
  empresas: Empresa[]
  deals: Deal[]
  orders: Order[]
  referrals: Referral[]
  agendaEvents: AgendaEvent[]
  activities: Activity[]
  users: UserRecord[]
  loading: boolean
  refresh: () => Promise<void>
}

export const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export function initials(name = ''): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U'
  )
}

export function datePt(value: string): string {
  if (!value || value.startsWith('0001-01-01')) return '—'
  const parsed = new Date(value)
  if (isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(parsed)
    .replace('.', '')
}

export function relativeTime(value: string): string {
  const time = new Date(value).getTime()
  if (!value || isNaN(time)) return '—'
  const diff = Date.now() - time
  const mins = Math.max(1, Math.floor(diff / 60000))
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

export function daysSince(dateStr?: string): number {
  if (!dateStr) return 0
  const time = new Date(dateStr).getTime()
  if (isNaN(time)) return 0
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)))
}

export function getDealDaysIdle(deal: Deal, activities: Activity[] = []): number {
  // 1. Procurar última atividade de sistema de mudança de estágio ou criação referente a este deal
  const dealActivities = activities.filter((a) => a.deal === deal.id && a.type === 'sistema')
  if (dealActivities.length > 0) {
    // Encontrar se alguma menciona mudança/criação de estágio
    const stageMoves = dealActivities.filter((a) => {
      const lower = a.content.toLowerCase()
      return lower.includes('movido') || lower.includes('estágio') || lower.includes('estagio')
    })
    if (stageMoves.length > 0) {
      // Como activities vem ordenadas por -created ou criamos um max timestamp
      const timestamps = stageMoves
        .map((a) => new Date(a.created).getTime())
        .filter((t) => !isNaN(t))
      if (timestamps.length > 0) {
        const latestTime = Math.max(...timestamps)
        return Math.max(0, Math.floor((Date.now() - latestTime) / (1000 * 60 * 60 * 24)))
      }
    }
  }

  // 2. Se nunca moveu ou não encontrou atividade, usa deal.created
  const baseDate = deal.created || deal.updated
  return daysSince(baseDate)
}

export function isDealCold(deal: Deal, thresholdDays = 5): boolean {
  if (deal.status !== 'aberto') return false
  const lastContact = deal.last_contact_at || deal.created
  return daysSince(lastContact) >= thresholdDays || deal.temperature === 'frio'
}
