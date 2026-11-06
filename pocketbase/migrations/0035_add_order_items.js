/// <reference path="../pb_data/types.d.ts" />

/**
 * 0035 — Adiciona o campo `items` (json) à coleção `orders`.
 * Permite guardar os itens estruturados do pedido:
 * [
 *   {
 *     id: string,
 *     product_id?: string, // se veio do catálogo
 *     name: string,
 *     quantity: number,
 *     unit_price: number,
 *     total: number,
 *     notes?: string
 *   }
 * ]
 * Preserva compatibilidade integral com `items_description` (texto).
 */
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId('orders')
    if (!orders.fields.getByName('items')) {
      orders.fields.add(
        new JSONField({
          name: 'items',
          required: false,
        }),
      )
      app.save(orders)
    }
  },
  (app) => {
    try {
      const orders = app.findCollectionByNameOrId('orders')
      if (orders.fields.getByName('items')) {
        orders.fields.removeByName('items')
        app.save(orders)
      }
    } catch (_) {}
  },
)
