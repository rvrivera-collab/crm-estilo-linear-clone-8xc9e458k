/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const contacts = app.findCollectionByNameOrId('contacts')

    // 1. Três caixas de marcação (mimos já enviados pela São Domingos)
    // - sent_mug: Já enviei a caneca da São Domingos (bool, default false, não obrigatório)
    if (!contacts.fields.getByName('sent_mug')) {
      contacts.fields.add(
        new BoolField({
          name: 'sent_mug',
          required: false,
        }),
      )
    }

    // - sent_welcome_folder: Já enviei o folder de boas-vindas (bool, default false, não obrigatório)
    if (!contacts.fields.getByName('sent_welcome_folder')) {
      contacts.fields.add(
        new BoolField({
          name: 'sent_welcome_folder',
          required: false,
        }),
      )
    }

    // - sent_stickers: Já enviei os adesivos (bool, default false, não obrigatório)
    if (!contacts.fields.getByName('sent_stickers')) {
      contacts.fields.add(
        new BoolField({
          name: 'sent_stickers',
          required: false,
        }),
      )
    }

    // 2. Seção Experiência Disney:
    // - coffee_machine: Máquina de café que o cliente possui (texto / seleção com outro)
    if (!contacts.fields.getByName('coffee_machine')) {
      contacts.fields.add(
        new TextField({
          name: 'coffee_machine',
          required: false,
        }),
      )
    }

    // Nota: O campo brew_method_preference já existe na collection contacts como TextField.
    // Garantimos que esteja presente para "Método preferido de consumo do café".
    if (!contacts.fields.getByName('brew_method_preference')) {
      contacts.fields.add(
        new TextField({
          name: 'brew_method_preference',
          required: false,
        }),
      )
    }

    app.save(contacts)
  },
  (app) => {
    try {
      const contacts = app.findCollectionByNameOrId('contacts')
      const fieldsToRemove = ['sent_mug', 'sent_welcome_folder', 'sent_stickers', 'coffee_machine']
      for (const f of fieldsToRemove) {
        if (contacts.fields.getByName(f)) {
          contacts.fields.removeByName(f)
        }
      }
      app.save(contacts)
    } catch (_) {}
  },
)
