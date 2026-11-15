// Adiciona o campo opcional `shipping_fee` (valor do frete) à coleção orders.
// Pedidos antigos continuam funcionando: frete ausente é tratado como 0 no app.
// Idempotente: só adiciona o campo se ele ainda não existir.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (!col.fields.getByName('shipping_fee')) {
      col.fields.add(new NumberField({ name: 'shipping_fee' }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (col.fields.getByName('shipping_fee')) {
      col.fields.removeByName('shipping_fee')
      app.save(col)
    }
  },
)
