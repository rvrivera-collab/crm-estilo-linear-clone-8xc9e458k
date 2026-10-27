import type { Activity, Deal, Stage } from '@/types/crm'

export type PeriodFilterKey = '7d' | '30d' | '90d' | 'mes' | 'tudo'

export interface StageEntryEvent {
  dealId: string
  stageId: string
  timestamp: string // ISO date string
}

export function parseStageNameFromText(content: string): {
  oldStage?: string
  newStage?: string
  createdStage?: string
} {
  // Matches: movido de "Qualificação" para "Proposta" OR movido de Qualificação para Proposta
  const moveMatch = content.match(/movido de ["']?([^"']+)["']? para ["']?([^"']+)["']?/i)
  if (moveMatch) {
    return {
      oldStage: moveMatch[1].trim(),
      newStage: moveMatch[2].trim(),
    }
  }

  // Matches: criado no estágio "Prospecção" OR criada no estágio Qualificação
  const createdMatch = content.match(/criad[oa] no est[aá]gio ["']?([^"'\s,.]+)["']?/i)
  if (createdMatch) {
    return {
      createdStage: createdMatch[1].trim(),
    }
  }

  return {}
}

/**
 * Builds a mapping of dealId -> Map of stageId -> latest or earliest entry date.
 * Uses activities of type 'sistema' that log stage moves / creation, plus deals' created date as initial stage entry.
 */
export function extractStageEntries(
  deals: Deal[],
  stages: Stage[],
  activities: Activity[],
): {
  // dealId -> array of { stageId, timestamp }
  dealStageEntries: Map<string, Array<{ stageId: string; timestamp: Date }>>
} {
  const stageByName = new Map<string, Stage>()
  stages.forEach((s) => {
    stageByName.set(s.name.toLowerCase().trim(), s)
  })

  const entriesMap = new Map<string, Array<{ stageId: string; timestamp: Date }>>()

  const addEntry = (dealId: string, stageId: string, date: Date) => {
    if (!dealId || !stageId || isNaN(date.getTime())) return
    const list = entriesMap.get(dealId) || []
    list.push({ stageId, timestamp: date })
    entriesMap.set(dealId, list)
  }

  // 1. Initial entry for each deal: its created date in its initial stage
  // (We check deals' created date)
  deals.forEach((deal) => {
    if (deal.created && deal.stage) {
      addEntry(deal.id, deal.stage, new Date(deal.created))
    }
  })

  // 2. Parse system activities for moves
  activities.forEach((act) => {
    if (act.type !== 'sistema' || !act.deal || !act.created) return
    const parsed = parseStageNameFromText(act.content)
    const actDate = new Date(act.created)

    if (parsed.newStage) {
      const stage = stageByName.get(parsed.newStage.toLowerCase())
      if (stage) {
        addEntry(act.deal, stage.id, actDate)
      }
    } else if (parsed.createdStage) {
      const stage = stageByName.get(parsed.createdStage.toLowerCase())
      if (stage) {
        addEntry(act.deal, stage.id, actDate)
      }
    }
  })

  return { dealStageEntries: entriesMap }
}

export interface StageIdleStats {
  stageId: string
  stageName: string
  stageColor: string
  activeDealsCount: number
  activeDealsValue: number
  avgDaysIdle: number
  maxDaysIdle: number
  oldestDeal: Deal | null
  isStalled: boolean // >= 14 dias em média ou deal mais parado >= 21 dias
}

export function computeStageIdleStats(
  stages: Stage[],
  deals: Deal[],
  activities: Activity[],
  stalledThresholdDays = 14,
): Map<string, StageIdleStats> {
  const map = new Map<string, StageIdleStats>()
  const activeDeals = deals.filter((d) => d.status === 'aberto')

  // Mapear timestamp da última movimentação por deal (ou data de criação)
  const latestMoveByDeal = new Map<string, Date>()

  // 1. Inicializar com criação do deal
  deals.forEach((d) => {
    if (d.created) {
      latestMoveByDeal.set(d.id, new Date(d.created))
    }
  })

  // 2. Procurar em activities de sistema
  activities.forEach((act) => {
    if (act.type !== 'sistema' || !act.deal || !act.created) return
    const lower = act.content.toLowerCase()
    if (lower.includes('movido') || lower.includes('estágio') || lower.includes('estagio')) {
      const actDate = new Date(act.created)
      const current = latestMoveByDeal.get(act.deal)
      if (!current || actDate > current) {
        latestMoveByDeal.set(act.deal, actDate)
      }
    }
  })

  stages.forEach((stage) => {
    const stageDeals = activeDeals.filter((d) => d.stage === stage.id)
    if (stageDeals.length === 0) {
      map.set(stage.id, {
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
        activeDealsCount: 0,
        activeDealsValue: 0,
        avgDaysIdle: 0,
        maxDaysIdle: 0,
        oldestDeal: null,
        isStalled: false,
      })
      return
    }

    let totalDays = 0
    let maxDays = -1
    let oldest: Deal | null = null

    stageDeals.forEach((deal) => {
      const moveDate = latestMoveByDeal.get(deal.id) || new Date(deal.created || Date.now())
      const diffMs = Date.now() - moveDate.getTime()
      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      totalDays += days

      if (days > maxDays) {
        maxDays = days
        oldest = deal
      }
    })

    const avgDays =
      stageDeals.length > 0 ? Math.round((totalDays / stageDeals.length) * 10) / 10 : 0
    const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)
    const isStalled = avgDays >= stalledThresholdDays || maxDays >= 21

    map.set(stage.id, {
      stageId: stage.id,
      stageName: stage.name,
      stageColor: stage.color,
      activeDealsCount: stageDeals.length,
      activeDealsValue: totalValue,
      avgDaysIdle: avgDays,
      maxDaysIdle: Math.max(0, maxDays),
      oldestDeal: oldest,
      isStalled,
    })
  })

  return map
}

export function computePeriodRange(
  periodKey: PeriodFilterKey,
  endDateInput?: string,
): { startDate: Date | null; endDate: Date } {
  // If user passed a specific "até" date string (YYYY-MM-DD), use end of that day.
  // Otherwise use current time.
  let endDate = new Date()
  if (endDateInput) {
    const parsed = new Date(`${endDateInput}T23:59:59.999`)
    if (!isNaN(parsed.getTime())) {
      endDate = parsed
    }
  }

  if (periodKey === 'tudo') {
    return { startDate: null, endDate }
  }

  const start = new Date(endDate.getTime())

  if (periodKey === '7d') {
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
    return { startDate: start, endDate }
  }

  if (periodKey === '30d') {
    start.setDate(start.getDate() - 30)
    start.setHours(0, 0, 0, 0)
    return { startDate: start, endDate }
  }

  if (periodKey === '90d') {
    start.setDate(start.getDate() - 90)
    start.setHours(0, 0, 0, 0)
    return { startDate: start, endDate }
  }

  if (periodKey === 'mes') {
    // Current month beginning
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return { startDate: start, endDate }
  }

  return { startDate: null, endDate }
}

export function isDateInPeriod(
  dateStrOrObj: string | Date,
  startDate: Date | null,
  endDate: Date,
): boolean {
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj
  if (isNaN(d.getTime())) return false
  if (startDate && d < startDate) return false
  if (d > endDate) return false
  return true
}
