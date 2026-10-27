/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // Resolver admin demo para associar os registros existentes que não possuem dono
    let demoAdminId = ''
    try {
      const demoAdmin = app.findFirstRecordByData('users', 'email', 'teste@direto.app')
      demoAdminId = demoAdmin.id
    } catch (_) {
      try {
        const anyAdmin = app.findFirstRecordByData('users', 'role', 'admin')
        demoAdminId = anyAdmin.id
      } catch (_) {
        const allUsers = app.findRecordsByFilter('users', '', '+created', 1, 0)
        if (allUsers.length > 0) demoAdminId = allUsers[0].id
      }
    }

    // 1. Campo owner em campaigns
    const campaigns = app.findCollectionByNameOrId('campaigns')
    if (!campaigns.fields.getByName('owner')) {
      campaigns.fields.add(
        new RelationField({
          name: 'owner',
          collectionId: users.id,
          maxSelect: 1,
          required: false,
        }),
      )
      campaigns.addIndex('idx_campaigns_owner', false, 'owner', '')
    }

    // 2. Campo owner em custom_metrics
    const customMetrics = app.findCollectionByNameOrId('custom_metrics')
    if (!customMetrics.fields.getByName('owner')) {
      customMetrics.fields.add(
        new RelationField({
          name: 'owner',
          collectionId: users.id,
          maxSelect: 1,
          required: false,
        }),
      )
      customMetrics.addIndex('idx_custom_metrics_owner', false, 'owner', '')
    }

    // 3. Campo owner em capture_forms
    const captureForms = app.findCollectionByNameOrId('capture_forms')
    if (!captureForms.fields.getByName('owner')) {
      captureForms.fields.add(
        new RelationField({
          name: 'owner',
          collectionId: users.id,
          maxSelect: 1,
          required: false,
        }),
      )
      captureForms.addIndex('idx_capture_forms_owner', false, 'owner', '')
    }

    // 4. Campo owner em email_templates
    const emailTemplates = app.findCollectionByNameOrId('email_templates')
    if (!emailTemplates.fields.getByName('owner')) {
      emailTemplates.fields.add(
        new RelationField({
          name: 'owner',
          collectionId: users.id,
          maxSelect: 1,
          required: false,
        }),
      )
      emailTemplates.addIndex('idx_email_templates_owner', false, 'owner', '')
    }

    // Salvar coleções antes de preencher dados legados e atualizar regras
    app.save(campaigns)
    app.save(customMetrics)
    app.save(captureForms)
    app.save(emailTemplates)

    // Preencher owner nos registros legados sem dono usando SQL para garantir integridade
    if (demoAdminId) {
      try {
        app
          .db()
          .newQuery('UPDATE campaigns SET owner = {:owner} WHERE owner IS NULL OR owner = ""')
          .bind({ owner: demoAdminId })
          .execute()
      } catch (e) {
        console.log('Aviso ao atribuir owner em campaigns:', e)
      }

      try {
        app
          .db()
          .newQuery('UPDATE custom_metrics SET owner = {:owner} WHERE owner IS NULL OR owner = ""')
          .bind({ owner: demoAdminId })
          .execute()
      } catch (e) {
        console.log('Aviso ao atribuir owner em custom_metrics:', e)
      }

      try {
        app
          .db()
          .newQuery('UPDATE capture_forms SET owner = {:owner} WHERE owner IS NULL OR owner = ""')
          .bind({ owner: demoAdminId })
          .execute()
      } catch (e) {
        console.log('Aviso ao atribuir owner em capture_forms:', e)
      }

      try {
        app
          .db()
          .newQuery('UPDATE email_templates SET owner = {:owner} WHERE owner IS NULL OR owner = ""')
          .bind({ owner: demoAdminId })
          .execute()
      } catch (e) {
        console.log('Aviso ao atribuir owner em email_templates:', e)
      }

      try {
        app
          .db()
          .newQuery('UPDATE deals SET owner = {:owner} WHERE owner IS NULL OR owner = ""')
          .bind({ owner: demoAdminId })
          .execute()
      } catch (e) {
        console.log('Aviso ao atribuir owner em deals:', e)
      }

      try {
        app
          .db()
          .newQuery('UPDATE contacts SET owner = {:owner} WHERE owner IS NULL OR owner = ""')
          .bind({ owner: demoAdminId })
          .execute()
      } catch (e) {
        console.log('Aviso ao atribuir owner em contacts:', e)
      }

      try {
        app
          .db()
          .newQuery('UPDATE empresas SET owner = {:owner} WHERE owner IS NULL OR owner = ""')
          .bind({ owner: demoAdminId })
          .execute()
      } catch (e) {
        console.log('Aviso ao atribuir owner em empresas:', e)
      }
    }

    // 5. Atualizar API Rules para escopo estrito por usuário autenticado / dono

    // deals
    const deals = app.findCollectionByNameOrId('deals')
    deals.listRule = "@request.auth.id != '' && owner = @request.auth.id"
    deals.viewRule = "@request.auth.id != '' && owner = @request.auth.id"
    deals.createRule = "@request.auth.id != '' && owner = @request.auth.id"
    deals.updateRule = "@request.auth.id != '' && owner = @request.auth.id"
    deals.deleteRule = "@request.auth.id != '' && owner = @request.auth.id"
    app.save(deals)

    // contacts
    const contacts = app.findCollectionByNameOrId('contacts')
    contacts.listRule = "@request.auth.id != '' && owner = @request.auth.id"
    contacts.viewRule = "@request.auth.id != '' && owner = @request.auth.id"
    contacts.createRule = "@request.auth.id != '' && owner = @request.auth.id"
    contacts.updateRule = "@request.auth.id != '' && owner = @request.auth.id"
    contacts.deleteRule = "@request.auth.id != '' && owner = @request.auth.id"
    app.save(contacts)

    // empresas
    const empresas = app.findCollectionByNameOrId('empresas')
    empresas.listRule = "@request.auth.id != '' && owner = @request.auth.id"
    empresas.viewRule = "@request.auth.id != '' && owner = @request.auth.id"
    empresas.createRule = "@request.auth.id != '' && owner = @request.auth.id"
    empresas.updateRule = "@request.auth.id != '' && owner = @request.auth.id"
    empresas.deleteRule = "@request.auth.id != '' && owner = @request.auth.id"
    app.save(empresas)

    // activities: list/view = autor ou dono do deal vinculado; escrita/edição/deleção = author
    const activities = app.findCollectionByNameOrId('activities')
    activities.listRule =
      "@request.auth.id != '' && (author = @request.auth.id || deal.owner = @request.auth.id)"
    activities.viewRule =
      "@request.auth.id != '' && (author = @request.auth.id || deal.owner = @request.auth.id)"
    activities.createRule = "@request.auth.id != '' && author = @request.auth.id"
    activities.updateRule = "@request.auth.id != '' && author = @request.auth.id"
    activities.deleteRule = "@request.auth.id != '' && author = @request.auth.id"
    app.save(activities)

    // campaigns
    campaigns.listRule = "@request.auth.id != '' && owner = @request.auth.id"
    campaigns.viewRule = "@request.auth.id != '' && owner = @request.auth.id"
    campaigns.createRule = "@request.auth.id != '' && owner = @request.auth.id"
    campaigns.updateRule = "@request.auth.id != '' && owner = @request.auth.id"
    campaigns.deleteRule = "@request.auth.id != '' && owner = @request.auth.id"
    app.save(campaigns)

    // custom_metrics
    customMetrics.listRule = "@request.auth.id != '' && owner = @request.auth.id"
    customMetrics.viewRule = "@request.auth.id != '' && owner = @request.auth.id"
    customMetrics.createRule = "@request.auth.id != '' && owner = @request.auth.id"
    customMetrics.updateRule = "@request.auth.id != '' && owner = @request.auth.id"
    customMetrics.deleteRule = "@request.auth.id != '' && owner = @request.auth.id"
    app.save(customMetrics)

    // capture_forms: leitura pública mantida para /captura e /form/:id; escrita restrita ao dono
    captureForms.listRule = ''
    captureForms.viewRule = ''
    captureForms.createRule = "@request.auth.id != '' && owner = @request.auth.id"
    captureForms.updateRule = "@request.auth.id != '' && owner = @request.auth.id"
    captureForms.deleteRule = "@request.auth.id != '' && owner = @request.auth.id"
    app.save(captureForms)

    // email_templates: modelos padrão (sem dono) visíveis a todos autenticados, ou do próprio dono
    emailTemplates.listRule =
      "@request.auth.id != '' && (owner = null || owner = '' || owner = @request.auth.id)"
    emailTemplates.viewRule =
      "@request.auth.id != '' && (owner = null || owner = '' || owner = @request.auth.id)"
    emailTemplates.createRule = "@request.auth.id != '' && owner = @request.auth.id"
    emailTemplates.updateRule = "@request.auth.id != '' && owner = @request.auth.id"
    emailTemplates.deleteRule = "@request.auth.id != '' && owner = @request.auth.id"
    app.save(emailTemplates)

    // ask_messages: conversa deve pertencer ao usuário autenticado
    const askMessages = app.findCollectionByNameOrId('ask_messages')
    askMessages.listRule = "@request.auth.id != '' && conversation.user = @request.auth.id"
    askMessages.viewRule = "@request.auth.id != '' && conversation.user = @request.auth.id"
    askMessages.createRule = "@request.auth.id != '' && conversation.user = @request.auth.id"
    askMessages.updateRule = "@request.auth.id != '' && conversation.user = @request.auth.id"
    askMessages.deleteRule = "@request.auth.id != '' && conversation.user = @request.auth.id"
    app.save(askMessages)

    // pipeline_stages: leitura para qualquer autenticado, escrita apenas admin
    const pipelineStages = app.findCollectionByNameOrId('pipeline_stages')
    pipelineStages.listRule = "@request.auth.id != ''"
    pipelineStages.viewRule = "@request.auth.id != ''"
    pipelineStages.createRule = "@request.auth.role = 'admin'"
    pipelineStages.updateRule = "@request.auth.role = 'admin'"
    pipelineStages.deleteRule = "@request.auth.role = 'admin'"
    app.save(pipelineStages)
  },
  (app) => {
    // Reverter regras e campos caso necessário
    try {
      const deals = app.findCollectionByNameOrId('deals')
      deals.listRule = "@request.auth.id != ''"
      deals.viewRule = "@request.auth.id != ''"
      deals.createRule = "@request.auth.id != ''"
      deals.updateRule = "@request.auth.id != ''"
      deals.deleteRule = "@request.auth.id != ''"
      app.save(deals)
    } catch (_) {}

    try {
      const contacts = app.findCollectionByNameOrId('contacts')
      contacts.listRule = "@request.auth.id != ''"
      contacts.viewRule = "@request.auth.id != ''"
      contacts.createRule = "@request.auth.id != ''"
      contacts.updateRule = "@request.auth.id != ''"
      contacts.deleteRule = "@request.auth.id != ''"
      app.save(contacts)
    } catch (_) {}

    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      empresas.listRule = "@request.auth.id != ''"
      empresas.viewRule = "@request.auth.id != ''"
      empresas.createRule = "@request.auth.id != ''"
      empresas.updateRule = "@request.auth.id != ''"
      empresas.deleteRule = "@request.auth.id != ''"
      app.save(empresas)
    } catch (_) {}

    try {
      const campaigns = app.findCollectionByNameOrId('campaigns')
      campaigns.listRule = "@request.auth.id != ''"
      campaigns.viewRule = "@request.auth.id != ''"
      campaigns.createRule = "@request.auth.id != ''"
      campaigns.updateRule = "@request.auth.id != ''"
      campaigns.deleteRule = "@request.auth.id != ''"
      app.save(campaigns)
    } catch (_) {}

    try {
      const customMetrics = app.findCollectionByNameOrId('custom_metrics')
      customMetrics.listRule = "@request.auth.id != ''"
      customMetrics.viewRule = "@request.auth.id != ''"
      customMetrics.createRule = "@request.auth.id != ''"
      customMetrics.updateRule = "@request.auth.id != ''"
      customMetrics.deleteRule = "@request.auth.id != ''"
      app.save(customMetrics)
    } catch (_) {}
  },
)
