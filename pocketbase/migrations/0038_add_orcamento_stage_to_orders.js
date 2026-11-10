// Adiciona o estágio "Orçamento" (orcamento) como primeira etapa do funil de pedidos.
// Nenhum registro existente é alterado: apenas o select ganha um novo valor permitido.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    const field = col.fields.getByName('stage')
    if (!field) {
      throw new Error('Campo "stage" não encontrado na coleção orders')
    }
    const values = field.values || []
    if (!values.includes('orcamento')) {
      field.values = ['orcamento', ...values]
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('orders')
    const field = col.fields.getByName('stage')
    if (!field) return
    field.values = (field.values || []).filter((v) => v !== 'orcamento')
    app.save(col)
  },
)
