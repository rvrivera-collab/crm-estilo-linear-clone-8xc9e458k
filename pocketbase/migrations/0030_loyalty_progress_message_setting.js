/// <reference path="../pb_data/types.d.ts" />

/**
 * 0030 — Mensagem automática de progresso de fidelidade.
 * Adiciona `loyalty_progress_disabled` em `crm_settings` (padrão: desligado = false,
 * ou seja, a mensagem automática de progresso está LIGADA por padrão).
 * Quando o usuário desligar em Configurações, o flag fica true e o envio
 * automático no registro de compra é pulado.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('crm_settings')
    if (!col.fields.getByName('loyalty_progress_disabled')) {
      col.fields.add(new BoolField({ name: 'loyalty_progress_disabled' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('crm_settings')
    if (col.fields.getByName('loyalty_progress_disabled')) {
      col.fields.removeByName('loyalty_progress_disabled')
    }
    app.save(col)
  },
)
