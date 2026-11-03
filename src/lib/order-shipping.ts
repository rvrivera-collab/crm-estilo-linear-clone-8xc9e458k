import { safeParseDate } from '@/lib/safe-date'
import type { Order, OrderStage } from '@/types/crm'

const MS_PER_DAY = 86_400_000

/** Formata uma data como dd/mm/aaaa no fuso local. */
export function formatDateFull(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Estágios a partir de "Pedido recebido" (inclusive): o contador de envio para. */
const DELIVERED_STAGES: OrderStage[] = ['pedido_recebido', 'pedir_avaliacao_google', 'concluido']

/**
 * Número do dia no calendário LOCAL do navegador. Usa os componentes locais
 * (ano/mês/dia) e os converte em UTC só para a aritmética, sem deslocar o dia.
 */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY)
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return localDayNumber(a) === localDayNumber(b)
}

export function isOrderDelivered(stage: OrderStage): boolean {
  return DELIVERED_STAGES.includes(stage)
}

export interface OrderShippingInfo {
  delivered: boolean
  /** Data do envio no formato dd/mm (fuso local), ou null quando não gravada. */
  shippedDateLabel: string | null
  /** Dias corridos desde o envio (calendário local), ou null quando a data não existe. */
  daysSinceShipped: number | null
}

/** Informações de envio de um pedido. Retorna null quando o pedido não tem rastreio. */
export function getOrderShippingInfo(
  order: Pick<Order, 'tracking_code' | 'stage' | 'shipped_at'>,
  now: Date,
): OrderShippingInfo | null {
  if (!order.tracking_code?.trim()) return null
  const shipped = safeParseDate(order.shipped_at)
  return {
    delivered: isOrderDelivered(order.stage),
    shippedDateLabel: shipped
      ? shipped.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : null,
    daysSinceShipped: shipped ? Math.max(0, localDayNumber(now) - localDayNumber(shipped)) : null,
  }
}

/** Texto do contador: "Enviado hoje", "Enviado há 1 dia", "Enviado há N dias". */
export function formatDaysSince(days: number): string {
  if (days <= 0) return 'Enviado hoje'
  return days === 1 ? 'Enviado há 1 dia' : `Enviado há ${days} dias`
}
