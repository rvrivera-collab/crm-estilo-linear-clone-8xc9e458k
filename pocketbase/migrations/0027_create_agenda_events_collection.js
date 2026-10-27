/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const contacts = app.findCollectionByNameOrId('contacts')

    // 1. Criar collection "agenda_events"
    // Campos solicitados:
    // owner (relation users, opcional)
    // title (text, obrigatório)
    // date (date, obrigatório)
    // time (text, opcional, formato HH:mm)
    // type (select: follow_up, reuniao_degustacao, entrega, lembrete_pessoal, outro)
    // customer (relation contacts, opcional)
    // notes (text)
    // done (bool, padrão false - nunca marcar como required)
    // created, updated (autodate)
    let agendaCol = null
    try {
      agendaCol = app.findCollectionByNameOrId('agenda_events')
    } catch (_) {
      agendaCol = new Collection({
        name: 'agenda_events',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'date',
            type: 'date',
            required: true,
          },
          {
            name: 'time',
            type: 'text',
          },
          {
            name: 'type',
            type: 'select',
            required: true,
            values: ['follow_up', 'reuniao_degustacao', 'entrega', 'lembrete_pessoal', 'outro'],
            maxSelect: 1,
          },
          {
            name: 'customer',
            type: 'relation',
            collectionId: contacts.id,
            maxSelect: 1,
          },
          {
            name: 'owner',
            type: 'relation',
            collectionId: users.id,
            maxSelect: 1,
          },
          {
            name: 'notes',
            type: 'text',
          },
          {
            name: 'done',
            type: 'bool',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_agenda_date ON agenda_events (date)',
          'CREATE INDEX idx_agenda_customer ON agenda_events (customer)',
          'CREATE INDEX idx_agenda_owner ON agenda_events (owner)',
          'CREATE INDEX idx_agenda_done ON agenda_events (done)',
          'CREATE INDEX idx_agenda_type ON agenda_events (type)',
        ],
      })
      app.save(agendaCol)
    }

    // 2. Expandir select de journey_events para registrar criação/conclusão de eventos de agenda vinculados a cliente
    try {
      const journeyEvents = app.findCollectionByNameOrId('journey_events')
      const typeField = journeyEvents.fields.getByName('type')
      if (typeField && typeField.type === 'select') {
        const currentVals = typeField.values || []
        const needed = ['agenda_criada', 'agenda_concluida']
        let changed = false
        for (const n of needed) {
          if (!currentVals.includes(n)) {
            currentVals.push(n)
            changed = true
          }
        }
        if (changed) {
          typeField.values = currentVals
          app.save(journeyEvents)
        }
      }
    } catch (e) {
      console.log('Aviso ao atualizar valores de tipo em journey_events:', e)
    }

    // 3. Opcional: Seeding de 2-3 compromissos de exemplo se a base tiver contatos
    try {
      const existingContacts = app.findRecordsByFilter('contacts', '', '+created', 3, 0)
      if (existingContacts.length > 0 && agendaCol) {
        const existingAgenda = app.findRecordsByFilter('agenda_events', '', '+created', 1, 0)
        if (existingAgenda.length === 0) {
          const now = new Date()
          const todayISO = now.toISOString().split('T')[0] + ' 12:00:00.000Z'

          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          const tomorrowISO = tomorrow.toISOString().split('T')[0] + ' 12:00:00.000Z'

          const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
          const in3DaysISO = in3Days.toISOString().split('T')[0] + ' 12:00:00.000Z'

          const c0 = existingContacts[0]
          const ownerId = c0.getString('owner') || users.id

          // Evento 1: Degustação hoje
          const ev1 = new Record(agendaCol)
          ev1.set('title', 'Sessão de Degustação de Microlotes V60')
          ev1.set('date', todayISO)
          ev1.set('time', '15:30')
          ev1.set('type', 'reuniao_degustacao')
          ev1.set('customer', c0.id)
          ev1.set('owner', ownerId)
          ev1.set('notes', 'Apresentar novos grãos Catuaí Vermelho com torra média-clara.')
          ev1.set('done', false)
          app.save(ev1)

          if (existingContacts.length > 1) {
            const c1 = existingContacts[1]
            // Evento 2: Follow-up amanhã
            const ev2 = new Record(agendaCol)
            ev2.set('title', 'Ligação de Follow-up de Entrega')
            ev2.set('date', tomorrowISO)
            ev2.set('time', '10:00')
            ev2.set('type', 'follow_up')
            ev2.set('customer', c1.id)
            ev2.set('owner', ownerId)
            ev2.set('notes', 'Verificar se o cliente gostou da moagem para Prensa Francesa.')
            ev2.set('done', false)
            app.save(ev2)
          }

          // Evento 3: Lembrete pessoal em 3 dias
          const ev3 = new Record(agendaCol)
          ev3.set('title', 'Reabastecer estoque de embalagens kraft')
          ev3.set('date', in3DaysISO)
          ev3.set('time', '09:00')
          ev3.set('type', 'lembrete_pessoal')
          ev3.set('owner', ownerId)
          ev3.set('notes', 'Checar fornecedor de sacos com válvula desgaseificadora.')
          ev3.set('done', false)
          app.save(ev3)
        }
      }
    } catch (seedErr) {
      console.log('Aviso ao semear eventos de agenda de exemplo:', seedErr)
    }
  },
  (app) => {
    try {
      const agendaCol = app.findCollectionByNameOrId('agenda_events')
      app.delete(agendaCol)
    } catch (_) {}
  },
)
