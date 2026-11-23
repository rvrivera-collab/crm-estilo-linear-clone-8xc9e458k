// Adiciona o campo opcional `discount` (desconto em R$ aplicado no valor final) à coleção orders.
// Pedidos antigos continuam funcionando: desconto ausente é tratado como 0 no app.
// Idempotente: só adiciona o campo se ele ainda não existir.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (!col.fields.getByName('discount')) {
      col.fields.add(new NumberField({ name: 'discount' }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (col.fields.getByName('discount')) {
      col.fields.removeByName('discount')
      app.save(col)
    }
  },
)
