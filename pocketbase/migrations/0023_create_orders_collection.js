/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const contacts = app.findCollectionByNameOrId('contacts')

    // 1. Criar collection "orders" (funil de pedidos / cards de negociação)
    // Estágios solicitados pelo usuário:
    // "pedido feito", "pedido enviado", "pedido recebido", "pedir avaliação do google", e opcional "concluido"
    // Usaremos os slugs: pedido_feito, pedido_enviado, pedido_recebido, pedir_avaliacao_google, concluido
    let ordersCol = null
    try {
      ordersCol = app.findCollectionByNameOrId('orders')
    } catch (_) {
      ordersCol = new Collection({
        name: 'orders',
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
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'items_description',
            type: 'text',
          },
          {
            name: 'value',
            type: 'number',
          },
          {
            name: 'stage',
            type: 'select',
            required: true,
            values: [
              'pedido_feito',
              'pedido_enviado',
              'pedido_recebido',
              'pedir_avaliacao_google',
              'concluido',
            ],
            maxSelect: 1,
          },
          {
            name: 'tracking_code',
            type: 'text',
          },
          {
            name: 'google_review_requested',
            type: 'bool',
          },
          {
            name: 'google_review_date',
            type: 'date',
          },
          {
            name: 'notes',
            type: 'text',
          },
          {
            name: 'position',
            type: 'number',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_orders_contact ON orders (contact)',
          'CREATE INDEX idx_orders_owner ON orders (owner)',
          'CREATE INDEX idx_orders_stage ON orders (stage)',
          'CREATE INDEX idx_orders_created ON orders (created DESC)',
          'CREATE INDEX idx_orders_position ON orders (position)',
        ],
      })
      app.save(ordersCol)
    }

    // 2. Expandir select de journey_events se necessário para contemplar eventos de pedido e avaliação
    try {
      const journeyEvents = app.findCollectionByNameOrId('journey_events')
      const typeField = journeyEvents.fields.getByName('type')
      if (typeField && typeField.type === 'select') {
        const currentVals = typeField.values || []
        const needed = ['pedido_criado', 'pedido_movido', 'avaliacao_google_solicitada']
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

    // 3. Seed inicial opcional de 2-3 pedidos representativos vinculados aos contatos existentes
    try {
      const existingContacts = app.findRecordsByFilter('contacts', '', '+created', 5, 0)
      if (existingContacts.length > 0 && ordersCol) {
        const existingOrders = app.findRecordsByFilter('orders', '', '+created', 1, 0)
        if (existingOrders.length === 0) {
          const c0 = existingContacts[0]
          const ownerId = c0.getString('owner') || users.id

          // Pedido 1: Pedido feito
          const o1 = new Record(ordersCol)
          o1.set('contact', c0.id)
          o1.set('owner', ownerId)
          o1.set('title', 'Kit Degustação Microlotes Raros')
          o1.set('items_description', '2x Geisha Floral 250g + 1x Bourbon Amarelo Fermentado')
          o1.set('value', 185)
          o1.set('stage', 'pedido_feito')
          o1.set('position', 1)
          o1.set('notes', 'Cliente solicitou moagem fina para filtro V60.')
          app.save(o1)

          if (existingContacts.length > 1) {
            const c1 = existingContacts[1]
            // Pedido 2: Pedido enviado
            const o2 = new Record(ordersCol)
            o2.set('contact', c1.id)
            o2.set('owner', ownerId)
            o2.set('title', 'Assinatura Mensal Grãos Especiais')
            o2.set('items_description', '1kg Blend Nobre Torra Média em Grãos')
            o2.set('value', 120)
            o2.set('stage', 'pedido_enviado')
            o2.set('tracking_code', 'BR9876543210')
            o2.set('position', 1)
            o2.set('notes', 'Enviado via Sedex express com brinde surpresa.')
            app.save(o2)
          }

          if (existingContacts.length > 2) {
            const c2 = existingContacts[2]
            // Pedido 3: Pedir avaliação do Google
            const o3 = new Record(ordersCol)
            o3.set('contact', c2.id)
            o3.set('owner', ownerId)
            o3.set('title', 'Café Especial Catuaí Vermelho 500g')
            o3.set('items_description', '2x 250g Catuaí Vermelho Processo Natural')
            o3.set('value', 92)
            o3.set('stage', 'pedir_avaliacao_google')
            o3.set('position', 1)
            o3.set('google_review_requested', false)
            o3.set('notes', 'Cliente recebeu o pacote com sucesso e elogiou o aroma!')
            app.save(o3)
          }
        }
      }
    } catch (seedErr) {
      console.log('Aviso ao semear pedidos de exemplo:', seedErr)
    }
  },
  (app) => {
    try {
      const ordersCol = app.findCollectionByNameOrId('orders')
      app.delete(ordersCol)
    } catch (_) {}
  },
)
