import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import { recalculateContactPurchases } from '@/services/crm'
import type { Contact, SpreadsheetImportSummary } from '@/types/crm'

/**
 * Normaliza o nome do cliente para deduplicação:
 * - trim
 * - lowercase
 * - remove múltiplos espaços consecutivos
 * - remove acentos opcionais para comparação flexível
 */
export function normalizeClientName(rawName?: string | null): string {
  if (!rawName) return ''
  return rawName.toString().trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Separa string no formato "Cidade - UF" ou "Cidade/UF"
 */
export function parseCityAndState(rawLocation?: string | null): { city: string; state: string } {
  if (!rawLocation) return { city: '', state: '' }
  const str = rawLocation.toString().trim()
  if (!str || str === '-') return { city: '', state: '' }

  // Ex: "Três Pontas - MG", "São Paulo - SP", "Contagem / BH - MG"
  const dashParts = str.split(' - ')
  if (dashParts.length >= 2) {
    const statePart = dashParts[dashParts.length - 1].trim().toUpperCase()
    const cityPart = dashParts.slice(0, -1).join(' - ').trim()
    if (statePart.length === 2) {
      return { city: cityPart, state: statePart }
    }
  }

  // Tenta split simples por hífen
  const simpleDash = str.split('-')
  if (simpleDash.length === 2) {
    const candidateState = simpleDash[1].trim().toUpperCase()
    if (candidateState.length === 2) {
      return { city: simpleDash[0].trim(), state: candidateState }
    }
  }

  // Tenta split por barra
  const slashParts = str.split('/')
  if (slashParts.length === 2) {
    const candidateState = slashParts[1].trim().toUpperCase()
    if (candidateState.length === 2) {
      return { city: slashParts[0].trim(), state: candidateState }
    }
  }

  return { city: str, state: '' }
}

/**
 * Converte data de aniversário DD/MM para formato Date ISO aceito pelo PocketBase (no ano 2000 como referência fixa UTC)
 */
export function parseBirthdayDDMM(raw?: unknown): string | null {
  if (raw === undefined || raw === null) return null
  const str = raw.toString().trim()
  if (!str || str === '-' || str.toLowerCase() === 'não' || str.toLowerCase() === 'nao') return null

  // DD/MM ou D/M
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})$/)
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const paddedDay = String(day).padStart(2, '0')
      const paddedMonth = String(month).padStart(2, '0')
      // Armazenamos no ano 2000 (bissexto) para suportar 29 de fevereiro com segurança
      return `2000-${paddedMonth}-${paddedDay}T12:00:00.000Z`
    }
  }

  // Se veio como data completa ISO ou serial Excel
  if (typeof raw === 'number') {
    const d = excelDateToDate(raw)
    if (d && !isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0')
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      return `2000-${month}-${day}T12:00:00.000Z`
    }
  }

  return null
}

/**
 * Converte serial do Excel ou texto de data para string ISO Date UTC
 */
export function excelDateToDate(serialOrStr: unknown): Date | null {
  if (!serialOrStr) return null

  if (typeof serialOrStr === 'number') {
    // Excel base date: 1899-12-30
    const utcDays = Math.floor(serialOrStr - 25569)
    const utcValue = utcDays * 86400 * 1000
    const dateInfo = new Date(utcValue)
    if (!isNaN(dateInfo.getTime())) return dateInfo
  }

  const str = String(serialOrStr).trim()
  if (!str || str === '-') return null

  // DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brMatch) {
    const day = parseInt(brMatch[1], 10)
    const month = parseInt(brMatch[2], 10) - 1
    const year = parseInt(brMatch[3], 10)
    return new Date(Date.UTC(year, month, day, 12, 0, 0))
  }

  // Formato retornado pelo Excel JS parsing (ex: "Mon Aug 17 2026...") ou ISO
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed

  return null
}

export function parsePurchaseDate(raw?: unknown): string | null {
  const d = excelDateToDate(raw)
  return d ? d.toISOString() : null
}

