/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['admin', 'member'],
          maxSelect: 1,
        }),
      )
      app.save(users)
    }

    const pipelineStages = new Collection({
      name: 'pipeline_stages',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'color', type: 'text', required: true, pattern: '^#[0-9A-Fa-f]{6}$' },
        { name: 'order', type: 'number', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_pipeline_stages_order ON pipeline_stages (`order`)'],
    })
    app.save(pipelineStages)

    const contacts = new Collection({
      name: 'contacts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'text' },
        { name: 'company', type: 'text' },
        { name: 'position', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['lead', 'ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'owner', type: 'relation', required: true, collectionId: users.id, maxSelect: 1 },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contacts_status ON contacts (status)',
        'CREATE INDEX idx_contacts_owner ON contacts (owner)',
        'CREATE INDEX idx_contacts_created ON contacts (created)',
      ],
    })
    app.save(contacts)

    const deals = new Collection({
      name: 'deals',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'code', type: 'text', required: true, pattern: '^NEG-[0-9]{4,}$' },
        { name: 'title', type: 'text', required: true },
        { name: 'value', type: 'number', required: true, min: 0 },
        {
          name: 'stage',
          type: 'relation',
          required: true,
          collectionId: pipelineStages.id,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aberto', 'ganho', 'perdido'],
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contacts.id,
          maxSelect: 1,
        },
        { name: 'owner', type: 'relation', required: true, collectionId: users.id, maxSelect: 1 },
        { name: 'expected_close', type: 'date' },
        { name: 'position', type: 'number', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_deals_code ON deals (code)',
        'CREATE INDEX idx_deals_stage ON deals (stage)',
        'CREATE INDEX idx_deals_owner ON deals (owner)',
        'CREATE INDEX idx_deals_status ON deals (status)',
        'CREATE INDEX idx_deals_position ON deals (position)',
      ],
    })
    app.save(deals)

    const activities = new Collection({
      name: 'activities',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['nota', 'email', 'ligacao', 'reuniao', 'sistema'],
          maxSelect: 1,
        },
        { name: 'content', type: 'text', required: true },
        { name: 'contact', type: 'relation', collectionId: contacts.id, maxSelect: 1 },
        { name: 'deal', type: 'relation', collectionId: deals.id, maxSelect: 1 },
        { name: 'author', type: 'relation', required: true, collectionId: users.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_activities_deal ON activities (deal)',
        'CREATE INDEX idx_activities_contact ON activities (contact)',
        'CREATE INDEX idx_activities_created ON activities (created)',
      ],
    })
    app.save(activities)

    const askConversations = new Collection({
      name: 'ask_conversations',
      type: 'base',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: "@request.auth.id != ''",
      updateRule: 'user = @request.auth.id',
      deleteRule: 'user = @request.auth.id',
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_ask_conversations_user ON ask_conversations (user)'],
    })
    app.save(askConversations)

    const askMessages = new Collection({
      name: 'ask_messages',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'conversation',
          type: 'relation',
          required: true,
          collectionId: askConversations.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['user', 'assistant'],
          maxSelect: 1,
        },
        { name: 'content', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ask_messages_conversation_created ON ask_messages (conversation, created)',
      ],
    })
    app.save(askMessages)
  },
  (app) => {
    const names = [
      'ask_messages',
      'ask_conversations',
      'activities',
      'deals',
      'contacts',
      'pipeline_stages',
    ]
    for (const name of names) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
    const users = app.findCollectionByNameOrId('users')
    const role = users.fields.getByName('role')
    if (role) {
      users.fields.removeById(role.id)
      app.save(users)
    }
  },
)
