/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users) return

    const existing = users.fields.getByName('tour_seen_pages')
    if (!existing) {
      users.fields.add(
        new Field({
          name: 'tour_seen_pages',
          type: 'json',
          required: false,
        }),
      )
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users) return

    const existing = users.fields.getByName('tour_seen_pages')
    if (existing) {
      users.fields.removeByName('tour_seen_pages')
      app.save(users)
    }
  },
)
