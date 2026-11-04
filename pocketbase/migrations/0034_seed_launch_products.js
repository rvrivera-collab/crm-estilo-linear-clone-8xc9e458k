/// <reference path="../pb_data/types.d.ts" />

/**
 * 0034 — Lançamento inicial do catálogo de produtos (Café São Domingos).
 *
 * Insere 6 produtos na coleção `products` (ativos, sem custo nem estoque),
 * conforme o catálogo do WhatsApp Business do dono.
 * Idempotente: cada produto é procurado pelo nome exato (e dono) antes de ser criado,
 * então re-executar a migration não duplica registros.
 */
migrate(
  (app) => {
    // Dono dos produtos: mesma escolha de owner usada nos seeds anteriores
    let ownerId = ''
    for (const email of ['saodomingosfaz@gmail.com', 'teste@direto.app']) {
      try {
        ownerId = app.findFirstRecordByData('users', 'email', email).id
        break
      } catch (_) {}
    }
    if (!ownerId) {
      try {
        ownerId = app.findFirstRecordByData('users', 'role', 'admin').id
      } catch (_) {
        const allUsers = app.findRecordsByFilter('users', '', '+created', 1, 0)
        if (allUsers.length > 0) ownerId = allUsers[0].id
      }
    }
    if (!ownerId) {
      console.log('Nenhum usuário encontrado para lançar produtos do catálogo.')
      return
    }

    const productsCol = app.findCollectionByNameOrId('products')
    const SD_DESC = 'Nosso Café Especial possui 85 PONTOS'

    const catalog = [
      {
        name: 'Cápsulas (Nespresso) - cx 10un',
        category: 'capsula',
        sale_price: 30,
        description: 'Cápsulas de Café Especial São Domingos',
      },
      {
        name: 'Café Especial 250g - moído',
        category: 'cafe_250g',
        sale_price: 36,
        description: SD_DESC,
      },
      {
        name: 'Café Especial 250g - em grãos',
        category: 'cafe_250g',
        sale_price: 36,
        description: SD_DESC,
      },
      {
        name: 'Café Especial 500g - em grãos',
        category: 'cafe_500g',
        sale_price: 60,
        description: SD_DESC,
      },
      {
        name: 'Café Especial 500g - moído',
        category: 'cafe_500g',
        sale_price: 60,
        description: SD_DESC,
      },
      {
        name: 'Drip Coffee - caixa 10un',
        category: 'drip_coffee',
        sale_price: 40,
        description: 'Drip Coffee com café especial da Fazenda São Domingos',
      },
    ]

    for (const item of catalog) {
      // Idempotência: não recriar um produto que já existe com o mesmo nome deste dono
      const existing = app.findRecordsByFilter(
        'products',
        'owner = {:owner} && name = {:name}',
        '+created',
        1,
        0,
        { owner: ownerId, name: item.name },
      )
      if (existing.length > 0) continue

      const rec = new Record(productsCol)
      rec.set('name', item.name)
      rec.set('category', item.category)
      rec.set('description', item.description)
      rec.set('sale_price', item.sale_price)
      rec.set('active', true)
      rec.set('owner', ownerId)
      app.save(rec)
    }
  },
  (app) => {
    // Reverter apenas os produtos lançados por esta migration (pelo nome exato)
    const names = [
      'Cápsulas (Nespresso) - cx 10un',
      'Café Especial 250g - moído',
      'Café Especial 250g - em grãos',
      'Café Especial 500g - em grãos',
      'Café Especial 500g - moído',
      'Drip Coffee - caixa 10un',
    ]
    for (const name of names) {
      const recs = app.findRecordsByFilter('products', 'name = {:name}', '+created', 100, 0, {
        name,
      })
      for (const rec of recs) app.delete(rec)
    }
  },
)
