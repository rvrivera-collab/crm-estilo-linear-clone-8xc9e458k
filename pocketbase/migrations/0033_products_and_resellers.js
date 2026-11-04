/// <reference path="../pb_data/types.d.ts" />

/**
 * 0033 — Catálogo de Produtos e Pontos de Revenda (repasse B2B).
 *
 * 1. `products` — catálogo de produtos vendidos pelo dono (café em grãos 250g/500g,
 *    drip coffee, cápsula, caneca, camisa, chaveiro etc.), com preço de venda,
 *    custo opcional, estoque opcional e flag ativo/inativo.
 * 2. `resellers` — pontos de revenda (parceiro/loja) onde os produtos são repassados.
 * 3. `resale_prices` — preço de repasse por produto em cada ponto de revenda,
 *    editável a qualquer momento (os preços mudam por parceiro).
 *
 * Regras de acesso: cada usuário vê/manipula apenas os próprios registros
 * (mesmo padrão de `crm_settings`/`orders` deste projeto).
 * Idempotente: cria a collection apenas se ela ainda não existir.
 */
migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    // ---------- 1. products ----------
    if (!app.hasTable('products')) {
      const products = new Collection({
        name: 'products',
        type: 'base',
        listRule: "@request.auth.id != '' && owner = @request.auth.id",
        viewRule: "@request.auth.id != '' && owner = @request.auth.id",
        createRule: "@request.auth.id != '' && owner = @request.auth.id",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
        fields: [
          { name: 'name', type: 'text', required: true, max: 200 },
          {
            name: 'category',
            type: 'select',
            required: true,
            values: [
              'cafe_250g',
              'cafe_500g',
              'drip_coffee',
              'capsula',
              'caneca',
              'camisa',
              'chaveiro',
              'outro',
            ],
            maxSelect: 1,
          },
          { name: 'description', type: 'text', max: 2000 },
          { name: 'sale_price', type: 'number', required: false, min: 0 },
          { name: 'cost', type: 'number', min: 0 },
          { name: 'stock', type: 'number', onlyInt: true, min: 0 },
          { name: 'active', type: 'bool' },
          {
            name: 'owner',
            type: 'relation',
            required: true,
            collectionId: usersId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_products_owner ON products (owner)',
          'CREATE INDEX idx_products_category ON products (category)',
          'CREATE INDEX idx_products_active ON products (active)',
        ],
      })
      app.save(products)
    }

    // ---------- 2. resellers ----------
    if (!app.hasTable('resellers')) {
      const resellers = new Collection({
        name: 'resellers',
        type: 'base',
        listRule: "@request.auth.id != '' && owner = @request.auth.id",
        viewRule: "@request.auth.id != '' && owner = @request.auth.id",
        createRule: "@request.auth.id != '' && owner = @request.auth.id",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
        fields: [
          { name: 'name', type: 'text', required: true, max: 200 },
          { name: 'contact_name', type: 'text', max: 200 },
          { name: 'phone', type: 'text', max: 40 },
          { name: 'city', type: 'text', max: 120 },
          { name: 'notes', type: 'text', max: 2000 },
          { name: 'active', type: 'bool' },
          {
            name: 'owner',
            type: 'relation',
            required: true,
            collectionId: usersId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_resellers_owner ON resellers (owner)',
          'CREATE INDEX idx_resellers_active ON resellers (active)',
        ],
      })
      app.save(resellers)
    }

    // ---------- 3. resale_prices ----------
    if (!app.hasTable('resale_prices')) {
      const resellersId = app.findCollectionByNameOrId('resellers').id
      const productsId = app.findCollectionByNameOrId('products').id
      const resalePrices = new Collection({
        name: 'resale_prices',
        type: 'base',
        listRule: "@request.auth.id != '' && owner = @request.auth.id",
        viewRule: "@request.auth.id != '' && owner = @request.auth.id",
        createRule: "@request.auth.id != '' && owner = @request.auth.id",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
        fields: [
          {
            name: 'reseller',
            type: 'relation',
            required: true,
            collectionId: resellersId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'product',
            type: 'relation',
            required: true,
            collectionId: productsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'resale_price', type: 'number', required: false, min: 0 },
          { name: 'set_at', type: 'date' },
          { name: 'notes', type: 'text', max: 2000 },
          {
            name: 'owner',
            type: 'relation',
            required: true,
            collectionId: usersId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          // Um único preço de repasse por (ponto de revenda, produto) — recriar o preço substitui o anterior
          'CREATE UNIQUE INDEX idx_resale_prices_unique ON resale_prices (reseller, product)',
          'CREATE INDEX idx_resale_prices_owner ON resale_prices (owner)',
          'CREATE INDEX idx_resale_prices_reseller ON resale_prices (reseller)',
          'CREATE INDEX idx_resale_prices_product ON resale_prices (product)',
        ],
      })
      app.save(resalePrices)
    }
  },
  (app) => {
    for (const name of ['resale_prices', 'resellers', 'products']) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
