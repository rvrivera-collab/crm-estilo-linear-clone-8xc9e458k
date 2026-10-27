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
  custom_fields?: Record<string, string | number | boolean>
  expand?: { owner?: UserRecord; empresa?: Empresa }
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
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(value))
    .replace('.', '')
}

export function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.max(1, Math.floor(diff / 60000))
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

export function daysSince(dateStr?: string): number {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
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
