/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Add temperature and last_contact_at fields to 'deals'
    const deals = app.findCollectionByNameOrId('deals')
    if (!deals.fields.getByName('temperature')) {
      deals.fields.add(
        new SelectField({
          name: 'temperature',
          values: ['quente', 'morno', 'frio'],
          maxSelect: 1,
        }),
      )
    }
    if (!deals.fields.getByName('last_contact_at')) {
      deals.fields.add(
        new DateField({
          name: 'last_contact_at',
        }),
      )
    }
    app.save(deals)

    // 2. Add email_templates collection
    try {
      app.findCollectionByNameOrId('email_templates')
    } catch (_) {
      const emailTemplates = new Collection({
        name: 'email_templates',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'subject', type: 'text', required: true },
          { name: 'body', type: 'text', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_email_templates_name ON email_templates (name)'],
      })
      app.save(emailTemplates)
    }

    // 3. Seed email templates
    const templatesCol = app.findCollectionByNameOrId('email_templates')
    const templatesData = [
      {
        name: 'Retomando contato (Lead esfriando)',
        subject: 'Pensando no próximo passo para a {{empresa}}',
        body: 'Olá, {{nome}}!\n\nTudo bem por aí?\n\nEstive revisando nossas conversas sobre os objetivos da {{empresa}} e notei que não nos falamos há alguns dias. Entendo a correria, mas gostaria de checar como estão as prioridades do projeto por aí.\n\nVocê teria 10 minutinhos esta semana para nos alinharmos rapidamente?\n\nUm abraço,\nEquipe comercial',
      },
      {
        name: 'Follow-up pós-proposta',
        subject: 'Feedback sobre a proposta comercial — {{empresa}}',
        body: 'Olá, {{nome}},\n\nEspero que esteja tudo bem!\n\nPassando para acompanhar a proposta que compartilhamos para a {{empresa}}. Conseguiu analisar os pontos apresentados ou tem alguma dúvida com relação a escopo, prazos ou condições?\n\nFico à total disposição para fazermos um ajuste se necessário.\n\nAtenciosamente,\nEquipe comercial',
      },
      {
        name: 'Reunião de apresentação e diagnóstico',
        subject: 'Convite para apresentação: soluções para a {{empresa}}',
        body: 'Olá, {{nome}},\n\nFoi ótimo receber o seu contato! Queremos entender mais a fundo o momento atual da {{empresa}} e mostrar como podemos acelerar seus resultados práticos.\n\nQual dos dias a seguir ficaria melhor para um papo de 20 minutos via vídeo?\n- Terça-feira às 14h\n- Quarta-feira às 10h\n\nAbraços,\nEquipe comercial',
      },
    ]

    for (const tpl of templatesData) {
      try {
        app.findFirstRecordByData('email_templates', 'name', tpl.name)
      } catch (_) {
        const record = new Record(templatesCol)
        record.set('name', tpl.name)
        record.set('subject', tpl.subject)
        record.set('body', tpl.body)
        app.save(record)
      }
    }

    // 4. Update initial seeded deals with sample temperatures & last_contact_at
    const now = new Date()
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString()

    const dealUpdates = [
      { code: 'NEG-1001', temp: 'quente', days: 1 },
      { code: 'NEG-1002', temp: 'morno', days: 4 },
      { code: 'NEG-1003', temp: 'frio', days: 9 },
      { code: 'NEG-1004', temp: 'frio', days: 12 },
      { code: 'NEG-1005', temp: 'quente', days: 2 },
      { code: 'NEG-1006', temp: 'frio', days: 15 },
      { code: 'NEG-1007', temp: 'morno', days: 5 },
      { code: 'NEG-1008', temp: 'frio', days: 20 },
    ]

    for (const item of dealUpdates) {
      try {
        const d = app.findFirstRecordByData('deals', 'code', item.code)
        d.set('temperature', item.temp)
        d.set('last_contact_at', daysAgo(item.days))
        app.save(d)
      } catch (_) {}
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('email_templates')
      app.delete(col)
    } catch (_) {}

    try {
      const deals = app.findCollectionByNameOrId('deals')
      const temp = deals.fields.getByName('temperature')
      if (temp) deals.fields.removeById(temp.id)
      const lastContact = deals.fields.getByName('last_contact_at')
      if (lastContact) deals.fields.removeById(lastContact.id)
      app.save(deals)
    } catch (_) {}
  },
)
