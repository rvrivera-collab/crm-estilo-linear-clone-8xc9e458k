/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const captureFormsCol = app.findCollectionByNameOrId('capture_forms')

    // 1. Create campaigns collection
    try {
      app.findCollectionByNameOrId('campaigns')
    } catch (_) {
      const campaigns = new Collection({
        name: 'campaigns',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text' },
          {
            name: 'form',
            type: 'relation',
            collectionId: captureFormsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['ativa', 'pausada', 'encerrada'],
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_campaigns_created ON campaigns (created)',
          'CREATE INDEX idx_campaigns_status ON campaigns (status)',
          'CREATE INDEX idx_campaigns_form ON campaigns (form)',
        ],
      })
      app.save(campaigns)
    }

    // 2. Add campaign relation field to deals collection if not exists
    const dealsCol = app.findCollectionByNameOrId('deals')
    const campaignsCol = app.findCollectionByNameOrId('campaigns')
    if (!dealsCol.fields.getByName('campaign')) {
      dealsCol.fields.add(
        new RelationField({
          name: 'campaign',
          collectionId: campaignsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
      dealsCol.addIndex('idx_deals_campaign', false, 'campaign', '')
      app.save(dealsCol)
    }

    // 3. Seed an initial sample campaign linked to the default capture form
    try {
      app.findFirstRecordByData('campaigns', 'name', 'Campanha Inbound Orgânico')
    } catch (_) {
      let defaultFormId = ''
      try {
        const defaultForm = app.findFirstRecordByData(
          'capture_forms',
          'name',
          'Formulário Principal',
        )
        defaultFormId = defaultForm.id
      } catch (_) {
        const forms = app.findRecordsByFilter('capture_forms', '', '+created', 1, 0)
        if (forms.length > 0) defaultFormId = forms[0].id
      }

      const rec = new Record(campaignsCol)
      rec.set('name', 'Campanha Inbound Orgânico')
      rec.set(
        'description',
        'Captação contínua através do formulário institucional no site principal e landing pages.',
      )
      rec.set('status', 'ativa')
      if (defaultFormId) {
        rec.set('form', defaultFormId)
      }
      app.save(rec)
    }
  },
  (app) => {
    try {
      const dealsCol = app.findCollectionByNameOrId('deals')
      const campField = dealsCol.fields.getByName('campaign')
      if (campField) {
        dealsCol.removeIndex('idx_deals_campaign')
        dealsCol.fields.remove(campField)
        app.save(dealsCol)
      }
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('campaigns')
      app.delete(col)
    } catch (_) {}
  },
)
