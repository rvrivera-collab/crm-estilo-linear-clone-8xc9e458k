/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const deals = app.findCollectionByNameOrId('deals')
    const valueField = deals.fields.getByName('value')
    if (valueField) {
      valueField.required = false
      app.save(deals)
    }
  },
  (app) => {
    const deals = app.findCollectionByNameOrId('deals')
    const valueField = deals.fields.getByName('value')
    if (valueField) {
      valueField.required = true
      app.save(deals)
    }
  },
)
