/// <reference path="../pb_data/types.d.ts" />

/**
 * 0036 — Adiciona:
 * 1. Campo `city` (text, max: 120) na coleção `empresas` (Empresas/B2B)
 * 2. Campo `products` (json) na coleção `resellers` (Pontos de Revenda: IDs dos produtos revendidos)
 */
migrate(
  (app) => {
    // 1. Campo city em empresas
    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      if (!empresas.fields.getByName('city')) {
        empresas.fields.add(
          new TextField({
            name: 'city',
            required: false,
            max: 120,
          }),
        )
        app.save(empresas)
      }
    } catch (e) {
      console.log('Aviso ao adicionar campo city em empresas:', e)
    }

    // 2. Campo products em resellers
    try {
      const resellers = app.findCollectionByNameOrId('resellers')
      if (!resellers.fields.getByName('products')) {
        resellers.fields.add(
          new JSONField({
            name: 'products',
            required: false,
          }),
        )
        app.save(resellers)
      }
    } catch (e) {
      console.log('Aviso ao adicionar campo products em resellers:', e)
    }
  },
  (app) => {
    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      if (empresas.fields.getByName('city')) {
        empresas.fields.removeByName('city')
        app.save(empresas)
      }
    } catch (_) {}

    try {
      const resellers = app.findCollectionByNameOrId('resellers')
      if (resellers.fields.getByName('products')) {
        resellers.fields.removeByName('products')
        app.save(resellers)
      }
    } catch (_) {}
  },
)
