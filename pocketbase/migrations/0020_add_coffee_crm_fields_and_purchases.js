/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const contacts = app.findCollectionByNameOrId('contacts')

    // 1. Adicionar campos específicos de Cafés Especiais na collection contacts
    if (!contacts.fields.getByName('birthday')) {
      contacts.fields.add(
        new DateField({
          name: 'birthday',
          required: false,
        }),
      )
    }

    if (!contacts.fields.getByName('purchase_count')) {
      contacts.fields.add(
        new NumberField({
          name: 'purchase_count',
          min: 0,
          onlyInt: true,
          required: false,
        }),
      )
    }

    if (!contacts.fields.getByName('last_purchase_date')) {
      contacts.fields.add(
        new DateField({
          name: 'last_purchase_date',
          required: false,
        }),
      )
    }

    if (!contacts.fields.getByName('total_spent')) {
      contacts.fields.add(
        new NumberField({
          name: 'total_spent',
          min: 0,
          required: false,
        }),
      )
    }

    if (!contacts.fields.getByName('last_coupon_code')) {
      contacts.fields.add(
        new TextField({
          name: 'last_coupon_code',
          required: false,
        }),
      )
    }

    if (!contacts.fields.getByName('last_coupon_date')) {
      contacts.fields.add(
        new DateField({
          name: 'last_coupon_date',
          required: false,
        }),
      )
    }

    if (!contacts.fields.getByName('last_reengagement_date')) {
      contacts.fields.add(
        new DateField({
          name: 'last_reengagement_date',
          required: false,
        }),
      )
    }

    if (!contacts.fields.getByName('favorite_coffee')) {
      contacts.fields.add(
        new TextField({
          name: 'favorite_coffee',
          required: false,
        }),
      )
    }

    app.save(contacts)

    // Adicionar índices úteis em contacts
    try {
      contacts.addIndex('idx_contacts_birthday', false, 'birthday', '')
      contacts.addIndex('idx_contacts_last_purchase', false, 'last_purchase_date', '')
      app.save(contacts)
    } catch (e) {
      console.log('Aviso ao adicionar índices em contacts:', e)
    }

    // 2. Criar collection purchases (histórico de compras)
    let purchases = null
    try {
      purchases = app.findCollectionByNameOrId('purchases')
    } catch (_) {
      purchases = new Collection({
        name: 'purchases',
        type: 'base',
        listRule: "@request.auth.id != '' && owner = @request.auth.id",
        viewRule: "@request.auth.id != '' && owner = @request.auth.id",
        createRule: "@request.auth.id != '' && owner = @request.auth.id",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
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
            name: 'amount',
            type: 'number',
            min: 0,
            required: false,
          },
          {
            name: 'purchase_date',
            type: 'date',
            required: true,
          },
          {
            name: 'items_description',
            type: 'text',
          },
          {
            name: 'notes',
            type: 'text',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_purchases_contact ON purchases (contact)',
          'CREATE INDEX idx_purchases_date ON purchases (purchase_date)',
          'CREATE INDEX idx_purchases_owner ON purchases (owner)',
        ],
      })
      app.save(purchases)
    }
  },
  (app) => {
    try {
      const purchases = app.findCollectionByNameOrId('purchases')
      app.delete(purchases)
    } catch (_) {}

    try {
      const contacts = app.findCollectionByNameOrId('contacts')
      const fieldsToRemove = [
        'birthday',
        'purchase_count',
        'last_purchase_date',
        'total_spent',
        'last_coupon_code',
        'last_coupon_date',
        'last_reengagement_date',
        'favorite_coffee',
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
