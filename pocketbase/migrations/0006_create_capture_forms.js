/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Create capture_forms collection
    try {
      app.findCollectionByNameOrId('capture_forms')
    } catch (_) {
      const captureForms = new Collection({
        name: 'capture_forms',
        type: 'base',
        listRule: '', // Public read so /captura and /form/:id can load form config
        viewRule: '', // Public read so /captura and /form/:id can load form config
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'title', type: 'text', required: true },
          { name: 'subtitle', type: 'text' },
          { name: 'submit_text', type: 'text', required: true },
          { name: 'success_message', type: 'text', required: true },
          { name: 'accent_color', type: 'text', required: true, pattern: '^#[0-9A-Fa-f]{6}$' },
          {
            name: 'logo',
            type: 'file',
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
          },
          // Field configuration flags (NEVER mark bool as required in PocketBase)
          { name: 'show_phone', type: 'bool' },
          { name: 'require_phone', type: 'bool' },
          { name: 'show_company', type: 'bool' },
          { name: 'require_company', type: 'bool' },
          { name: 'show_position', type: 'bool' },
          { name: 'require_position', type: 'bool' },
          { name: 'show_message', type: 'bool' },
          { name: 'require_message', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_capture_forms_created ON capture_forms (created)'],
      })
      app.save(captureForms)
    }

    // 2. Seed default capture form if none exists
    const col = app.findCollectionByNameOrId('capture_forms')
    try {
      app.findFirstRecordByData('capture_forms', 'name', 'Formulário Principal')
    } catch (_) {
      const record = new Record(col)
      record.set('name', 'Formulário Principal')
      record.set('title', 'Vamos transformar seu processo comercial')
      record.set(
        'subtitle',
        'Preencha o formulário abaixo. Nossa equipe responderá de forma personalizada em menos de 2 horas.',
      )
      record.set('submit_text', 'Enviar solicitação')
      record.set(
        'success_message',
        'Muito obrigado pelo contato. Seu atendimento já foi registrado em nossa esteira comercial. Nossa IA já preparou o contexto e nosso consultor entrará em contato.',
      )
      record.set('accent_color', '#f59e0b') // Amber 500 Linear style
      record.set('show_phone', true)
      record.set('require_phone', false)
      record.set('show_company', true)
      record.set('require_company', false)
      record.set('show_position', true)
      record.set('require_position', false)
      record.set('show_message', true)
      record.set('require_message', false)
      app.save(record)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('capture_forms')
      app.delete(col)
    } catch (_) {}
  },
)
