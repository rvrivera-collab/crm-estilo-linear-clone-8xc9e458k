/// <reference path="../pb_data/types.d.ts" />

/**
 * 0029 — Cria a collection `crm_settings` (configurações do CRM por usuário).
 * Primeiro uso: `waba_id` — ID da conta WhatsApp Business (WABA) colado manualmente pelo
 * dono em Configurações. O hook `crm_send_whatsapp` usa esse ID como precedência máxima
 * quando a descoberta automática pela conexão falha (ex.: conexão vinculada a um ID de
 * Business Manager, que nunca deve ser enviado como waba_id à Meta).
 */
migrate(
  (app) => {
    if (app.hasTable('crm_settings')) {
      const col = app.findCollectionByNameOrId('crm_settings')
      if (!col.fields.getByName('waba_id')) {
        col.fields.add(new TextField({ name: 'waba_id', max: 64 }))
        app.save(col)
      }
      return
    }

    const collection = new Collection({
      name: 'crm_settings',
      type: 'base',
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'waba_id', type: 'text', max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_crm_settings_owner ON crm_settings (owner)'],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('crm_settings')
      app.delete(collection)
    } catch (_) {}
  },
)
