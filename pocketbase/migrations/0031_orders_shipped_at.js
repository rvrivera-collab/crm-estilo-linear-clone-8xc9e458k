/// <reference path="../pb_data/types.d.ts" />

/**
 * 0031 — Data do envio dos pedidos (`shipped_at`).
 * Adiciona o campo `shipped_at` (date) em `orders`, que guarda o dia em que o
 * código de rastreio foi adicionado ao pedido. O backfill preenche pedidos antigos
 * que já tinham `tracking_code` e não têm data de envio, usando a data de
 * atualização do pedido como aproximação. Idempotente: só mexe no que falta.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (!col.fields.getByName('shipped_at')) {
      col.fields.add(new DateField({ name: 'shipped_at' }))
      app.save(col)
    }

    const pending = app.findRecordsByFilter(
      'orders',
      "tracking_code != '' && shipped_at = ''",
      '',
      5000,
      0,
    )
    for (const rec of pending) {
      const fallback = rec.getString('updated') || new Date().toISOString()
      rec.set('shipped_at', fallback)
      app.save(rec)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (col.fields.getByName('shipped_at')) {
      col.fields.removeByName('shipped_at')
      app.save(col)
    }
  },
)
