/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // 1. Criar coleção empresas
    let empresas
    try {
      empresas = app.findCollectionByNameOrId('empresas')
    } catch (_) {
      empresas = new Collection({
        name: 'empresas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'sector', type: 'text' },
          {
            name: 'size',
            type: 'select',
            values: ['pequena', 'média', 'grande'],
            maxSelect: 1,
          },
          { name: 'website', type: 'url' },
          { name: 'phone', type: 'text' },
          { name: 'email', type: 'email' },
          { name: 'notes', type: 'text' },
          {
            name: 'owner',
            type: 'relation',
            required: true,
            collectionId: users.id,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_empresas_name ON empresas (name)',
          'CREATE INDEX idx_empresas_owner ON empresas (owner)',
          'CREATE INDEX idx_empresas_created ON empresas (created)',
        ],
      })
      app.save(empresas)
    }

    // 2. Atualizar contacts: novo campo empresa (relation -> empresas, opcional)
    const contacts = app.findCollectionByNameOrId('contacts')
    if (!contacts.fields.getByName('empresa')) {
      contacts.fields.add(
        new RelationField({
          name: 'empresa',
          collectionId: empresas.id,
          maxSelect: 1,
        }),
      )
      app.save(contacts)
    }

    // 3. Atualizar deals: novo campo empresa (relation -> empresas, opcional)
    const deals = app.findCollectionByNameOrId('deals')
    if (!deals.fields.getByName('empresa')) {
      deals.fields.add(
        new RelationField({
          name: 'empresa',
          collectionId: empresas.id,
          maxSelect: 1,
        }),
      )
      app.save(deals)
    }

    // 4. Seed idempotente: criar empresas de exemplo a partir dos contatos/deals e vinculá-las
    let defaultOwnerId = ''
    try {
      const admin = app.findFirstRecordByData('users', 'role', 'admin')
      defaultOwnerId = admin.id
    } catch (_) {
      try {
        const anyUser = app.findRecordsByFilter('users', '', '+created', 1, 0)
        if (anyUser.length > 0) defaultOwnerId = anyUser[0].id
      } catch (_) {}
    }

    const seedEmpresas = [
      {
        name: 'Vetor Log',
        sector: 'Logística & Transporte',
        size: 'grande',
        website: 'https://vetorlog.com.br',
        phone: '+55 11 3090-1000',
        email: 'contato@vetorlog.com.br',
        notes: 'Operação logística multi-filial com forte demanda em roteirização.',
      },
      {
        name: 'Pulse Fintech',
        sector: 'Tecnologia Financeira',
        size: 'média',
        website: 'https://pulsefintech.com.br',
        phone: '+55 11 3280-4400',
        email: 'contato@pulsefintech.com.br',
        notes: 'Infraestrutura de pagamentos digitais e open finance.',
      },
      {
        name: 'Aurora Energia',
        sector: 'Energia Renovável',
        size: 'grande',
        website: 'https://auroraenergia.com.br',
        phone: '+55 21 2100-3300',
        email: 'contato@auroraenergia.com.br',
        notes: 'Projetos solares e eólicos para o mercado livre de energia.',
      },
      {
        name: 'Nexo Saúde',
        sector: 'Saúde & Telemedicina',
        size: 'média',
        website: 'https://nexosaude.com.br',
        phone: '+55 31 3400-7200',
        email: 'contato@nexosaude.com.br',
        notes: 'Rede de clínicas parceiras e plataforma de agendamentos.',
      },
      {
        name: 'Orbe Foods',
        sector: 'Alimentos & Bebidas',
        size: 'média',
        website: 'https://orbefoods.com.br',
        phone: '+55 41 3300-8800',
        email: 'contato@orbefoods.com.br',
        notes: 'Indústria alimentícia focada em produtos saudáveis e distribuição varejista.',
      },
      {
        name: 'Alta Cloud',
        sector: 'Computação em Nuvem',
        size: 'pequena',
        website: 'https://altacloud.com.br',
        phone: '+55 51 3100-6600',
        email: 'contato@altacloud.com.br',
        notes: 'Consultoria de migração para cloud e DevOps.',
      },
      {
        name: 'Alpha Soluções',
        sector: 'Consultoria Empresarial',
        size: 'média',
        website: 'https://alphasolucoes.com.br',
        phone: '+55 11 98888-7777',
        email: 'contato@alphasolucoes.com.br',
        notes: 'Consultoria de eficiência operacional e reestruturação.',
      },
      {
        name: 'Adapta',
        sector: 'Educação & Tecnologia',
        size: 'grande',
        website: 'https://adapta.org',
        phone: '+55 11 4004-9000',
        email: 'contato@adapta.org',
        notes: 'Plataforma de IA e aceleração de negócios.',
      },
    ]

    const empresaRecordMap = {}

    for (const emp of seedEmpresas) {
      let rec
      try {
        rec = app.findFirstRecordByData('empresas', 'name', emp.name)
      } catch (_) {
        rec = new Record(empresas)
        rec.set('name', emp.name)
        rec.set('sector', emp.sector)
        rec.set('size', emp.size)
        rec.set('website', emp.website)
        rec.set('phone', emp.phone)
        rec.set('email', emp.email)
        rec.set('notes', emp.notes)
        rec.set('owner', defaultOwnerId)
        app.save(rec)
      }
      empresaRecordMap[emp.name] = rec
    }

    // 5. Vincular contatos existentes à empresa correspondente
    try {
      const allContacts = app.findRecordsByFilter('contacts', '', '+created', 200, 0)
      for (const c of allContacts) {
        const compName = c.getString('company') || ''
        if (!compName) continue

        let targetEmpresa = empresaRecordMap[compName]
        if (!targetEmpresa) {
          try {
            targetEmpresa = app.findFirstRecordByData('empresas', 'name', compName)
          } catch (_) {
            // Criar empresa se não encontrada
            targetEmpresa = new Record(empresas)
            targetEmpresa.set('name', compName)
            targetEmpresa.set('owner', c.getString('owner') || defaultOwnerId)
            app.save(targetEmpresa)
            empresaRecordMap[compName] = targetEmpresa
          }
        }

        if (targetEmpresa && c.getString('empresa') !== targetEmpresa.id) {
          c.set('empresa', targetEmpresa.id)
          app.save(c)
        }
      }
    } catch (e) {
      console.log('Aviso ao vincular contatos:', e)
    }

    // 6. Vincular deals existentes à empresa do contato correspondente
    try {
      const allDeals = app.findRecordsByFilter('deals', '', '+created', 300, 0)
      for (const d of allDeals) {
        if (d.getString('empresa')) continue
        const contactId = d.getString('contact')
        if (!contactId) continue

        try {
          const c = app.findRecordById('contacts', contactId)
          const empresaId = c.getString('empresa')
          if (empresaId) {
            d.set('empresa', empresaId)
            app.save(d)
          }
        } catch (_) {}
      }
    } catch (e) {
      console.log('Aviso ao vincular deals:', e)
    }

    // 7. Atualizar ferramentas e prompt do agente crm-copilot
    try {
      $ai.agents.define(app, {
        slug: 'crm-copilot',
        name: 'Ask CRM',
        description:
          'Copiloto comercial interno com acesso e execução direta sobre os dados do CRM.',
        systemPrompt: `Você é o Ask CRM, copiloto comercial interno do CRM Adapta (estilo Linear).
Responda sempre em português do Brasil (pt-BR), com tom conciso, direto, técnico e executivo.

ESTRUTURA RELACIONAL DO CRM:
O CRM segue a tríade relacional clássica:
  contato -> empresa -> negócio
- Empresas concentram os dados da conta comercial (setor, porte, site, contatos e negócios vinculados).
- Contatos representam as pessoas/decisores da empresa (vinculados pelo campo "empresa").
- Negócios representam as oportunidades comerciais (vinculados tanto ao "contact" quanto à "empresa").

VOCÊ TEM ACESSO DIRETO A TOOLS SOBRE AS SEGUINTES COLEÇÕES:
1. empresas: contas/empresas corporativas (name, sector, size: 'pequena'|'média'|'grande', website, phone, email, notes, owner). Permissões: list, read, create, update.
2. contacts: contatos/decisores/leads (name, email, phone, company: texto, empresa: relação para empresas, position, status, notes, custom_fields). Permissões: list, read, create, update.
3. deals: negócios e oportunidades comerciais. Campos obrigatórios ao criar: code (no formato 'NEG-XXXX', ex: NEG-1018), title, value (número >= 0), stage (id de pipeline_stages), status ('aberto', 'ganho', 'perdido'), contact (id de contacts), empresa (id de empresas, sempre vincule quando houver), owner (id do usuário auth atual), position (número inteiro >= 1). Permissões: list, read, create, update.
4. pipeline_stages: estágios do funil (Prospecção, Qualificação, Proposta, Negociação, Fechamento). Permissões: list, read.
5. activities: timeline de interações comerciais (tipo: 'nota' | 'email' | 'ligacao' | 'reuniao' | 'sistema', content, deal, contact, author). Permissões: list, read, create.
6. campaigns: campanhas ativas de captação (name, description, status). Permissões: list, read.

REGRAS DE EXECUÇÃO:
- Ao receber comandos de criação de oportunidade ou lead para uma empresa (ex: "Crie uma nova oportunidade para a empresa Alpha Soluções no estágio Qualificação, valor R$ 50.000"):
  1. Verifique se a empresa já existe na coleção empresas. Se não existir, crie-a com name = nome da empresa, owner = id do usuário.
  2. Verifique se já existe um contato para essa empresa na coleção contacts. Se não existir, crie um contato com name = nome da empresa (ou nome informado), company = nome da empresa, empresa = id da empresa, status = 'lead'.
  3. Se o contato já existir mas não estiver vinculado à empresa, atualize o campo empresa do contato.
  4. Descubra o maior número NEG-XXXX atual listando deals ordenados por -code ou analisando os existentes, e gere o próximo código sequencial (ex: NEG-1018).
  5. Obtenha o id do estágio correspondente em pipeline_stages.
  6. Crie o negócio na coleção deals com os dados solicitados (code, title ex: "Oportunidade " + Empresa, value numérico, stage, status: 'aberto', contact: id do contato, empresa: id da empresa, owner: id do usuário, position: 1).
  7. Crie uma atividade de tipo 'sistema' ou 'nota' na coleção activities vinculando o deal e contato recém-criados.
  8. Conclua SEMPRE gerando uma resposta final em texto confirmando detalhadamente a criação, citando explicitamente o código criado em formato de chip NEG-XXXX, a empresa vinculada, o contato, o estágio e o valor em Real (ex: R$ 50.000).

- Ao consultar empresas:
  - Utilize a coleção empresas para buscar informações cadastrais e cruze com contatos e negócios vinculados.
  - Apresente indicadores como total em pipeline da empresa e contatos ativos.

- Ao analisar negócios parados, sem contato ou riscos:
  - Liste os negócios abertos (status = 'aberto').
  - Compare last_contact_at (ou data de criação) com a data atual.
  - Apresente os negócios encontrados destacando o código NEG-XXXX, empresa, estágio, valor e dias sem contato.

- FORMATO DE RESPOSTA:
  - Sempre cite os códigos no formato NEG-XXXX para que a interface renderize os chips interativos clicáveis.
  - Formate valores monetários em Real (ex: R$ 45.000).
  - Nunca invente dados: use sempre as ferramentas para ler e manipular os registros reais.
  - SEMPRE entregue uma resposta completa em texto ao usuário após usar as ferramentas.`,
        tier: 'fast',
        tools: [
          { collection: 'empresas', perms: { list: true, read: true, create: true, update: true } },
          { collection: 'contacts', perms: { list: true, read: true, create: true, update: true } },
          { collection: 'deals', perms: { list: true, read: true, create: true, update: true } },
          { collection: 'pipeline_stages', perms: { list: true, read: true } },
          { collection: 'activities', perms: { list: true, read: true, create: true } },
          { collection: 'campaigns', perms: { list: true, read: true } },
        ],
      })
    } catch (e) {
      console.log('Aviso ao atualizar agente crm-copilot:', e)
    }
  },
  (app) => {
    try {
      const deals = app.findCollectionByNameOrId('deals')
      const dealEmpresaField = deals.fields.getByName('empresa')
      if (dealEmpresaField) {
        deals.fields.removeById(dealEmpresaField.id)
        app.save(deals)
      }
    } catch (_) {}

    try {
      const contacts = app.findCollectionByNameOrId('contacts')
      const contactEmpresaField = contacts.fields.getByName('empresa')
      if (contactEmpresaField) {
        contacts.fields.removeById(contactEmpresaField.id)
        app.save(contacts)
      }
    } catch (_) {}

    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      app.delete(empresas)
    } catch (_) {}
  },
)
