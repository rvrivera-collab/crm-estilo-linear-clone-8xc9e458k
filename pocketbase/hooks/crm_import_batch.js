/**
 * Batch import endpoint for CRM spreadsheet imports.
 * Allows importing contacts, purchases, and journey events in grouped batches (up to 50 items per call),
 * reducing HTTP requests from ~600+ down to ~5-10 calls, completely eliminating 429 rate limit issues.
 */
routerAdd(
  'POST',
  '/backend/v1/crm/import-batch',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.unauthorizedError('Autenticação obrigatória para importar dados.')
      }

      const body = e.requestInfo().body || {}
      const contactsToUpsert = Array.isArray(body.contacts) ? body.contacts : []
      const purchasesToInsert = Array.isArray(body.purchases) ? body.purchases : []
      const recalculateContactIds = Array.isArray(body.recalculate_contact_ids)
        ? body.recalculate_contact_ids
        : []

      const contactsCol = $app.findCollectionByNameOrId('contacts')
      const purchasesCol = $app.findCollectionByNameOrId('purchases')
      const journeyCol = $app.findCollectionByNameOrId('journey_events')

      const result = {
        createdContacts: [],
        updatedContacts: [],
        unchangedContacts: [],
        insertedPurchasesCount: 0,
        recalculatedContactsCount: 0,
        warnings: [],
      }

      // 1. Process contacts inside a transaction for atomicity and speed
      if (contactsToUpsert.length > 0) {
        $app.runInTransaction((txApp) => {
          for (let i = 0; i < contactsToUpsert.length; i++) {
            const item = contactsToUpsert[i]
            if (!item || !item.name) continue

            const rawName = String(item.name).trim()
            if (!rawName) continue

            try {
              let record = null
              let isNew = false

              if (item.id) {
                try {
                  record = txApp.findRecordById('contacts', item.id)
                } catch (_) {
                  record = null
                }
              }

              if (!record) {
                isNew = true
                record = new Record(contactsCol)
                record.set('name', rawName)
                record.set('owner', userId)
                record.set('status', item.status || 'lead')
              }

              let hasChanges = false

              // Helper to set field only if provided and either record is new or field is empty
              const applyField = (fieldName, val, allowOverwriteEmptyOnly = true) => {
                if (val === undefined || val === null || val === '') return
                if (isNew) {
                  record.set(fieldName, val)
                  hasChanges = true
                } else if (allowOverwriteEmptyOnly) {
                  const currentVal = record.getString(fieldName)
                  if (!currentVal) {
                    record.set(fieldName, val)
                    hasChanges = true
                  }
                } else {
                  record.set(fieldName, val)
                  hasChanges = true
                }
              }

              applyField('phone', item.phone)
              applyField('city', item.city)
              applyField('state', item.state)
              applyField('address', item.address)
              applyField('birthday', item.birthday)
              applyField('acquisition_channel', item.acquisition_channel)
              applyField('coffee_preference', item.coffee_preference)
              applyField('favorite_coffee', item.favorite_coffee)
              applyField('coffee_machine', item.coffee_machine)
              applyField('brew_method_preference', item.brew_method_preference)

              if (item.sent_mug !== undefined && item.sent_mug !== null) {
                record.set('sent_mug', Boolean(item.sent_mug))
                hasChanges = true
              }
              if (item.sent_welcome_folder !== undefined && item.sent_welcome_folder !== null) {
                record.set('sent_welcome_folder', Boolean(item.sent_welcome_folder))
                hasChanges = true
              }
              if (item.sent_stickers !== undefined && item.sent_stickers !== null) {
                record.set('sent_stickers', Boolean(item.sent_stickers))
                hasChanges = true
              }

              applyField('notes', item.notes)
              applyField('email', item.email)
              applyField('cpf_cnpj', item.cpf_cnpj)
              applyField('last_purchase_date', item.last_purchase_date)

              // If record is existing and has no status, or if we have last_purchase_date, ensure status is ativo
              if (item.last_purchase_date) {
                const currentStatus = record.getString('status')
                if (!currentStatus || currentStatus === 'lead') {
                  record.set('status', 'ativo')
                  hasChanges = true
                }
              }

              if (isNew) {
                txApp.save(record)
                result.createdContacts.push({
                  id: record.id,
                  name: rawName,
                  normalizedName: item.normalizedName || '',
                })

                // Create initial journey event for new contact
                try {
                  const journeyEvent = new Record(journeyCol)
                  journeyEvent.set('contact', record.id)
                  journeyEvent.set('owner', userId)
                  journeyEvent.set('type', 'cadastro')
                  journeyEvent.set('title', 'Importado via Planilha')
                  journeyEvent.set(
                    'description',
                    `Cliente ${rawName} importado da base Fazenda São Domingos.`,
                  )
                  journeyEvent.set('channel', item.acquisition_channel || 'planilha')
                  txApp.save(journeyEvent)
                } catch (jErr) {
                  // Non-fatal
                }
              } else if (hasChanges) {
                txApp.save(record)
                result.updatedContacts.push({
                  id: record.id,
                  name: rawName,
                  normalizedName: item.normalizedName || '',
                })
              } else {
                result.unchangedContacts.push({
                  id: record.id,
                  name: rawName,
                  normalizedName: item.normalizedName || '',
                })
              }
            } catch (cErr) {
              result.warnings.push(
                `Falha ao importar cliente "${rawName}": ${cErr.message || 'Erro no banco de dados'}`,
              )
            }
          }
        })
      }

      // 2. Process purchases
      if (purchasesToInsert.length > 0) {
        $app.runInTransaction((txApp) => {
          for (let i = 0; i < purchasesToInsert.length; i++) {
            const p = purchasesToInsert[i]
            if (!p || !p.contact) continue

            try {
              // Deduplication check for purchase: if purchase with identical contact, purchase_date and amount already exists, skip
              const filterDate = p.purchase_date
              let duplicateFound = false
              if (filterDate && p.amount !== undefined) {
                try {
                  const existingList = txApp.findRecordsByFilter(
                    'purchases',
                    `contact = "${p.contact}" && purchase_date = "${filterDate}" && amount = ${p.amount}`,
                    '-created',
                    1,
                    0,
                  )
                  if (existingList.length > 0) {
                    duplicateFound = true
                  }
                } catch (_) {}
              }

              if (duplicateFound) {
                continue
              }

              const pRecord = new Record(purchasesCol)
              pRecord.set('contact', p.contact)
              pRecord.set('owner', userId)
              pRecord.set('amount', Number(p.amount) || 0)
              pRecord.set('purchase_date', p.purchase_date || new Date().toISOString())
              pRecord.set('items_description', p.items_description || 'Café Especial')
              pRecord.set('notes', p.notes || '')
              txApp.save(pRecord)
              result.insertedPurchasesCount++
            } catch (pErr) {
              result.warnings.push(
                `Erro ao gravar compra para contato ${p.contact}: ${pErr.message || 'Erro'}`,
              )
            }
          }
        })
      }

      // 3. Recalculate contact purchases metrics if requested
      if (recalculateContactIds.length > 0) {
        $app.runInTransaction((txApp) => {
          for (let i = 0; i < recalculateContactIds.length; i++) {
            const cId = recalculateContactIds[i]
            if (!cId) continue

            try {
              const contactRecord = txApp.findRecordById('contacts', cId)
              const contactPurchases = txApp.findRecordsByFilter(
                'purchases',
                `contact = "${cId}"`,
                '-purchase_date',
                1000,
                0,
              )

              const count = contactPurchases.length
              let total = 0
              let latestDate =
                contactPurchases.length > 0 ? contactPurchases[0].getString('purchase_date') : ''

              for (let k = 0; k < contactPurchases.length; k++) {
                total += contactPurchases[k].getFloat('amount') || 0
              }

              // Preserve existing last_purchase_date if no purchases recorded or if existing is newer
              const currentLastDate = contactRecord.getString('last_purchase_date')
              if (currentLastDate) {
                if (
                  !latestDate ||
                  new Date(currentLastDate).getTime() > new Date(latestDate).getTime()
                ) {
                  latestDate = currentLastDate
                }
              }

              contactRecord.set('purchase_count', count)
              contactRecord.set('total_spent', total)
              if (latestDate) {
                contactRecord.set('last_purchase_date', latestDate)
              }
              if (count > 0 && contactRecord.getString('status') === 'lead') {
                contactRecord.set('status', 'ativo')
              }

              txApp.save(contactRecord)
              result.recalculatedContactsCount++
            } catch (_) {
              // Ignore individual recalculate errors
            }
          }
        })
      }

      return e.json(200, {
        success: true,
        ...result,
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        error: err.message || 'Falha ao processar lote no servidor.',
      })
    }
  },
  $apis.requireAuth(),
)
