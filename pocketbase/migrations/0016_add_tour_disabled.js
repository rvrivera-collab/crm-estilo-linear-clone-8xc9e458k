/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users) return

    const existing = users.fields.getByName('tour_disabled')
    if (!existing) {
      users.fields.add(
        new BoolField({
          name: 'tour_disabled',
          required: false,
        }),
      )
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users) return

    const existing = users.fields.getByName('tour_disabled')
    if (existing) {
      users.fields.removeByName('tour_disabled')
      app.save(users)
    }
  },
)
