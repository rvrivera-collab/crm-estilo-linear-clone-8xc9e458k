/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    let pipelineStagesCol = null
    try {
      pipelineStagesCol = app.findCollectionByNameOrId('pipeline_stages')
    } catch (_) {}

    try {
      app.findCollectionByNameOrId('custom_metrics')
    } catch (_) {
      const customMetrics = new Collection({
        name: 'custom_metrics',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'name', type: 'text', required: true },
          {
            name: 'aggregation',
            type: 'select',
            required: true,
            values: [
              'count_deals',
              'sum_value',
              'avg_value',
              'win_rate',
              'ticket_medio',
              'won_deals',
              'lost_deals',
            ],
            maxSelect: 1,
          },
          {
            name: 'stage',
            type: 'relation',
            collectionId: pipelineStagesCol ? pipelineStagesCol.id : '',
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: false,
            values: ['aberto', 'ganho', 'perdido'],
            maxSelect: 1,
          },
          { name: 'order', type: 'number', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_custom_metrics_order ON custom_metrics (`order`)',
          'CREATE INDEX idx_custom_metrics_created ON custom_metrics (created)',
        ],
      })
      app.save(customMetrics)
    }

    // Seed 2-3 metricas de exemplo de forma idempotente
    const metricsCol = app.findCollectionByNameOrId('custom_metrics')

    const seeds = [
      {
        name: 'Ticket médio geral',
        aggregation: 'ticket_medio',
        order: 1,
      },
      {
        name: 'Taxa de conversão (Win Rate)',
        aggregation: 'win_rate',
        order: 2,
      },
      {
        name: 'Deals em aberto (Pipeline ativo)',
        aggregation: 'count_deals',
        status: 'aberto',
        order: 3,
      },
    ]

    for (const seed of seeds) {
      try {
        app.findFirstRecordByData('custom_metrics', 'name', seed.name)
      } catch (_) {
        const rec = new Record(metricsCol)
        rec.set('name', seed.name)
        rec.set('aggregation', seed.aggregation)
        if (seed.stage) rec.set('stage', seed.stage)
        if (seed.status) rec.set('status', seed.status)
        rec.set('order', seed.order)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('custom_metrics')
      app.delete(col)
    } catch (_) {}
  },
)
