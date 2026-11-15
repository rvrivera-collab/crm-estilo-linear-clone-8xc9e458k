import type { Order } from '@/types/crm'

/**
 * Total de exibição do pedido: produtos + frete.
 * O campo `value` persistido já guarda produtos + frete para novos/edições;
 * a soma com `shipping_fee` cobre pedidos antigos cujo `value` era só produtos
 * (quando o frete não estava gravado, value permanece o que era — sem alterar dados).
 */
export function orderTotalWithShipping(order: Pick<Order, 'value' | 'shipping_fee'>): number {
  const value = Number(order.value) || 0
  const fee = Number(order.shipping_fee) || 0
  return value + fee
}
