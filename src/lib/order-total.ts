import type { Order } from '@/types/crm'

/**
 * Valor final do pedido (produtos + frete − desconto).
 * O campo `value` já é gravado pelo formulário com o total final, então o total é o próprio `value`.
 * Frete e desconto são opcionais (0 quando ausentes): pedidos antigos mantêm o valor como estava.
 */
export function orderTotalWithShipping(order: Pick<Order, 'value'>): number {
  return Number(order.value) || 0
}

/** Converte um campo de valor digitado (pt-BR) em número; vazio, inválido ou negativo vira 0. */
export function parseMoneyInput(raw: string): number {
  const t = raw.trim()
  if (!t) return 0
  const n = parseFloat(t.replace(',', '.'))
  return isNaN(n) || n < 0 ? 0 : n
}

/**
 * Calcula o total final do pedido: produtos + frete − desconto.
 * O desconto nunca deixa o total abaixo de zero: é limitado a produtos + frete,
 * e `capped` indica que o valor digitado foi ajustado.
 */
export function computeOrderTotals(input: {
  products: number
  shippingFee: number
  discount: number
}) {
  const products = Math.max(0, input.products)
  const shippingFee = Math.max(0, input.shippingFee)
  const gross = products + shippingFee
  const discount = Math.min(Math.max(0, input.discount), gross)
  return {
    products,
    shippingFee,
    discount,
    total: gross - discount,
    capped: input.discount > gross,
  }
}
