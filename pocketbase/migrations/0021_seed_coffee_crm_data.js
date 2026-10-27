/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Buscar usuário proprietário (admin ou demo)
    let ownerId = ''
    try {
      const demoAdmin = app.findFirstRecordByData('users', 'email', 'teste@direto.app')
      ownerId = demoAdmin.id
    } catch (_) {
      try {
        const anyAdmin = app.findFirstRecordByData('users', 'role', 'admin')
        ownerId = anyAdmin.id
      } catch (_) {
        const allUsers = app.findRecordsByFilter('users', '', '+created', 1, 0)
        if (allUsers.length > 0) ownerId = allUsers[0].id
      }
    }

    if (!ownerId) {
      console.log('Nenhum usuário encontrado para seed de cafés especiais.')
      return
    }

    const contactsCol = app.findCollectionByNameOrId('contacts')
    const purchasesCol = app.findCollectionByNameOrId('purchases')

    // Idempotência: verificar se já existem clientes
    const existing = app.findRecordsByFilter('contacts', `owner = "${ownerId}"`, '+created', 1, 0)
    if (existing.length > 0) {
      console.log('Clientes já existem, pulando seed inicial.')
      return
    }

    const now = new Date()
    // Helper para gerar datas relativas
    function dateDaysAgo(days) {
      const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      return d.toISOString().split('T')[0] + ' 10:00:00.000Z'
    }

    // Helper para gerar aniversário: mês/dia relativos a hoje
    function birthdayOffsetDays(offsetDays) {
      const target = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000)
      const month = String(target.getUTCMonth() + 1).padStart(2, '0')
      const day = String(target.getUTCDate()).padStart(2, '0')
      // Ano de nascimento arbitrário (ex: 1992)
      return `1992-${month}-${day} 00:00:00.000Z`
    }

    const sampleCustomers = [
      {
        name: 'Ana Carolina Silveira',
        email: 'ana.silveira@cafeespecial.com.br',
        phone: '(11) 98765-4321',
        birthday: birthdayOffsetDays(0), // Aniversário HOJE!
        company: 'Café & Afeto',
        position: 'Sommelier de Café',
        status: 'ativo',
        notes: 'Apaixonada por microlotes fermentados da Mantiqueira de Minas.',
        favorite_coffee: 'Catuaí Amarelo Fermentado - Mantiqueira',
        purchases: [
          { amount: 89.0, daysAgo: 10, items: '2x Pacote 250g Catuaí Amarelo Grãos' },
          { amount: 145.0, daysAgo: 25, items: '1x Microlote Gueisha 250g + Filtros V60' },
          { amount: 78.0, daysAgo: 45, items: '2x Bourbon Vermelho Moído' },
        ],
      },
      {
        name: 'Rodrigo Mendonça',
        email: 'rodrigo.m@gmail.com',
        phone: '(21) 99123-8877',
        birthday: birthdayOffsetDays(3), // Aniversário em 3 dias!
        company: 'Studio Design',
        position: 'Diretor de Arte',
        status: 'ativo',
        notes: 'Prepara café diariamente na prensa francesa e Aeropress.',
        favorite_coffee: 'Bourbon Amarelo Cerrado Mineiro',
        purchases: [
          { amount: 95.0, daysAgo: 15, items: '2x Bourbon Amarelo 500g' },
          { amount: 110.0, daysAgo: 40, items: '1x Blend da Casa 1kg' },
        ],
      },
      {
        name: 'Camila Albuquerque',
        email: 'camila.alb@techsolutions.io',
        phone: '(31) 97654-3210',
        birthday: birthdayOffsetDays(6), // Aniversário em 6 dias!
        company: 'Tech Solutions',
        position: 'Engenheira de Software',
        status: 'ativo',
        notes: 'Compra café em grãos para máquina de espresso no home office.',
        favorite_coffee: 'Mundo Novo Torra Média',
        purchases: [{ amount: 160.0, daysAgo: 20, items: '2x Café Especial Espresso 1kg' }],
      },
      {
        name: 'Lucas Ferreira Guimarães',
        email: 'lucas.guimaraes@advocacia.com.br',
        phone: '(19) 98877-6655',
        birthday: '1988-08-15 00:00:00.000Z',
        company: 'Guimarães Advocacia',
        position: 'Advogado',
        status: 'ativo',
        notes:
          'Cliente super recorrente mas está sem comprar há mais de 40 dias! Retomar contato com amostra ou novidade de safra.',
        favorite_coffee: 'Geisha Caparaó Especial',
        purchases: [
          { amount: 120.0, daysAgo: 42, items: '1x Geisha Caparaó + 1x Bourbon' },
          { amount: 98.0, daysAgo: 70, items: '2x Café Especial Arábica' },
          { amount: 115.0, daysAgo: 105, items: 'Kit Degustação 4 Origens' },
          { amount: 90.0, daysAgo: 135, items: '2x Pacote 250g Grãos' },
        ],
      },
      {
        name: 'Mariana Souza Santos',
        email: 'mariana.santos@consultoria.com.br',
        phone: '(11) 99456-1122',
        birthday: '1995-11-20 00:00:00.000Z',
        company: 'MS Consultoria',
        position: 'Consultora',
        status: 'ativo',
        notes:
          'Passou dos 30 dias desde a última compra (35 dias). Gostaria de saber dos lançamentos de outono.',
        favorite_coffee: 'Catuaí Vermelho Alta Mogiana',
        purchases: [
          { amount: 76.0, daysAgo: 35, items: '2x Pacote 250g Torra Média Clara' },
          { amount: 84.0, daysAgo: 68, items: '1x Pacote 500g Alta Mogiana' },
        ],
      },
      {
        name: 'Felipe Barreto (Barista Master)',
        email: 'felipe.barreto@baristaclub.com.br',
        phone: '(41) 98111-2233',
        birthday: '1986-04-10 00:00:00.000Z',
        company: 'Café Escola Curitiba',
        position: 'Instrutor e Coffee Hunter',
        status: 'ativo',
        notes:
          'Cliente do nível mais alto de fidelidade! Mais de 22 compras registradas, fã absoluto de cafés exóticos.',
        favorite_coffee: 'Microlotes Fermentação Anaeróbica',
        purchases: [
          { amount: 210.0, daysAgo: 5, items: 'Kit Barista Profissional 3 Origens' },
          { amount: 180.0, daysAgo: 18, items: '2x Microlote Exótico 250g' },
          { amount: 195.0, daysAgo: 32, items: 'Café Premiado Cup of Excellence' },
        ],
        extraPurchaseCount: 20, // Total 23 compras -> Nível 3 ("Blend" ou "Barista")
      },
      {
        name: 'Beatriz Lins',
        email: 'beatriz.lins@agenciacriativa.com',
        phone: '(81) 99234-5566',
        birthday: '1993-02-14 00:00:00.000Z',
        company: 'Agência Criativa',
        position: 'Head de Conteúdo',
        status: 'ativo',
        notes: 'Já acumula 12 compras no histórico. Subiu para o nível 2 de fidelidade!',
        favorite_coffee: 'Blend Doçura da Roça',
        purchases: [
          { amount: 85.0, daysAgo: 8, items: '2x Blend Doçura da Roça 250g' },
          { amount: 92.0, daysAgo: 22, items: '2x Café Especial Moagem Grossa' },
        ],
        extraPurchaseCount: 10, // Total 12 compras -> Nível 2 ("Torra")
      },
      {
        name: 'Guilherme Prado',
        email: 'guilherme.prado@investimentos.com.br',
        phone: '(11) 97123-9900',
        birthday: '1990-12-05 00:00:00.000Z',
        company: 'Prado Capital',
        position: 'Analista de Investimentos',
        status: 'ativo',
        notes: 'Cliente novo, comprou pela primeira vez recentemente.',
        favorite_coffee: 'Café Especial Canastra Notas de Chocolate',
        purchases: [{ amount: 98.0, daysAgo: 12, items: '1x Pacote 500g Canastra Grãos' }],
      },
    ]

    for (const cust of sampleCustomers) {
      const contactRec = new Record(contactsCol)
      contactRec.set('name', cust.name)
      contactRec.set('email', cust.email)
      contactRec.set('phone', cust.phone)
      contactRec.set('company', cust.company || '')
      contactRec.set('position', cust.position || '')
      contactRec.set('status', cust.status)
      contactRec.set('owner', ownerId)
      contactRec.set('notes', cust.notes)
      contactRec.set('birthday', cust.birthday)
      contactRec.set('favorite_coffee', cust.favorite_coffee || '')

      const totalItemsPurchased = cust.purchases.length + (cust.extraPurchaseCount || 0)
      const totalAmount =
        cust.purchases.reduce((acc, p) => acc + p.amount, 0) + (cust.extraPurchaseCount || 0) * 85.0
      const lastDate = cust.purchases.length > 0 ? dateDaysAgo(cust.purchases[0].daysAgo) : ''

      contactRec.set('purchase_count', totalItemsPurchased)
      contactRec.set('total_spent', totalAmount)
      if (lastDate) {
        contactRec.set('last_purchase_date', lastDate)
      }

      app.save(contactRec)

      // Registrar compras no banco
      for (const pur of cust.purchases) {
        const purRec = new Record(purchasesCol)
        purRec.set('contact', contactRec.id)
        purRec.set('owner', ownerId)
        purRec.set('amount', pur.amount)
        purRec.set('purchase_date', dateDaysAgo(pur.daysAgo))
        purRec.set('items_description', pur.items)
        purRec.set('notes', 'Venda realizada no balcão / WhatsApp')
        app.save(purRec)
      }
    }
  },
  (app) => {
    // Reversão limpa
  },
)
