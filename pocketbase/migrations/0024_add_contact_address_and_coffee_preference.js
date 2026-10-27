/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const contacts = app.findCollectionByNameOrId('contacts')

    // 1. phone (já existia no schema inicial, mas garantimos defensivamente)
    if (!contacts.fields.getByName('phone')) {
      contacts.fields.add(
        new TextField({
          name: 'phone',
          required: false,
        }),
      )
    }

    // 2. city (texto)
    if (!contacts.fields.getByName('city')) {
      contacts.fields.add(
        new TextField({
          name: 'city',
          required: false,
        }),
      )
    }

    // 3. state (texto)
    if (!contacts.fields.getByName('state')) {
      contacts.fields.add(
        new TextField({
          name: 'state',
          required: false,
        }),
      )
    }

    // 4. address (texto)
    if (!contacts.fields.getByName('address')) {
      contacts.fields.add(
        new TextField({
          name: 'address',
          required: false,
        }),
      )
    }

    // 5. cpf_cnpj (texto)
    if (!contacts.fields.getByName('cpf_cnpj')) {
      contacts.fields.add(
        new TextField({
          name: 'cpf_cnpj',
          required: false,
        }),
      )
    }

    // 6. coffee_preference (texto livre para preferência detalhada do café da planilha)
    if (!contacts.fields.getByName('coffee_preference')) {
      contacts.fields.add(
        new TextField({
          name: 'coffee_preference',
          required: false,
        }),
      )
    }

    app.save(contacts)

    // Adicionar índices úteis opcionais
    try {
      contacts.addIndex('idx_contacts_city', false, 'city', '')
      contacts.addIndex('idx_contacts_state', false, 'state', '')
      app.save(contacts)
    } catch (e) {
      console.log('Aviso ao adicionar índices de localização em contacts:', e)
    }
  },
  (app) => {
    try {
      const contacts = app.findCollectionByNameOrId('contacts')
      const fieldsToRemove = ['city', 'state', 'address', 'cpf_cnpj', 'coffee_preference']
      for (const f of fieldsToRemove) {
        if (contacts.fields.getByName(f)) {
          contacts.fields.removeByName(f)
        }
      }
      app.save(contacts)
    } catch (_) {}
  },
)
