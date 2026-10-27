/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const contacts = app.findCollectionByNameOrId('contacts')

    // 1. Campo referral_code no contato (código único de indicação gerado pro cliente compartilhar)
    if (!contacts.fields.getByName('referral_code')) {
      contacts.fields.add(
        new TextField({
          name: 'referral_code',
          required: false,
        }),
      )
      app.save(contacts)
    }

    // Gerar códigos de indicação para os contatos existentes que não possuem (ex: MARI-4821)
    try {
      const allContacts = app.findRecordsByFilter('contacts', '', '+created', 500, 0)
      for (const c of allContacts) {
        if (!c.getString('referral_code')) {
          const rawName = c.getString('name') || 'CAFE'
          // Pegar primeiras letras do nome limpo
          const cleanName = rawName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z]/g, '')
            .substring(0, 4)
            .toUpperCase()
          const prefix = (cleanName.length >= 2 ? cleanName : 'CAFE').padEnd(4, 'X')
          const randomNum = Math.floor(1000 + Math.random() * 9000)
          const code = `${prefix}-${randomNum}`
          c.set('referral_code', code)
          app.save(c)
        }
      }
    } catch (e) {
      console.log('Aviso ao gerar referral_code para contatos existentes:', e)
    }

    // 2. Criar coleção referrals (Indicações do CRM)
    let referrals = null
    try {
      referrals = app.findCollectionByNameOrId('referrals')
    } catch (_) {
      referrals = new Collection({
        name: 'referrals',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'referrer',
            type: 'relation',
            required: true,
            collectionId: contacts.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'owner',
            type: 'relation',
            required: false,
            collectionId: users.id,
            maxSelect: 1,
          },
          {
            name: 'referred_name',
            type: 'text',
            required: true,
          },
          {
            name: 'referred_phone',
            type: 'text',
            required: false,
          },
          {
            name: 'referred_email',
            type: 'email',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['indicado', 'primeiro_contato', 'primeira_compra', 'cancelado'],
            maxSelect: 1,
          },
          {
            name: 'notes',
            type: 'text',
            required: false,
          },
          {
            name: 'reward_coupon',
            type: 'text',
            required: false,
          },
          {
            name: 'converted_at',
            type: 'date',
            required: false,
          },
          {
            name: 'contact_converted',
            type: 'relation',
            required: false,
            collectionId: contacts.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_referrals_referrer ON referrals (referrer)',
          'CREATE INDEX idx_referrals_status ON referrals (status)',
          'CREATE INDEX idx_referrals_owner ON referrals (owner)',
          'CREATE INDEX idx_referrals_created ON referrals (created DESC)',
        ],
      })
      app.save(referrals)
    }

    // Adicionar tipos novos em journey_events se necessário: 'indicacao_feita', 'recompensa_indicacao'
    // Como journey_events usa type select, vamos verificar se podemos atualizar os values
    try {
      const journeyEvents = app.findCollectionByNameOrId('journey_events')
      const typeField = journeyEvents.fields.getByName('type')
      if (typeField && Array.isArray(typeField.values)) {
        let changed = false
        if (!typeField.values.includes('indicacao_feita')) {
          typeField.values.push('indicacao_feita')
          changed = true
        }
        if (!typeField.values.includes('recompensa_indicacao')) {
          typeField.values.push('recompensa_indicacao')
          changed = true
        }
        if (changed) {
          app.save(journeyEvents)
        }
      }
    } catch (jErr) {
      console.log('Aviso ao estender types do journey_events:', jErr)
    }

    // 3. Seed inicial de indicações de demonstração vinculadas aos primeiros contatos
    try {
      const contactList = app.findRecordsByFilter('contacts', '', '+created', 5, 0)
      if (contactList.length >= 2) {
        const existingReferrals = app.findRecordsByFilter('referrals', '', '+created', 1, 0)
        if (existingReferrals.length === 0) {
          const ownerId = users ? users.id : ''

          // Indicação 1: Convertida (primeira compra) com cupom gerado
          const c1 = contactList[0]
          const r1 = new Record(referrals)
          r1.set('referrer', c1.id)
          r1.set('owner', ownerId)
          r1.set('referred_name', 'Felipe Guimarães')
          r1.set('referred_phone', '(11) 98111-2233')
          r1.set('status', 'primeira_compra')
          r1.set('notes', 'Adora cafés florais e moagem grossa para Prensa Francesa.')
          r1.set('reward_coupon', 'INDICOU-8291')
          r1.set('converted_at', new Date().toISOString())
          app.save(r1)

          // Indicação 2: Primeiro contato
          const r2 = new Record(referrals)
          r2.set('referrer', c1.id)
          r2.set('owner', ownerId)
          r2.set('referred_name', 'Beatriz Lima')
          r2.set('referred_phone', '(11) 97222-4455')
          r2.set('status', 'primeiro_contato')
          r2.set('notes', 'Enviado menu de cafés especiais e vídeo da nossa torra artesanal.')
          app.save(r2)

          // Indicação 3: Indicado recém-registrado
          const c2 = contactList[1]
          const r3 = new Record(referrals)
          r3.set('referrer', c2.id)
          r3.set('owner', ownerId)
          r3.set('referred_name', 'Juliana Rocha')
          r3.set('referred_phone', '(21) 98333-6677')
          r3.set('status', 'indicado')
          r3.set('notes', 'Indicada pelo Rodrigo. Quer experimentar cafés para máquina espresso.')
          app.save(r3)
        }
      }
    } catch (seedErr) {
      console.log('Aviso ao semear referrals:', seedErr)
    }
  },
  (app) => {
    try {
      const referrals = app.findCollectionByNameOrId('referrals')
      app.delete(referrals)
    } catch (_) {}

    try {
      const contacts = app.findCollectionByNameOrId('contacts')
      if (contacts.fields.getByName('referral_code')) {
        contacts.fields.removeByName('referral_code')
        app.save(contacts)
      }
    } catch (_) {}
  },
)
