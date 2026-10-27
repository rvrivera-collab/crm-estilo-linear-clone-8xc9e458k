import * as XLSX from 'xlsx'
import { listPurchases } from '@/services/crm'
import type { Contact, Purchase } from '@/types/crm'
import { getLoyaltyLevel } from '@/types/crm'

/**
 * Mapeia um registro de cliente para linha com colunas amigáveis e completas
 */
export function formatContactForExport(contact: Contact) {
  const loyalty = getLoyaltyLevel(contact.purchase_count || 0)

  return {
    Nome: contact.name || '',
    'Apelido (Disney)': contact.nickname || '',
    'E-mail': contact.email || '',
    Telefone: contact.phone || '',
    Status: contact.status || 'lead',
    'Nível Fidelidade': `Nível ${loyalty.level} - ${loyalty.name}`,
    'Qtd. Compras': Number(contact.purchase_count || 0),
    'Total Gasto (R$)': Number(contact.total_spent || 0),
    'Última Compra': contact.last_purchase_date ? contact.last_purchase_date.split('T')[0] : '',
    Aniversário: contact.birthday ? contact.birthday.split('T')[0] : '',
    'Café Favorito': contact.favorite_coffee || '',
    'Torra Preferida': contact.roast_preference || '',
    'Método de Extração': contact.brew_method_preference || '',
    'Intensidade Preferida': contact.intensity_preference || '',
    'Restrições Alimentares': contact.dietary_restrictions || '',
    'Data Especial (Motivo)': contact.special_date_description || '',
    'Data Especial (Data)': contact.special_date ? contact.special_date.split('T')[0] : '',
    'Como Conheceu a Loja': contact.acquisition_channel || '',
    'Último Cupom': contact.last_coupon_code || '',
    'Data do Cupom': contact.last_coupon_date ? contact.last_coupon_date.split('T')[0] : '',
    'Data de Reengajamento': contact.last_reengagement_date
      ? contact.last_reengagement_date.split('T')[0]
      : '',
    'Notas de Atendimento': contact.service_notes || '',
    'Notas Gerais': contact.notes || '',
    'Data de Cadastro': contact.created ? contact.created.split('T')[0] : '',
  }
}

/**
 * Mapeia compras para linha da aba Compras
 */
export function formatPurchaseForExport(purchase: Purchase, contactMap: Map<string, string>) {
  const clientName =
    contactMap.get(purchase.contact) || (purchase.expand?.contact?.name ?? purchase.contact ?? '')

  return {
    'ID Compra': purchase.id,
    Cliente: clientName,
    'Valor (R$)': Number(purchase.amount || 0),
    'Data da Compra': purchase.purchase_date ? purchase.purchase_date.split('T')[0] : '',
    'Itens / Cafés Adquiridos': purchase.items_description || '',
    Observações: purchase.notes || '',
    'Data de Registro': purchase.created ? purchase.created.split('T')[0] : '',
  }
}

export interface ExportContactsOptions {
  contacts: Contact[]
  allContacts?: Contact[]
  format?: 'xlsx' | 'csv'
  scope?: 'filtered' | 'all'
  includePurchases?: boolean
}

/**
 * Gera nome do arquivo com a data de hoje: clientes-cafes-especiais-YYYY-MM-DD.xlsx / .csv
 */
export function getExportFileName(format: 'xlsx' | 'csv' = 'xlsx') {
  const today = new Date().toISOString().split('T')[0]
  return `clientes-cafes-especiais-${today}.${format}`
}

/**
 * Exporta a planilha contendo a aba 'Clientes' e opcionalmente 'Compras'
 */
export async function exportContactsSpreadsheet({
  contacts,
  allContacts,
  format = 'xlsx',
  scope = 'filtered',
  includePurchases = true,
}: ExportContactsOptions): Promise<{ count: number; purchasesCount: number; fileName: string }> {
  const targetContacts = scope === 'all' && allContacts ? allContacts : contacts
  const contactsData = targetContacts.map(formatContactForExport)

  const workbook = XLSX.utils.book_new()

  // Sheet 1: Clientes
  const contactsSheet = XLSX.utils.json_to_sheet(contactsData)

  // Ajuste de largura automática das colunas
  if (contactsData.length > 0) {
    const colKeys = Object.keys(contactsData[0])
    contactsSheet['!cols'] = colKeys.map((key) => {
      const maxLen = Math.max(
        key.length,
        ...contactsData.map((row) => String((row as Record<string, unknown>)[key] || '').length),
      )
      return { wch: Math.min(Math.max(maxLen + 2, 10), 45) }
    })
  }

  XLSX.utils.book_append_sheet(workbook, contactsSheet, 'Clientes')

  // Sheet 2: Compras
  let purchasesCount = 0
  if (includePurchases) {
    try {
      const purchases = await listPurchases()

      // Filtra as compras apenas dos clientes que estão sendo exportados se scope for 'filtered'
      const contactIdsSet = new Set(targetContacts.map((c) => c.id))
      const relevantPurchases =
        scope === 'all' ? purchases : purchases.filter((p) => contactIdsSet.has(p.contact))

      const contactMap = new Map<string, string>()
      targetContacts.forEach((c) => contactMap.set(c.id, c.name))
      if (allContacts) {
        allContacts.forEach((c) => contactMap.set(c.id, c.name))
      }

      const purchasesData = relevantPurchases.map((p) => formatPurchaseForExport(p, contactMap))
      purchasesCount = purchasesData.length

      const purchasesSheet = XLSX.utils.json_to_sheet(purchasesData)
      if (purchasesData.length > 0) {
        const pCols = Object.keys(purchasesData[0])
        purchasesSheet['!cols'] = pCols.map((key) => {
          const maxLen = Math.max(
            key.length,
            ...purchasesData.map(
              (row) => String((row as Record<string, unknown>)[key] || '').length,
            ),
          )
          return { wch: Math.min(Math.max(maxLen + 2, 10), 45) }
        })
      }

      XLSX.utils.book_append_sheet(workbook, purchasesSheet, 'Compras')
    } catch (err) {
      console.warn('Não foi possível carregar o histórico de compras para a exportação:', err)
    }
  }

  const fileName = getExportFileName(format)

  if (format === 'csv') {
    // Para CSV, exporta a aba principal de Clientes com codificação UTF-8
    const csvContent = XLSX.utils.sheet_to_csv(contactsSheet)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } else {
    // Formato XLSX (arquivo binário com múltiplas abas)
    XLSX.writeFile(workbook, fileName, { compression: true })
  }

  return {
    count: targetContacts.length,
    purchasesCount,
    fileName,
  }
}
