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
  return rawName
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
  retriesCount?: number
  createdClients?: number
  updatedClients?: number
  unchangedClients?: number
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
 * Utilitário de espera (delay)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extrai se um erro é Too Many Requests (HTTP 429) ou erro de rede temporário
 */
export function isRateLimitOrNetworkError(err: unknown): boolean {
  if (!err) return false
  const str = String(err).toLowerCase()
  if (
    str.includes('429') ||
    str.includes('too many requests') ||
    str.includes('rate limit') ||
    str.includes('ratelimit')
  ) {
    return true
  }
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as Record<string, unknown>
    if (anyErr.status === 429 || anyErr.statusCode === 429) return true
    if (anyErr.response && typeof anyErr.response === 'object') {
      const resp = anyErr.response as Record<string, unknown>
      if (resp.status === 429 || resp.statusCode === 429) return true
    }
  }
  return false
}

/**
 * Executa uma operação assíncrona com throttle prévio, detecção de 429 e retry com backoff exponencial
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number
    initialBackoffMs?: number
    throttleMs?: number
    onRetry?: (attempt: number, delayMs: number, err: unknown) => void
  },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 5
  const initialBackoffMs = options?.initialBackoffMs ?? 800
  const throttleMs = options?.throttleMs ?? 40

  if (throttleMs > 0) {
    await sleep(throttleMs)
  }

  let attempt = 0
  let currentDelay = initialBackoffMs

  while (true) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (attempt > maxRetries || !isRateLimitOrNetworkError(err)) {
        throw err
      }

      // Verificar se há header Retry-After
      let waitMs = currentDelay
      if (typeof err === 'object' && err !== null) {
        const anyErr = err as Record<string, unknown>
        const resp = anyErr.response as Record<string, unknown> | undefined
        const headers = (resp?.headers || anyErr.headers) as Record<string, unknown> | undefined
        if (headers) {
          const retryAfter =
            (typeof headers.get === 'function'
              ? (headers as unknown as Headers).get('Retry-After')
              : null) ||
            headers['retry-after'] ||
            headers['Retry-After']
          if (retryAfter) {
            const parsed = parseInt(String(retryAfter), 10)
            if (!isNaN(parsed) && parsed > 0) {
              waitMs = parsed * 1000
            }
          }
        }
      }

      // Adiciona jitter aleatório de até 20% para evitar sincronismo
      const jitter = Math.floor(Math.random() * 200)
      const finalWait = waitMs + jitter

      options?.onRetry?.(attempt, finalWait, err)
      await sleep(finalWait)

      // Dobra o backoff exponencialmente até um teto de 10 segundos
      currentDelay = Math.min(currentDelay * 2, 10000)
    }
  }
}

interface BatchContactPayload {
  id?: string
  name: string
  normalizedName: string
  phone?: string
  city?: string
  state?: string
  address?: string
  birthday?: string | null
  acquisition_channel?: string
  coffee_preference?: string
  favorite_coffee?: string
  coffee_machine?: string
  brew_method_preference?: string
  sent_mug?: boolean
  sent_welcome_folder?: boolean
  sent_stickers?: boolean
  notes?: string
  email?: string
  cpf_cnpj?: string
  last_purchase_date?: string | null
  status?: 'lead' | 'ativo' | 'inativo'
}

interface BatchPurchasePayload {
  contact: string
  amount: number
  purchase_date: string
  items_description?: string
  notes?: string
}

interface BatchApiResponse {
  success: boolean
  createdContacts: Array<{ id: string; name: string; normalizedName: string }>
  updatedContacts: Array<{ id: string; name: string; normalizedName: string }>
  unchangedContacts: Array<{ id: string; name: string; normalizedName: string }>
  insertedPurchasesCount: number
  recalculatedContactsCount: number
  warnings: string[]
  error?: string
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
    retriesCount: 0,
    warnings: [],
    contactsTouchedCount: 0,
  }

  let totalRetries = 0
  const handleRetry = (attempt: number, delayMs: number) => {
    totalRetries++
    summary.retriesCount = totalRetries
    onProgress?.({
      step: 'clients',
      message: `Aguardando liberação de requisições (${attempt}ª tentativa, pausa de ${(delayMs / 1000).toFixed(1)}s)...`,
      percent: 50,
      processedClients: summary.clientsCreated + summary.clientsUpdated + summary.clientsUnchanged,
      totalClients: 220,
      processedPurchases: summary.purchasesImported,
      totalPurchases: 0,
      retriesCount: totalRetries,
      createdClients: summary.clientsCreated,
      updatedClients: summary.clientsUpdated,
      unchangedClients: summary.clientsUnchanged,
    })
  }

  onProgress?.({
    step: 'reading',
    message: 'Lendo e analisando arquivo da planilha...',
    percent: 5,
    processedClients: 0,
    totalClients: 0,
    processedPurchases: 0,
    totalPurchases: 0,
    retriesCount: 0,
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
    coffeeMachine: rawHeaders.findIndex((h) => /m[aá]quina.*caf[eé]|equipamento/i.test(h)),
    brewMethod: rawHeaders.findIndex((h) => /m[eé]todo.*(consumo|extra[cç][aã]o|preparo)/i.test(h)),
    sentMug: rawHeaders.findIndex((h) => /caneca/i.test(h)),
    sentWelcomeFolder: rawHeaders.findIndex((h) => /folder/i.test(h)),
    sentStickers: rawHeaders.findIndex((h) => /adesivo/i.test(h)),
  }

  if (colIndex.name === -1) {
    colIndex.name = 0
  }

  // 4. Carregar clientes atuais do PocketBase com retry para deduplicação em memória e idempotência
  const currentOwnerId = pb.authStore.record?.id
  const existingContacts = await executeWithRetry(
    () => pb.collection<Contact>('contacts').getFullList({ sort: 'name' }),
    { onRetry: handleRetry },
  )

  // Mapa de contatos existentes normalizados por nome
  const contactMapByName = new Map<string, Contact>()
  for (const c of existingContacts) {
    const norm = normalizeClientName(c.name)
    if (norm) {
      contactMapByName.set(norm, c)
    }
  }

  // 5. Preparar linhas da Base de Clientes
  const clientDataRows = clientsRawRows.slice(clientHeaderIndex + 1)
  const totalClientRows = clientDataRows.length

  const touchedContactIds = new Set<string>()
  const parsedContactsForPurchases = new Map<string, string>() // normalized name -> contact id
  contactMapByName.forEach((c, norm) => {
    parsedContactsForPurchases.set(norm, c.id)
  })

  // Preparar os dados de todos os contatos da planilha
  const preparedContacts: BatchContactPayload[] = []

  for (const row of clientDataRows) {
    if (!Array.isArray(row)) continue
    const rawName = colIndex.name !== -1 ? String(row[colIndex.name] || '').trim() : ''
    if (!rawName || rawName === '-' || rawName.toLowerCase().startsWith('total')) {
      continue
    }

    const normalized = normalizeClientName(rawName)
    if (!normalized) continue

    const rawPhone =
      colIndex.phone !== -1 ? cleanPhoneNumber(String(row[colIndex.phone] || '')) : ''
    const rawCityState = colIndex.cityState !== -1 ? cleanStringField(row[colIndex.cityState]) : ''
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
    const rawCoffeeMachine =
      colIndex.coffeeMachine !== -1 ? cleanStringField(row[colIndex.coffeeMachine]) : ''
    const rawBrewMethod =
      colIndex.brewMethod !== -1 ? cleanStringField(row[colIndex.brewMethod]) : ''

    const parseBoolCell = (val: unknown): boolean | undefined => {
      if (val === undefined || val === null || val === '') return undefined
      const s = String(val).trim().toLowerCase()
      if (s === 'sim' || s === 'true' || s === '1' || s === 's' || s === 'x' || s === 'enviado')
        return true
      if (s === 'não' || s === 'nao' || s === 'false' || s === '0' || s === 'n') return false
      return undefined
    }

    const rawSentMug = colIndex.sentMug !== -1 ? parseBoolCell(row[colIndex.sentMug]) : undefined
    const rawSentFolder =
      colIndex.sentWelcomeFolder !== -1 ? parseBoolCell(row[colIndex.sentWelcomeFolder]) : undefined
    const rawSentStickers =
      colIndex.sentStickers !== -1 ? parseBoolCell(row[colIndex.sentStickers]) : undefined

    const existing = contactMapByName.get(normalized)

    const itemPayload: BatchContactPayload = {
      id: existing ? existing.id : undefined,
      name: rawName,
      normalizedName: normalized,
      phone: rawPhone || undefined,
      city: city || undefined,
      state: state || undefined,
      address: fullAddress || undefined,
      birthday: parsedBday || undefined,
      acquisition_channel: rawChannel || undefined,
      coffee_preference: rawCoffeePref || undefined,
      favorite_coffee:
        rawCoffeePref && !rawCoffeePref.includes('compras') ? rawCoffeePref : undefined,
      coffee_machine: rawCoffeeMachine || undefined,
      brew_method_preference: rawBrewMethod || undefined,
      sent_mug: rawSentMug,
      sent_welcome_folder: rawSentFolder,
      sent_stickers: rawSentStickers,
      notes: rawNotes || undefined,
      email: rawEmail && rawEmail.includes('@') ? rawEmail : undefined,
      cpf_cnpj: rawCpf || undefined,
      last_purchase_date: parsedLastPurchase || undefined,
      status: parsedLastPurchase ? 'ativo' : existing?.status || 'lead',
    }

    preparedContacts.push(itemPayload)
  }

  // 6. Processar contatos em lotes (batch) via /backend/v1/crm/import-batch
  // com fallback automático com throttle caso o endpoint não esteja acessível
  const CLIENT_BATCH_SIZE = 40
  let serverBatchSupported = true

  for (let i = 0; i < preparedContacts.length; i += CLIENT_BATCH_SIZE) {
    const chunk = preparedContacts.slice(i, i + CLIENT_BATCH_SIZE)

    if (serverBatchSupported) {
      try {
        const batchResponse = await executeWithRetry<BatchApiResponse>(
          () =>
            pb.send<BatchApiResponse>('/backend/v1/crm/import-batch', {
              method: 'POST',
              body: JSON.stringify({ contacts: chunk }),
            }),
          {
            throttleMs: 100, // Breve pausa saudável entre lotes
            onRetry: handleRetry,
          },
        )

        // Processar resultados do batch
        if (batchResponse.createdContacts) {
          summary.clientsCreated += batchResponse.createdContacts.length
          for (const c of batchResponse.createdContacts) {
            parsedContactsForPurchases.set(c.normalizedName, c.id)
            touchedContactIds.add(c.id)
          }
        }
        if (batchResponse.updatedContacts) {
          summary.clientsUpdated += batchResponse.updatedContacts.length
          for (const c of batchResponse.updatedContacts) {
            parsedContactsForPurchases.set(c.normalizedName, c.id)
            touchedContactIds.add(c.id)
          }
        }
        if (batchResponse.unchangedContacts) {
          summary.clientsUnchanged += batchResponse.unchangedContacts.length
          for (const c of batchResponse.unchangedContacts) {
            parsedContactsForPurchases.set(c.normalizedName, c.id)
            touchedContactIds.add(c.id)
          }
        }
        if (batchResponse.warnings && batchResponse.warnings.length > 0) {
          summary.warnings.push(...batchResponse.warnings)
        }
      } catch (batchErr) {
        // Se a rota falhar por 404/500, fallback gracioso com throttle individual
        console.warn(
          'Endpoint /backend/v1/crm/import-batch indisponível, usando fallback com throttle:',
          batchErr,
        )
        serverBatchSupported = false
        await processContactsChunkFallback(chunk)
      }
    } else {
      await processContactsChunkFallback(chunk)
    }

    const currentProcessed = Math.min(i + CLIENT_BATCH_SIZE, preparedContacts.length)
    const pct = 5 + Math.round((currentProcessed / preparedContacts.length) * 55)
    onProgress?.({
      step: 'clients',
      message: `Processando clientes (${currentProcessed}/${preparedContacts.length})...`,
      percent: pct,
      processedClients: currentProcessed,
      totalClients: preparedContacts.length,
      processedPurchases: 0,
      totalPurchases: 0,
      retriesCount: totalRetries,
      createdClients: summary.clientsCreated,
      updatedClients: summary.clientsUpdated,
      unchangedClients: summary.clientsUnchanged,
    })
  }

  async function processContactsChunkFallback(chunk: BatchContactPayload[]) {
    for (const item of chunk) {
      const existingContact = contactMapByName.get(item.normalizedName)
      try {
        if (existingContact) {
          const updates: Record<string, unknown> = {}
          if (!existingContact.phone && item.phone) updates.phone = item.phone
          if (!existingContact.city && item.city) updates.city = item.city
          if (!existingContact.state && item.state) updates.state = item.state
          if (!existingContact.address && item.address) updates.address = item.address
          if (!existingContact.birthday && item.birthday) updates.birthday = item.birthday
          if (!existingContact.acquisition_channel && item.acquisition_channel) {
            updates.acquisition_channel = item.acquisition_channel
          }
          if (!existingContact.coffee_preference && item.coffee_preference) {
            updates.coffee_preference = item.coffee_preference
          }
          if (!existingContact.favorite_coffee && item.favorite_coffee) {
            updates.favorite_coffee = item.favorite_coffee
          }
          if (!existingContact.coffee_machine && item.coffee_machine) {
            updates.coffee_machine = item.coffee_machine
          }
          if (!existingContact.brew_method_preference && item.brew_method_preference) {
            updates.brew_method_preference = item.brew_method_preference
          }
          if (item.sent_mug !== undefined && existingContact.sent_mug !== item.sent_mug) {
            updates.sent_mug = item.sent_mug
          }
          if (
            item.sent_welcome_folder !== undefined &&
            existingContact.sent_welcome_folder !== item.sent_welcome_folder
          ) {
            updates.sent_welcome_folder = item.sent_welcome_folder
          }
          if (
            item.sent_stickers !== undefined &&
            existingContact.sent_stickers !== item.sent_stickers
          ) {
            updates.sent_stickers = item.sent_stickers
          }
          if (!existingContact.notes && item.notes) updates.notes = item.notes
          if (!existingContact.email && item.email) updates.email = item.email
          if (!existingContact.cpf_cnpj && item.cpf_cnpj) updates.cpf_cnpj = item.cpf_cnpj
          if (!existingContact.last_purchase_date && item.last_purchase_date) {
            updates.last_purchase_date = item.last_purchase_date
            if (existingContact.status === 'lead') updates.status = 'ativo'
          }

          if (Object.keys(updates).length > 0) {
            const updated = await executeWithRetry(
              () => pb.collection<Contact>('contacts').update(existingContact.id, updates),
              { throttleMs: 60, onRetry: handleRetry },
            )
            contactMapByName.set(item.normalizedName, updated)
            parsedContactsForPurchases.set(item.normalizedName, updated.id)
            touchedContactIds.add(updated.id)
            summary.clientsUpdated++
          } else {
            summary.clientsUnchanged++
            parsedContactsForPurchases.set(item.normalizedName, existingContact.id)
            touchedContactIds.add(existingContact.id)
          }
        } else {
          const newPayload: Record<string, unknown> = {
            name: item.name,
            status: item.last_purchase_date ? 'ativo' : 'lead',
            owner: currentOwnerId,
          }
          if (item.phone) newPayload.phone = item.phone
          if (item.city) newPayload.city = item.city
          if (item.state) newPayload.state = item.state
          if (item.address) newPayload.address = item.address
          if (item.birthday) newPayload.birthday = item.birthday
          if (item.last_purchase_date) newPayload.last_purchase_date = item.last_purchase_date
          if (item.acquisition_channel) newPayload.acquisition_channel = item.acquisition_channel
          if (item.coffee_preference) newPayload.coffee_preference = item.coffee_preference
          if (item.favorite_coffee) newPayload.favorite_coffee = item.favorite_coffee
          if (item.coffee_machine) newPayload.coffee_machine = item.coffee_machine
          if (item.brew_method_preference)
            newPayload.brew_method_preference = item.brew_method_preference
          if (item.sent_mug !== undefined) newPayload.sent_mug = item.sent_mug
          if (item.sent_welcome_folder !== undefined)
            newPayload.sent_welcome_folder = item.sent_welcome_folder
          if (item.sent_stickers !== undefined) newPayload.sent_stickers = item.sent_stickers
          if (item.notes) newPayload.notes = item.notes
          if (item.email) newPayload.email = item.email
          if (item.cpf_cnpj) newPayload.cpf_cnpj = item.cpf_cnpj

          const created = await executeWithRetry(
            () => pb.collection<Contact>('contacts').create(newPayload),
            { throttleMs: 60, onRetry: handleRetry },
          )
          contactMapByName.set(item.normalizedName, created)
          parsedContactsForPurchases.set(item.normalizedName, created.id)
          touchedContactIds.add(created.id)
          summary.clientsCreated++

          // Journey event opcional
          try {
            await executeWithRetry(
              () =>
                pb.collection('journey_events').create({
                  contact: created.id,
                  owner: currentOwnerId,
                  type: 'cadastro',
                  title: 'Importado via Planilha',
                  description: `Cliente ${created.name} importado da base Fazenda São Domingos.`,
                  channel: item.acquisition_channel || 'planilha',
                }),
              { throttleMs: 30, onRetry: handleRetry },
            )
          } catch {
            /* non-fatal */
          }
        }
      } catch (itemErr) {
        summary.warnings.push(
          `Falha ao importar cliente "${item.name}": ${itemErr instanceof Error ? itemErr.message : 'Erro desconhecido'}`,
        )
      }
    }
  }

  // 7. Processar aba "Registro de Vendas" se presente
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
      const preparedPurchases: BatchPurchasePayload[] = []
      const contactsToRecalculate = new Set<string>()

      for (const row of salesDataRows) {
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
        const itemType = salesColIndex.type !== -1 ? cleanStringField(row[salesColIndex.type]) : ''
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

        const normClient = normalizeClientName(clientName)
        let targetContactId = parsedContactsForPurchases.get(normClient)

        // Se não encontrou contato, criar contato básico com throttle e retry
        if (!targetContactId) {
          try {
            const newBasicContact = await executeWithRetry(
              () =>
                pb.collection<Contact>('contacts').create({
                  name: clientName,
                  status: 'ativo',
                  owner: currentOwnerId,
                  notes: 'Criado automaticamente pelo histórico de vendas da planilha.',
                }),
              { throttleMs: 60, onRetry: handleRetry },
            )
            targetContactId = newBasicContact.id
            parsedContactsForPurchases.set(normClient, targetContactId)
            contactMapByName.set(normClient, newBasicContact)
            touchedContactIds.add(targetContactId)
            summary.clientsCreated++
          } catch (err) {
            summary.warnings.push(
              `Não foi possível criar contato para a venda de "${clientName}": ${err instanceof Error ? err.message : 'Erro'}`,
            )
            continue
          }
        }

        preparedPurchases.push({
          contact: targetContactId,
          amount,
          purchase_date: purchaseDate,
          items_description: itemsDesc,
          notes: fullNotes,
        })
        contactsToRecalculate.add(targetContactId)
        touchedContactIds.add(targetContactId)
      }

      // Processar compras em lote de 50
      const PURCHASE_BATCH_SIZE = 50
      for (let i = 0; i < preparedPurchases.length; i += PURCHASE_BATCH_SIZE) {
        const pChunk = preparedPurchases.slice(i, i + PURCHASE_BATCH_SIZE)

        if (serverBatchSupported) {
          try {
            const batchRes = await executeWithRetry<BatchApiResponse>(
              () =>
                pb.send<BatchApiResponse>('/backend/v1/crm/import-batch', {
                  method: 'POST',
                  body: JSON.stringify({ purchases: pChunk }),
                }),
              { throttleMs: 80, onRetry: handleRetry },
            )
            summary.purchasesImported += batchRes.insertedPurchasesCount || pChunk.length
            if (batchRes.warnings && batchRes.warnings.length > 0) {
              summary.warnings.push(...batchRes.warnings)
            }
          } catch (_) {
            await processPurchasesFallback(pChunk)
          }
        } else {
          await processPurchasesFallback(pChunk)
        }

        const currentSalesProc = Math.min(i + PURCHASE_BATCH_SIZE, preparedPurchases.length)
        const pct = 60 + Math.round((currentSalesProc / preparedPurchases.length) * 25)
        onProgress?.({
          step: 'purchases',
          message: `Importando compras (${currentSalesProc}/${preparedPurchases.length})...`,
          percent: pct,
          processedClients: preparedContacts.length,
          totalClients: preparedContacts.length,
          processedPurchases: currentSalesProc,
          totalPurchases: preparedPurchases.length,
          retriesCount: totalRetries,
          createdClients: summary.clientsCreated,
          updatedClients: summary.clientsUpdated,
          unchangedClients: summary.clientsUnchanged,
        })
      }

      async function processPurchasesFallback(chunk: BatchPurchasePayload[]) {
        for (const p of chunk) {
          try {
            await executeWithRetry(
              () =>
                pb.collection('purchases').create({
                  contact: p.contact,
                  owner: currentOwnerId,
                  amount: p.amount,
                  purchase_date: p.purchase_date,
                  items_description: p.items_description,
                  notes: p.notes,
                }),
              { throttleMs: 50, onRetry: handleRetry },
            )
            summary.purchasesImported++
          } catch (pErr) {
            summary.warnings.push(
              `Erro ao registrar compra: ${pErr instanceof Error ? pErr.message : 'Erro'}`,
            )
          }
        }
      }

      // Recalcular métricas de compras dos contatos tocados de forma agrupada
      onProgress?.({
        step: 'recalculating',
        message: 'Atualizando métricas de recorrência e fidelidade dos clientes...',
        percent: 90,
        processedClients: preparedContacts.length,
        totalClients: preparedContacts.length,
        processedPurchases: summary.purchasesImported,
        totalPurchases: preparedPurchases.length,
        retriesCount: totalRetries,
        createdClients: summary.clientsCreated,
        updatedClients: summary.clientsUpdated,
        unchangedClients: summary.clientsUnchanged,
      })

      const recalculateList = Array.from(contactsToRecalculate)
      const RECALC_BATCH_SIZE = 50

      for (let i = 0; i < recalculateList.length; i += RECALC_BATCH_SIZE) {
        const rChunk = recalculateList.slice(i, i + RECALC_BATCH_SIZE)
        if (serverBatchSupported) {
          try {
            await executeWithRetry(
              () =>
                pb.send<BatchApiResponse>('/backend/v1/crm/import-batch', {
                  method: 'POST',
                  body: JSON.stringify({ recalculate_contact_ids: rChunk }),
                }),
              { throttleMs: 80, onRetry: handleRetry },
            )
          } catch (_) {
            for (const cId of rChunk) {
              try {
                await executeWithRetry(() => recalculateContactPurchases(cId), {
                  throttleMs: 40,
                  onRetry: handleRetry,
                })
              } catch {
                /* non-fatal */
              }
            }
          }
        } else {
          for (const cId of rChunk) {
            try {
              await executeWithRetry(() => recalculateContactPurchases(cId), {
                throttleMs: 40,
                onRetry: handleRetry,
              })
            } catch {
              /* non-fatal */
            }
          }
        }
      }
    }
  }

  summary.contactsTouchedCount = touchedContactIds.size

  onProgress?.({
    step: 'done',
    message: 'Importação concluída com sucesso!',
    percent: 100,
    processedClients: preparedContacts.length,
    totalClients: preparedContacts.length,
    processedPurchases: summary.purchasesImported,
    totalPurchases: summary.purchasesImported,
    retriesCount: totalRetries,
    createdClients: summary.clientsCreated,
    updatedClients: summary.clientsUpdated,
    unchangedClients: summary.clientsUnchanged,
  })

  return summary
}
