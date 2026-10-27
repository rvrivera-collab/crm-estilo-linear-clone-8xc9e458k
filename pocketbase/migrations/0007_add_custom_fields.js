/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Add custom_fields to capture_forms
    const captureFormsCol = app.findCollectionByNameOrId('capture_forms')
    if (!captureFormsCol.fields.getByName('custom_fields')) {
      captureFormsCol.fields.add(
        new JSONField({
          name: 'custom_fields',
          required: false,
        }),
      )
      app.save(captureFormsCol)
    }

    // 2. Add custom_fields to contacts
    const contactsCol = app.findCollectionByNameOrId('contacts')
    if (!contactsCol.fields.getByName('custom_fields')) {
      contactsCol.fields.add(
        new JSONField({
          name: 'custom_fields',
          required: false,
        }),
      )
      app.save(contactsCol)
    }
  },
  (app) => {
    try {
      const captureFormsCol = app.findCollectionByNameOrId('capture_forms')
      const cfField = captureFormsCol.fields.getByName('custom_fields')
      if (cfField) {
        captureFormsCol.fields.remove(cfField)
        app.save(captureFormsCol)
      }
    } catch (_) {}

    try {
      const contactsCol = app.findCollectionByNameOrId('contacts')
      const contactCfField = contactsCol.fields.getByName('custom_fields')
      if (contactCfField) {
        contactsCol.fields.remove(contactCfField)
        app.save(contactsCol)
      }
    } catch (_) {}
  },
)
