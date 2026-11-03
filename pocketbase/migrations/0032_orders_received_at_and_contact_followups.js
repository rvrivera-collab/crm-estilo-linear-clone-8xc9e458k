/// <reference path="../pb_data/types.d.ts" />

/**
 * 0032 — Data de recebimento dos pedidos + acompanhamento de feedback/indicação.
 * 1. `orders.received_at` (date): gravado automaticamente quando o pedido entra
 *    no estágio "Pedido recebido". Backfill idempotente: pedidos já recebidos
 *    sem data ganham a data do envio (shipped_at) como melhor estimativa —
 *    quando não há base nenhuma, fica vazio.
 * 2. `contacts.google_review_asked` (bool): "Já pedi o feedback do cliente na
 *    ficha do Google".
 * 3. `contacts.referral_asked` (bool): "Já pedi a indicação de amigos para o
 *    cliente".
 */
migrate(
  (app) => {
    // ---------- 1. orders.received_at ----------
    const orders = app.findCollectionByNameOrId('orders')
    if (!orders.fields.getByName('received_at')) {
      orders.fields.add(new DateField({ name: 'received_at' }))
      app.save(orders)
    }

    // Backfill: pedidos já em estágio recebido (ou depois) sem data de recebimento.
    // Melhor estimativa: a data do envio (quando existir); sem base → fica vazio.
    const pending = app.findRecordsByFilter(
      'orders',
      "stage = 'pedido_recebido' && received_at = ''",
      '',
      5000,
      0,
    )
    for (const rec of pending) {
      const shipped = rec.getString('shipped_at')
      if (shipped) {
        rec.set('received_at', shipped)
        app.save(rec)
      }
    }

    // ---------- 2 e 3. contacts: checkboxes de feedback/indicação ----------
    const contacts = app.findCollectionByNameOrId('contacts')
    let contactsDirty = false
    if (!contacts.fields.getByName('google_review_asked')) {
      contacts.fields.add(new BoolField({ name: 'google_review_asked', required: false }))
      contactsDirty = true
    }
    if (!contacts.fields.getByName('referral_asked')) {
      contacts.fields.add(new BoolField({ name: 'referral_asked', required: false }))
      contactsDirty = true
    }
    if (contactsDirty) app.save(contacts)
  },
  (app) => {
    try {
      const orders = app.findCollectionByNameOrId('orders')
      if (orders.fields.getByName('received_at')) {
        orders.fields.removeByName('received_at')
        app.save(orders)
      }
    } catch (_) {}
    try {
      const contacts = app.findCollectionByNameOrId('contacts')
      const fieldsToRemove = ['google_review_asked', 'referral_asked']
      for (const f of fieldsToRemove) {
        if (contacts.fields.getByName(f)) {
          contacts.fields.removeByName(f)
        }
      }
      app.save(contacts)
    } catch (_) {}
  },
)
