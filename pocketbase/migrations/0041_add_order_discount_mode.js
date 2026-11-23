// Adiciona o campo opcional `discount_mode` (select: 'money' | 'percent') à coleção orders.
// Registra em qual modo o desconto foi digitado: 'money' (R$ fixo, padrão) ou 'percent' (%).
// O campo `discount` continua guardando o valor convertido em R$; pedidos antigos (sem modo)
// são tratados como 'money' no app.
// Idempotente: só adiciona o campo se ele ainda não existir.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (!col.fields.getByName('discount_mode')) {
      col.fields.add(
        new SelectField({
          name: 'discount_mode',
          values: ['money', 'percent'],
          maxSelect: 1,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    if (col.fields.getByName('discount_mode')) {
      col.fields.removeByName('discount_mode')
      app.save(col)
    }
  },
)
