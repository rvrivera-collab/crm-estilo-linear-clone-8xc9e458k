/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('users', 'teste@direto.app')
      adminUser.set('name', 'Adapta')
      adminUser.set('role', 'admin')
      adminUser.setVerified(true)
      app.save(adminUser)
    } catch (_) {
      try {
        adminUser = app.findAuthRecordByEmail('users', 'felipe.lemos@adapta.org')
        adminUser.setEmail('teste@direto.app')
        adminUser.setPassword('Direto@2026')
        adminUser.set('name', 'Adapta')
        adminUser.set('role', 'admin')
        adminUser.setVerified(true)
        app.save(adminUser)
      } catch (_) {
        adminUser = new Record(users)
        adminUser.setEmail('teste@direto.app')
        adminUser.setPassword('Direto@2026')
        adminUser.setVerified(true)
        adminUser.set('name', 'Adapta')
        adminUser.set('role', 'admin')
        app.save(adminUser)
      }
    }

    const stagesData = [
      { name: 'Prospecção', color: '#9BA0AB', order: 1 },
      { name: 'Qualificação', color: '#FFB224', order: 2 },
      { name: 'Proposta', color: '#58A6FF', order: 3 },
      { name: 'Negociação', color: '#BC8CFF', order: 4 },
      { name: 'Fechamento', color: '#3FB950', order: 5 },
    ]
    const stages = app.findCollectionByNameOrId('pipeline_stages')
    for (const data of stagesData) {
      try {
        app.findFirstRecordByData('pipeline_stages', 'name', data.name)
      } catch (_) {
        const record = new Record(stages)
        record.set('name', data.name)
        record.set('color', data.color)
        record.set('order', data.order)
        app.save(record)
      }
    }

    const contactsData = [
      {
        name: 'Mariana Duarte',
        email: 'mariana.duarte@vetorlog.com.br',
        phone: '+55 11 98732-1048',
        company: 'Vetor Log',
        position: 'Head de Vendas',
        status: 'ativo',
        notes: 'Busca consolidar o processo comercial de três unidades.',
      },
      {
        name: 'Rafael Nogueira',
        email: 'rafael.nogueira@pulsefintech.com.br',
        phone: '+55 11 99814-2280',
        company: 'Pulse Fintech',
        position: 'CTO',
        status: 'lead',
        notes: 'Prioridade em integrações e segurança.',
      },
      {
        name: 'Camila Ferreira',
        email: 'camila@auroraenergia.com.br',
        phone: '+55 21 99210-3341',
        company: 'Aurora Energia',
        position: 'Diretora Comercial',
        status: 'ativo',
        notes: 'Expansão da operação para o Sul no próximo trimestre.',
      },
      {
        name: 'Bruno Almeida',
        email: 'bruno.almeida@nexosaude.com.br',
        phone: '+55 31 98444-7215',
        company: 'Nexo Saúde',
        position: 'Gerente de Operações',
        status: 'lead',
        notes: 'Mapeando fornecedores para o segundo semestre.',
      },
      {
        name: 'Juliana Costa',
        email: 'juliana.costa@orbefoods.com.br',
        phone: '+55 41 99701-8892',
        company: 'Orbe Foods',
        position: 'CEO',
        status: 'ativo',
        notes: 'Decisora final e patrocinadora do projeto.',
      },
      {
        name: 'Diego Martins',
        email: 'diego@altacloud.com.br',
        phone: '+55 51 99125-6610',
        company: 'Alta Cloud',
        position: 'VP de Receita',
        status: 'inativo',
        notes: 'Retomar contato no início do próximo ciclo fiscal.',
      },
    ]
    const contacts = app.findCollectionByNameOrId('contacts')
    for (const data of contactsData) {
      try {
        app.findFirstRecordByData('contacts', 'email', data.email)
      } catch (_) {
        const record = new Record(contacts)
        record.set('name', data.name)
        record.set('email', data.email)
        record.set('phone', data.phone)
        record.set('company', data.company)
        record.set('position', data.position)
        record.set('status', data.status)
        record.set('owner', adminUser.id)
        record.set('notes', data.notes)
        app.save(record)
      }
    }

    const dealsData = [
      {
        code: 'NEG-1001',
        title: 'Expansão nacional Vetor Log',
        value: 120000,
        stage: 'Negociação',
        contact: 'mariana.duarte@vetorlog.com.br',
        status: 'aberto',
        position: 1,
        expected: '2026-09-22 18:00:00.000Z',
      },
      {
        code: 'NEG-1002',
        title: 'Plataforma enterprise Pulse',
        value: 78000,
        stage: 'Proposta',
        contact: 'rafael.nogueira@pulsefintech.com.br',
        status: 'aberto',
        position: 1,
        expected: '2026-09-27 18:00:00.000Z',
      },
      {
        code: 'NEG-1003',
        title: 'Operação Sul Aurora',
        value: 64000,
        stage: 'Qualificação',
        contact: 'camila@auroraenergia.com.br',
        status: 'aberto',
        position: 1,
        expected: '2026-10-08 18:00:00.000Z',
      },
      {
        code: 'NEG-1004',
        title: 'Automação de atendimento Nexo',
        value: 32000,
        stage: 'Prospecção',
        contact: 'bruno.almeida@nexosaude.com.br',
        status: 'aberto',
        position: 1,
        expected: '2026-10-15 18:00:00.000Z',
      },
      {
        code: 'NEG-1005',
        title: 'Inteligência comercial Orbe',
        value: 48000,
        stage: 'Fechamento',
        contact: 'juliana.costa@orbefoods.com.br',
        status: 'ganho',
        position: 1,
        expected: '2026-09-12 18:00:00.000Z',
      },
      {
        code: 'NEG-1006',
        title: 'Retomada Alta Cloud',
        value: 18000,
        stage: 'Prospecção',
        contact: 'diego@altacloud.com.br',
        status: 'aberto',
        position: 2,
        expected: '2026-10-28 18:00:00.000Z',
      },
      {
        code: 'NEG-1007',
        title: 'Módulo de previsão Vetor',
        value: 42000,
        stage: 'Proposta',
        contact: 'mariana.duarte@vetorlog.com.br',
        status: 'aberto',
        position: 2,
        expected: '2026-09-30 18:00:00.000Z',
      },
      {
        code: 'NEG-1008',
        title: 'Piloto executivo Nexo',
        value: 8000,
        stage: 'Qualificação',
        contact: 'bruno.almeida@nexosaude.com.br',
        status: 'perdido',
        position: 2,
        expected: '2026-09-10 18:00:00.000Z',
      },
    ]
    const deals = app.findCollectionByNameOrId('deals')
    for (const data of dealsData) {
      try {
        app.findFirstRecordByData('deals', 'code', data.code)
      } catch (_) {
        const stage = app.findFirstRecordByData('pipeline_stages', 'name', data.stage)
        const contact = app.findFirstRecordByData('contacts', 'email', data.contact)
        const record = new Record(deals)
        record.set('code', data.code)
        record.set('title', data.title)
        record.set('value', data.value)
        record.set('stage', stage.id)
        record.set('status', data.status)
        record.set('contact', contact.id)
        record.set('owner', felipe.id)
        record.set('expected_close', data.expected)
        record.set('position', data.position)
        app.save(record)
      }
    }

    const activitiesData = [
      {
        type: 'nota',
        content: 'Mariana confirmou reunião com o comitê para revisar condições finais.',
        contact: 'mariana.duarte@vetorlog.com.br',
        deal: 'NEG-1001',
      },
      {
        type: 'reuniao',
        content: 'Demonstração técnica concluída; integração com ERP validada.',
        contact: 'rafael.nogueira@pulsefintech.com.br',
        deal: 'NEG-1002',
      },
      {
        type: 'ligacao',
        content: 'Camila pediu estudo de ROI antes de envolver o financeiro.',
        contact: 'camila@auroraenergia.com.br',
        deal: 'NEG-1003',
      },
      {
        type: 'sistema',
        content: 'Negócio NEG-1004 criado a partir do contato Bruno Almeida.',
        contact: 'bruno.almeida@nexosaude.com.br',
        deal: 'NEG-1004',
      },
    ]
    const activities = app.findCollectionByNameOrId('activities')
    for (const data of activitiesData) {
      try {
        app.findFirstRecordByData('activities', 'content', data.content)
      } catch (_) {
        const contact = app.findFirstRecordByData('contacts', 'email', data.contact)
        const deal = app.findFirstRecordByData('deals', 'code', data.deal)
        const record = new Record(activities)
        record.set('type', data.type)
        record.set('content', data.content)
        record.set('contact', contact.id)
        record.set('deal', deal.id)
        record.set('author', adminUser.id)
        app.save(record)
      }
    }
  },
  (app) => {
    const activityContents = [
      'Mariana confirmou reunião com o comitê para revisar condições finais.',
      'Demonstração técnica concluída; integração com ERP validada.',
      'Camila pediu estudo de ROI antes de envolver o financeiro.',
      'Negócio NEG-1004 criado a partir do contato Bruno Almeida.',
    ]
    for (const content of activityContents) {
      try {
        app.delete(app.findFirstRecordByData('activities', 'content', content))
      } catch (_) {}
    }
    for (let i = 1001; i <= 1008; i++) {
      try {
        app.delete(app.findFirstRecordByData('deals', 'code', 'NEG-' + i))
      } catch (_) {}
    }
    const emails = [
      'mariana.duarte@vetorlog.com.br',
      'rafael.nogueira@pulsefintech.com.br',
      'camila@auroraenergia.com.br',
      'bruno.almeida@nexosaude.com.br',
      'juliana.costa@orbefoods.com.br',
      'diego@altacloud.com.br',
    ]
    for (const email of emails) {
      try {
        app.delete(app.findFirstRecordByData('contacts', 'email', email))
      } catch (_) {}
    }
    const stageNames = ['Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Fechamento']
    for (const name of stageNames) {
      try {
        app.delete(app.findFirstRecordByData('pipeline_stages', 'name', name))
      } catch (_) {}
    }
    try {
      app.delete(app.findAuthRecordByEmail('users', 'teste@direto.app'))
    } catch (_) {}
    try {
      app.delete(app.findAuthRecordByEmail('users', 'felipe.lemos@adapta.org'))
    } catch (_) {}
  },
)
