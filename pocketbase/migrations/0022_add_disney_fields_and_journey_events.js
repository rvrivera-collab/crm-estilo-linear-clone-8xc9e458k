/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const contacts = app.findCollectionByNameOrId('contacts')

    // 1. Novos campos de encantamento / experiência Disney no perfil do cliente (contacts)
    // - nickname: como prefere ser chamado / apelido caloroso
    if (!contacts.fields.getByName('nickname')) {
      contacts.fields.add(
        new TextField({
          name: 'nickname',
          required: false,
        }),
      )
    }

    // - roast_preference: torra preferida (Clara, Média, Escura...)
    if (!contacts.fields.getByName('roast_preference')) {
      contacts.fields.add(
        new TextField({
          name: 'roast_preference',
          required: false,
        }),
      )
    }

    // - brew_method_preference: método de preparo preferido (V60, Prensa Francesa, Espresso, Aeropress...)
    if (!contacts.fields.getByName('brew_method_preference')) {
      contacts.fields.add(
        new TextField({
          name: 'brew_method_preference',
          required: false,
        }),
      )
    }

    // - intensity_preference: intensidade de sabor (Suave/Floral, Frutado/Cítrico, Encorpado/Chocolatudo)
    if (!contacts.fields.getByName('intensity_preference')) {
      contacts.fields.add(
        new TextField({
          name: 'intensity_preference',
          required: false,
        }),
      )
    }

    // - dietary_restrictions: alergias / restrições (Sem lactose, Sem açúcar, Zero cafeína, etc.)
    if (!contacts.fields.getByName('dietary_restrictions')) {
      contacts.fields.add(
        new TextField({
          name: 'dietary_restrictions',
          required: false,
        }),
      )
    }

    // - special_date_description: descrição de outra data importante (ex.: Aniversário do cônjuge, Aniversário de casamento)
    if (!contacts.fields.getByName('special_date_description')) {
      contacts.fields.add(
        new TextField({
          name: 'special_date_description',
          required: false,
        }),
      )
    }

    // - special_date: data importante além do aniversário
    if (!contacts.fields.getByName('special_date')) {
      contacts.fields.add(
        new DateField({
          name: 'special_date',
          required: false,
        }),
      )
    }

    // - acquisition_channel: como conheceu a loja (Indicação de amigo, Instagram, Passou na frente...)
    if (!contacts.fields.getByName('acquisition_channel')) {
      contacts.fields.add(
        new TextField({
          name: 'acquisition_channel',
          required: false,
        }),
      )
    }

    // - service_notes: observações minuciosas de atendimento Disney ("Gosta de café com pouca água", "Adora canela")
    if (!contacts.fields.getByName('service_notes')) {
      contacts.fields.add(
        new TextField({
          name: 'service_notes',
          required: false,
        }),
      )
    }

    app.save(contacts)

    // 2. Criar collection journey_events (linha do tempo oficial e persistente de cada cliente)
    let journeyEvents = null
    try {
      journeyEvents = app.findCollectionByNameOrId('journey_events')
    } catch (_) {
      journeyEvents = new Collection({
        name: 'journey_events',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (owner = @request.auth.id || contact.owner = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (owner = @request.auth.id || contact.owner = @request.auth.id)",
        createRule: "@request.auth.id != ''",
        updateRule:
          "@request.auth.id != '' && (owner = @request.auth.id || contact.owner = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && (owner = @request.auth.id || contact.owner = @request.auth.id)",
        fields: [
          {
            name: 'contact',
            type: 'relation',
            required: true,
            collectionId: contacts.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'owner',
            type: 'relation',
            required: true,
            collectionId: users.id,
            maxSelect: 1,
          },
          {
            name: 'type',
            type: 'select',
            required: true,
            values: [
              'cadastro',
              'compra',
              'nivel_alcancado',
              'cupom_aniversario',
              'whatsapp_enviado',
              'whatsapp_falha',
              'reengajamento',
              'atendimento_especial',
            ],
            maxSelect: 1,
          },
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'channel',
            type: 'text',
          },
          {
            name: 'metadata',
            type: 'json',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_journey_events_contact ON journey_events (contact)',
          'CREATE INDEX idx_journey_events_owner ON journey_events (owner)',
          'CREATE INDEX idx_journey_events_created ON journey_events (created DESC)',
          'CREATE INDEX idx_journey_events_type ON journey_events (type)',
        ],
      })
      app.save(journeyEvents)
    }

    // 3. Backfill inicial dos contatos existentes para terem evento inicial de cadastro e de suas compras se houver
    try {
      const allContacts = app.findRecordsByFilter('contacts', '', '+created', 100, 0)
      for (const c of allContacts) {
        const contactId = c.id
        const ownerId = c.getString('owner') || (users ? users.id : '')
        if (!ownerId) continue

        // Verificar se já existe evento para o contato
        const existing = app.findRecordsByFilter(
          'journey_events',
          `contact = "${contactId}"`,
          '+created',
          1,
          0,
        )
        if (existing.length === 0) {
          const rec = new Record(journeyEvents)
          rec.set('contact', contactId)
          rec.set('owner', ownerId)
          rec.set('type', 'cadastro')
          rec.set('title', 'Boas-vindas à Cafeteria')
          rec.set(
            'description',
            `Cliente ${c.getString('name')} registrado na base. Início da jornada de encantamento Disney.`,
          )
          rec.set('channel', 'presencial')
          app.save(rec)

          const purchasesCount = c.getInt('purchase_count')
          if (purchasesCount > 0) {
            const pRec = new Record(journeyEvents)
            pRec.set('contact', contactId)
            pRec.set('owner', ownerId)
            pRec.set('type', 'compra')
            pRec.set('title', `${purchasesCount} compras acumuladas`)
            pRec.set(
              'description',
              `Histórico de compras e fidelidade consolidado no início da jornada. Total gasto: R$ ${c.getFloat('total_spent')}.`,
            )
            pRec.set('channel', 'loja')
            app.save(pRec)
          }

          if (c.getString('last_coupon_code')) {
            const coupRec = new Record(journeyEvents)
            coupRec.set('contact', contactId)
            coupRec.set('owner', ownerId)
            coupRec.set('type', 'cupom_aniversario')
            coupRec.set('title', 'Cupom de Encantamento Gerado')
            coupRec.set(
              'description',
              `Cupom de presente ${c.getString('last_coupon_code')} concedido.`,
            )
            coupRec.set('channel', 'crm')
            app.save(coupRec)
          }
        }
      }
    } catch (e) {
      console.log('Aviso ao efetuar backfill inicial de jornada:', e)
    }
  },
  (app) => {
    try {
      const journeyEvents = app.findCollectionByNameOrId('journey_events')
      app.delete(journeyEvents)
    } catch (_) {}

    try {
      const contacts = app.findCollectionByNameOrId('contacts')
      const fieldsToRemove = [
        'nickname',
        'roast_preference',
        'brew_method_preference',
        'intensity_preference',
        'dietary_restrictions',
        'special_date_description',
        'special_date',
        'acquisition_channel',
        'service_notes',
      ]
      for (const f of fieldsToRemove) {
        if (contacts.fields.getByName(f)) {
          contacts.fields.removeByName(f)
        }
      }
      app.save(contacts)
    } catch (_) {}
  },
)
