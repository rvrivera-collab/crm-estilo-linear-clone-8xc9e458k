/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const contacts = app.findCollectionByNameOrId('contacts')
    const referrals = app.findCollectionByNameOrId('referrals')

    const contactList = app.findRecordsByFilter('contacts', '', '+created', 5, 0)
    if (contactList.length >= 2) {
      const existing = app.findRecordsByFilter('referrals', '', '+created', 1, 0)
      if (existing.length === 0) {
        let ownerId = ''
        try {
          const userRec = app.findFirstRecordByFilter('users', 'email = "saodomingosfaz@gmail.com"')
          ownerId = userRec ? userRec.id : ''
        } catch (_) {
          const anyUser = app.findRecordsByFilter('users', '', '+created', 1, 0)
          if (anyUser.length > 0) ownerId = anyUser[0].id
        }

        const c1 = contactList[0] // Ana Carolina
        const c2 = contactList[1] // Rodrigo

        // R1: Convertida (primeira compra)
        const r1 = new Record(referrals)
        r1.set('referrer', c1.id)
        if (ownerId) r1.set('owner', ownerId)
        r1.set('referred_name', 'Felipe Guimarães')
        r1.set('referred_phone', '(11) 98111-2233')
        r1.set('referred_email', 'felipe.guima@gmail.com')
        r1.set('status', 'primeira_compra')
        r1.set('notes', 'Adora cafés florais e moagem para Prensa Francesa.')
        r1.set('reward_coupon', 'INDICOU-8291')
        r1.set('converted_at', new Date().toISOString())
        app.save(r1)

        // R2: Primeiro contato
        const r2 = new Record(referrals)
        r2.set('referrer', c1.id)
        if (ownerId) r2.set('owner', ownerId)
        r2.set('referred_name', 'Beatriz Lima')
        r2.set('referred_phone', '(11) 97222-4455')
        r2.set('status', 'primeiro_contato')
        r2.set('notes', 'Enviado catálogo sensorial e boas-vindas Disney.')
        app.save(r2)

        // R3: Indicado recém-cadastrado
        const r3 = new Record(referrals)
        r3.set('referrer', c2.id)
        if (ownerId) r3.set('owner', ownerId)
        r3.set('referred_name', 'Juliana Rocha')
        r3.set('referred_phone', '(21) 98333-6677')
        r3.set('status', 'indicado')
        r3.set('notes', 'Quer conhecer microlotes para máquina espresso.')
        app.save(r3)
      }
    }
  },
  (app) => {
    // Reverter seed
    try {
      const referrals = app.findCollectionByNameOrId('referrals')
      const recs = app.findRecordsByFilter('referrals', '', '+created', 10, 0)
      for (const r of recs) {
        app.delete(r)
      }
    } catch (_) {}
  },
)