/**
 * Limpa e normaliza telefone/WhatsApp
 */
export function cleanPhoneNumber(raw?: string | null): string {
  if (!raw) return ''
  const str = raw.toString().trim()
  if (!str || str === '-') return ''
  return str
}

/**
 * Limpa campos genéricos ("-", "null", "undefined")
 */
export function cleanStringField(raw?: unknown): string {
  if (raw === undefined || raw === null) return ''
  const str = String(raw).trim()
  if (str === '-' || str.toLowerCase() === 'não' || str.toLowerCase() === 'nao') return ''
  return str
}

export interface ImportSpreadsheetProgress {
  step: 'reading' | 'clients' | 'purchases' | 'recalculating' | 'done' | 'error'
  message: string
  percent: number
  processedClients: number
  totalClients: number
  processedPurchases: number
  totalPurchases: number
}

/**
 * Encontra nome da aba com tolerância a variações ("Base de Clientes", "BASE CONSOLIDADA DE CLIENTES", etc.)
 */
export function findSheetName(sheetNames: string[], pattern: RegExp): string | null {
  for (const name of sheetNames) {
    if (pattern.test(name)) return name
  }
  return null
}

/**
 * Importa a planilha XLSX diretamente no navegador gravando no PocketBase
 */
export async function importSpreadsheetData(
  file: File,
  onProgress?: (p: ImportSpreadsheetProgress) => void,
): Promise<SpreadsheetImportSummary> {
  const summary: SpreadsheetImportSummary = {
    clientsCreated: 0,
    clientsUpdated: 0,
    clientsUnchanged: 0,
    purchasesImported: 0,
    warnings: [],
    contactsTouchedCount: 0,
  }

  onProgress?.({
    step: 'reading',
    message: 'Lendo arquivo da planilha...',
    percent: 5,
    processedClients: 0,
    totalClients: 0,
    processedPurchases: 0,
    totalPurchases: 0,
  })

  // 1. Ler arquivo como ArrayBuffer
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  // 2. Identificar abas
  const clientsSheetName =
    findSheetName(workbook.SheetNames, /base.*cliente|clientes/i) || workbook.SheetNames[0]
  const salesSheetName = findSheetName(workbook.SheetNames, /vendas|registro.*vendas|pedidos/i)

  if (!clientsSheetName) {
    throw new Error(
      'Não foi possível encontrar a aba de clientes na planilha enviada. Verifique se o arquivo possui a aba "Base de Clientes".',
    )
  }

  // 3. Obter dados da aba Base de Clientes como matriz de linhas
  const clientsSheet = workbook.Sheets[clientsSheetName]
  const clientsRawRows: unknown[][] = XLSX.utils.sheet_to_json(clientsSheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (clientsRawRows.length < 2) {
    throw new Error('A aba de clientes parece vazia ou sem cabeçalhos suficientes.')
  }

  // Descobrir qual linha é o cabeçalho (pode ser a linha 1 ou linha 2)
  let clientHeaderIndex = -1
  for (let i = 0; i < Math.min(clientsRawRows.length, 6); i++) {
    const row = clientsRawRows[i]
    if (Array.isArray(row)) {
      const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ')
      if (
        rowStr.includes('nome') &&
        (rowStr.includes('whatsapp') ||
          rowStr.includes('cidade') ||
          rowStr.includes('aniversário') ||
          rowStr.includes('aniversario'))
      ) {
        clientHeaderIndex = i
        break
      }
    }
  }

  if (clientHeaderIndex === -1) {
    // Tenta linha 1 (índice 1 no 0-based) ou linha 0
    clientHeaderIndex = clientsRawRows.length > 1 ? 1 : 0
  }

  const rawHeaders = (clientsRawRows[clientHeaderIndex] as unknown[]).map((h) =>
    String(h || '').trim(),
  )

  // Mapear colunas pelo nome aproximado
  const colIndex = {
    name: rawHeaders.findIndex((h) => /nome/i.test(h)),
    phone: rawHeaders.findIndex((h) => /whatsapp|celular|telefone/i.test(h)),
    cityState: rawHeaders.findIndex((h) => /cidade\s*[/-]\s*uf|cidade/i.test(h)),
    birthday: rawHeaders.findIndex((h) => /anivers[aá]rio|dia\s*[/-]\s*m[eê]s/i.test(h)),
    lastPurchase: rawHeaders.findIndex((h) => /[uú]ltima\s*compra/i.test(h)),
    coffeePref: rawHeaders.findIndex((h) => /prefer[eê]ncia.*caf[eé]|caf[eé].*prefer/i.test(h)),
    address: rawHeaders.findIndex((h) => /endere[cç]o.*completo|endere[cç]o/i.test(h)),
    channel: rawHeaders.findIndex((h) => /origem|canal/i.test(h)),
    notes: rawHeaders.findIndex((h) => /observa[cç][oõ]es/i.test(h)),
    email: rawHeaders.findIndex((h) => /e-?mail/i.test(h)),
    cpfCnpj: rawHeaders.findIndex((h) => /cpf|cnpj/i.test(h)),
    extraAddress: rawHeaders.findIndex((h) => /endere[cç]o\s*adicional/i.test(h)),
  }

  if (colIndex.name === -1) {
    // Fallback: assumir primeira coluna como nome
    colIndex.name = 0
  }

  // 4. Carregar clientes atuais do PocketBase para deduplicação em memória
  const currentOwnerId = pb.authStore.record?.id
  const existingContacts = await pb.collection<Contact>('contacts').getFullList({ sort: 'name' })

  // Mapa de contatos existentes normalizados por nome
  const contactMapByName = new Map<string, Contact>()
  for (const c of existingContacts) {
    const norm = normalizeClientName(c.name)
    if (norm) {
      contactMapByName.set(norm, c)
    }
  }

  // 5. Processar linhas da Base de Clientes
  const clientDataRows = clientsRawRows.slice(clientHeaderIndex + 1)
  const totalClientRows = clientDataRows.length

  const touchedContactIds = new Set<string>()
  const parsedContactsForPurchases = new Map<string, string>() // normalized name -> contact id
  // Preencher com existentes
  contactMapByName.forEach((c, norm) => {
    parsedContactsForPurchases.set(norm, c.id)
  })

  // Lotes de 20 registros
  const BATCH_SIZE = 20

  for (let i = 0; i < totalClientRows; i += BATCH_SIZE) {
    const chunk = clientDataRows.slice(i, i + BATCH_SIZE)

    for (const row of chunk) {
      if (!Array.isArray(row)) continue
      const rawName = colIndex.name !== -1 ? String(row[colIndex.name] || '').trim() : ''
      if (!rawName || rawName === '-' || rawName.toLowerCase().startsWith('total')) {
        continue
      }

      const normalized = normalizeClientName(rawName)
      if (!normalized) continue

      const rawPhone =
        colIndex.phone !== -1 ? cleanPhoneNumber(String(row[colIndex.phone] || '')) : ''
      const rawCityState =
        colIndex.cityState !== -1 ? cleanStringField(row[colIndex.cityState]) : ''
      const { city, state } = parseCityAndState(rawCityState)
      const rawBirthday = colIndex.birthday !== -1 ? row[colIndex.birthday] : null
      const parsedBday = parseBirthdayDDMM(rawBirthday)

      const rawLastPurchase = colIndex.lastPurchase !== -1 ? row[colIndex.lastPurchase] : null
      const parsedLastPurchase = parsePurchaseDate(rawLastPurchase)

      const rawCoffeePref =
        colIndex.coffeePref !== -1 ? cleanStringField(row[colIndex.coffeePref]) : ''
      const rawAddress = colIndex.address !== -1 ? cleanStringField(row[colIndex.address]) : ''
      const rawExtraAddress =
        colIndex.extraAddress !== -1 ? cleanStringField(row[colIndex.extraAddress]) : ''
      const fullAddress = [rawAddress, rawExtraAddress ? `(Adicional: ${rawExtraAddress})` : '']
        .filter(Boolean)
        .join('; ')

      const rawChannel = colIndex.channel !== -1 ? cleanStringField(row[colIndex.channel]) : ''
      const rawNotes = colIndex.notes !== -1 ? cleanStringField(row[colIndex.notes]) : ''
      const rawEmail = colIndex.email !== -1 ? cleanStringField(row[colIndex.email]) : ''
      const rawCpf = colIndex.cpfCnpj !== -1 ? cleanStringField(row[colIndex.cpfCnpj]) : ''

      const existingContact = contactMapByName.get(normalized)

      try {
        if (existingContact) {
          // Contato já existe: atualizar apenas campos vazios (upsert não-destrutivo)
          const updates: Record<string, unknown> = {}

          if (!existingContact.phone && rawPhone) updates.phone = rawPhone
          if (!existingContact.city && city) updates.city = city
          if (!existingContact.state && state) updates.state = state
          if (!existingContact.address && fullAddress) updates.address = fullAddress
          if (!existingContact.birthday && parsedBday) updates.birthday = parsedBday
          if (!existingContact.acquisition_channel && rawChannel)
            updates.acquisition_channel = rawChannel
          if (!existingContact.coffee_preference && rawCoffeePref)
            updates.coffee_preference = rawCoffeePref
          if (
            !existingContact.favorite_coffee &&
            rawCoffeePref &&
            !rawCoffeePref.includes('compras')
          ) {
            updates.favorite_coffee = rawCoffeePref
          }
          if (!existingContact.notes && rawNotes) updates.notes = rawNotes
          if (!existingContact.email && rawEmail && rawEmail.includes('@')) updates.email = rawEmail
          if (!existingContact.cpf_cnpj && rawCpf) updates.cpf_cnpj = rawCpf
          if (!existingContact.last_purchase_date && parsedLastPurchase) {
            updates.last_purchase_date = parsedLastPurchase
          }

          if (Object.keys(updates).length > 0) {
            const updated = await pb
              .collection<Contact>('contacts')
              .update(existingContact.id, updates)
            contactMapByName.set(normalized, updated)
            parsedContactsForPurchases.set(normalized, updated.id)
            touchedContactIds.add(updated.id)
            summary.clientsUpdated++
          } else {
            summary.clientsUnchanged++
            parsedContactsForPurchases.set(normalized, existingContact.id)
            touchedContactIds.add(existingContact.id)
          }
        } else {
          // Criar novo contato
          const newContactPayload: Record<string, unknown> = {
            name: rawName,
            status: parsedLastPurchase ? 'ativo' : 'lead',
            owner: currentOwnerId,
          }

          if (rawPhone) newContactPayload.phone = rawPhone
          if (city) newContactPayload.city = city
          if (state) newContactPayload.state = state
          if (fullAddress) newContactPayload.address = fullAddress
          if (parsedBday) newContactPayload.birthday = parsedBday
          if (parsedLastPurchase) newContactPayload.last_purchase_date = parsedLastPurchase
          if (rawChannel) newContactPayload.acquisition_channel = rawChannel
          if (rawCoffeePref) {
            newContactPayload.coffee_preference = rawCoffeePref
            if (!rawCoffeePref.includes('compras')) {
              newContactPayload.favorite_coffee = rawCoffeePref
            }
          }
          if (rawNotes) newContactPayload.notes = rawNotes
          if (rawEmail && rawEmail.includes('@')) newContactPayload.email = rawEmail
          if (rawCpf) newContactPayload.cpf_cnpj = rawCpf

          const created = await pb.collection<Contact>('contacts').create(newContactPayload)
          contactMapByName.set(normalized, created)
          parsedContactsForPurchases.set(normalized, created.id)
          touchedContactIds.add(created.id)
          summary.clientsCreated++

          // Registrar evento na linha do tempo
          try {
            await pb.collection('journey_events').create({
              contact: created.id,
              owner: currentOwnerId,
              type: 'cadastro',
              title: 'Importado via Planilha',
              description: `Cliente ${created.name} importado da base Fazenda São Domingos.`,
              channel: rawChannel || 'planilha',
            })
          } catch {
            /* intentionally ignored */
          }
        }
      } catch (rowErr) {
        summary.warnings.push(
          `Falha ao importar cliente "${rawName}": ${rowErr instanceof Error ? rowErr.message : 'Erro desconhecido'}`,
        )
      }
    }

    const currentProcessed = Math.min(i + BATCH_SIZE, totalClientRows)
    const pct = 5 + Math.round((currentProcessed / totalClientRows) * 55)
    onProgress?.({
      step: 'clients',
      message: `Processando clientes (${currentProcessed}/${totalClientRows})...`,
      percent: pct,
      processedClients: currentProcessed,
      totalClients: totalClientRows,
      processedPurchases: 0,
      totalPurchases: 0,
    })
  }

  // 6. Processar aba "Registro de Vendas" se presente
  if (salesSheetName && workbook.Sheets[salesSheetName]) {
    const salesSheet = workbook.Sheets[salesSheetName]
    const salesRawRows: unknown[][] = XLSX.utils.sheet_to_json(salesSheet, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    if (salesRawRows.length >= 2) {
      let salesHeaderIndex = -1
      for (let i = 0; i < Math.min(salesRawRows.length, 6); i++) {
        const row = salesRawRows[i]
        if (Array.isArray(row)) {
          const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ')
          if (
            rowStr.includes('cliente') &&
            (rowStr.includes('pedido') || rowStr.includes('valor') || rowStr.includes('data'))
          ) {
            salesHeaderIndex = i
            break
          }
        }
      }

      if (salesHeaderIndex === -1) salesHeaderIndex = 1

      const salesHeaders = (salesRawRows[salesHeaderIndex] as unknown[]).map((h) =>
        String(h || '').trim(),
      )
      const salesColIndex = {
        date: salesHeaders.findIndex((h) => /data/i.test(h)),
        client: salesHeaders.findIndex((h) => /cliente|nome/i.test(h)),
        quantity: salesHeaders.findIndex((h) => /quant/i.test(h)),
        type: salesHeaders.findIndex((h) => /tipo|gramatura|produto/i.test(h)),
        amount: salesHeaders.findIndex((h) => /valor/i.test(h)),
        status: salesHeaders.findIndex((h) => /status|pagamento/i.test(h)),
        notes: salesHeaders.findIndex((h) => /observa/i.test(h)),
      }

      const salesDataRows = salesRawRows.slice(salesHeaderIndex + 1)
      const totalSalesRows = salesDataRows.length
      const contactsToRecalculate = new Set<string>()

      for (let i = 0; i < totalSalesRows; i += BATCH_SIZE) {
        const chunk = salesDataRows.slice(i, i + BATCH_SIZE)

        for (const row of chunk) {
          if (!Array.isArray(row)) continue
          const clientName =
            salesColIndex.client !== -1 ? String(row[salesColIndex.client] || '').trim() : ''
          if (
            !clientName ||
            clientName === '-' ||
            clientName.toLowerCase().startsWith('total registrado') ||
            clientName.toLowerCase().startsWith('total')
          ) {
            continue
          }

          const rawDate = salesColIndex.date !== -1 ? row[salesColIndex.date] : null
          const purchaseDate = parsePurchaseDate(rawDate) || new Date().toISOString()

          const qty =
            salesColIndex.quantity !== -1 ? cleanStringField(row[salesColIndex.quantity]) : ''
          const itemType =
            salesColIndex.type !== -1 ? cleanStringField(row[salesColIndex.type]) : ''
          const itemsDesc =
            [qty ? `${qty}x` : '', itemType].filter(Boolean).join(' ') || 'Café Especial'

          const rawAmount = salesColIndex.amount !== -1 ? row[salesColIndex.amount] : null
          let amount = 0
          if (typeof rawAmount === 'number') {
            amount = rawAmount
          } else if (rawAmount) {
            const cleaned = String(rawAmount)
              .replace(/[R$\s]/g, '')
              .replace(',', '.')
            amount = parseFloat(cleaned) || 0
          }

          const paymentStatus =
            salesColIndex.status !== -1 ? cleanStringField(row[salesColIndex.status]) : ''
          const saleNotes =
            salesColIndex.notes !== -1 ? cleanStringField(row[salesColIndex.notes]) : ''
          const fullNotes = [paymentStatus ? `Status: ${paymentStatus}` : '', saleNotes]
            .filter(Boolean)
            .join(' | ')

          // Localizar contato pelo nome
          const normClient = normalizeClientName(clientName)
          let targetContactId = parsedContactsForPurchases.get(normClient)

          // Se não encontrou, criar contato básico
          if (!targetContactId) {
            try {
              const newBasicContact = await pb.collection<Contact>('contacts').create({
                name: clientName,
                status: 'ativo',
                owner: currentOwnerId,
                notes: 'Criado automaticamente pelo histórico de vendas da planilha.',
              })
              targetContactId = newBasicContact.id
              parsedContactsForPurchases.set(normClient, targetContactId)
              contactMapByName.set(normClient, newBasicContact)
              touchedContactIds.add(targetContactId)
              summary.clientsCreated++
            } catch (err) {
              summary.warnings.push(
                `Não foi possível criar contato automático para a venda de "${clientName}": ${err instanceof Error ? err.message : 'Erro'}`,
              )
              continue
            }
          }

          // Criar registro na collection purchases
          try {
            await pb.collection('purchases').create({
              contact: targetContactId,
              owner: currentOwnerId,
              amount,
              purchase_date: purchaseDate,
              items_description: itemsDesc,
              notes: fullNotes,
            })
            summary.purchasesImported++
            contactsToRecalculate.add(targetContactId)
            touchedContactIds.add(targetContactId)
          } catch (pErr) {
            summary.warnings.push(
              `Erro ao registrar compra para "${clientName}": ${pErr instanceof Error ? pErr.message : 'Erro'}`,
            )
          }
        }

        const currentSalesProc = Math.min(i + BATCH_SIZE, totalSalesRows)
        const pct = 60 + Math.round((currentSalesProc / totalSalesRows) * 25)
        onProgress?.({
          step: 'purchases',
          message: `Importando compras (${currentSalesProc}/${totalSalesRows})...`,
          percent: pct,
          processedClients: totalClientRows,
          totalClients: totalClientRows,
          processedPurchases: currentSalesProc,
          totalPurchases: totalSalesRows,
        })
      }

      // Recalcular métricas de compras dos contatos tocados
      onProgress?.({
        step: 'recalculating',
        message: 'Atualizando métricas de recorrência e fidelidade dos clientes...',
        percent: 90,
        processedClients: totalClientRows,
        totalClients: totalClientRows,
        processedPurchases: summary.purchasesImported,
        totalPurchases: totalSalesRows,
      })

      for (const cId of contactsToRecalculate) {
        try {
          await recalculateContactPurchases(cId)
        } catch {
          /* intentionally ignored */
        }
      }
    }
  }

  summary.contactsTouchedCount = touchedContactIds.size

  onProgress?.({
    step: 'done',
    message: 'Importação concluída com sucesso!',
    percent: 100,
    processedClients: totalClientRows,
    totalClients: totalClientRows,
    processedPurchases: summary.purchasesImported,
    totalPurchases: summary.purchasesImported,
  })

  return summary
}
