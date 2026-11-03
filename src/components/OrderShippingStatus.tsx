import { CheckCircle2, Clock } from 'lucide-react'
import { formatDaysSince, getOrderShippingInfo } from '@/lib/order-shipping'
import type { Order } from '@/types/crm'

interface OrderShippingStatusProps {
  order: Pick<Order, 'tracking_code' | 'stage' | 'shipped_at'>
  /** Instante usado para calcular os dias (atualizado pela página ao virar o dia). */
  now: Date
}

/** Linha compacta com a data do envio e o contador de dias do pedido no funil. */
export function OrderShippingStatus({ order, now }: OrderShippingStatusProps) {
  const info = getOrderShippingInfo(order, now)
  if (!info) return null

  if (info.delivered) {
    return (
      <div className="flex items-center justify-between gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] text-emerald-800">
        <span className="inline-flex items-center gap-1 font-bold min-w-0">
          <CheckCircle2 className="size-2.5 shrink-0" />
          <span className="truncate">Recebido</span>
        </span>
        {info.shippedDateLabel && (
          <span className="font-mono shrink-0 text-emerald-700/80">
            Enviado {info.shippedDateLabel}
          </span>
        )}
      </div>
    )
  }

  if (info.daysSinceShipped === null || !info.shippedDateLabel) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50/70 px-2 py-1 text-[9px] text-amber-800">
        Data de envio não registrada
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] text-amber-900">
      <span className="inline-flex items-center gap-1 font-bold min-w-0">
        <Clock className="size-2.5 shrink-0 text-amber-700" />
        <span className="truncate">{formatDaysSince(info.daysSinceShipped)}</span>
      </span>
      <span className="font-mono shrink-0 text-amber-800/80">Data: {info.shippedDateLabel}</span>
    </div>
  )
}
