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

/** Converte um campo de porcentagem digitado (pt-BR) em número; vazio, inválido ou negativo vira 0. */
export function parsePercentInput(raw: string): number {
  return parseMoneyInput(raw)
}

/** Desconto em R$ equivalente a uma porcentagem sobre produtos + frete. */
export function percentToMoneyDiscount(percent: number, products: number, shippingFee: number) {
  return (Math.max(0, products) + Math.max(0, shippingFee)) * (Math.max(0, percent) / 100)
}

/**
 * Calcula o total final do pedido: produtos + frete − desconto.
 * O desconto pode vir em R$ (`discount`) ou em % (`discountPercent`) — quando os dois chegam,
 * o desconto em % tem precedência. O desconto nunca deixa o total abaixo de zero:
 * é limitado a produtos + frete, e `capped` indica que o valor digitado foi ajustado.
 */
export function computeOrderTotals(input: {
  products: number
  shippingFee: number
  discount: number
  discountPercent?: number
}) {
  const products = Math.max(0, input.products)
  const shippingFee = Math.max(0, input.shippingFee)
  const gross = products + shippingFee
  const rawDiscount =
    input.discountPercent !== undefined
      ? percentToMoneyDiscount(input.discountPercent, products, shippingFee)
      : input.discount
  const discount = Math.min(Math.max(0, rawDiscount), gross)
  return {
    products,
    shippingFee,
    discount,
    total: gross - discount,
    capped: rawDiscount > gross,
  }
}
