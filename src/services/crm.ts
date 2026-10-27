import pb from '@/lib/pocketbase/client'
import type {
  Activity,
  Campaign,
  CaptureForm,
  Contact,
  CustomMetric,
  Deal,
  EmailTemplate,
  Empresa,
  Purchase,
  Stage,
  UserRecord,
} from '@/types/crm'

export async function listStages() {
  return pb.collection<Stage>('pipeline_stages').getFullList({ sort: 'order' })
}

export async function listEmpresas() {
  return pb.collection<Empresa>('empresas').getFullList({ sort: 'name', expand: 'owner' })
}

export async function listContacts() {
  return pb.collection<Contact>('contacts').getFullList({ sort: 'name', expand: 'owner,empresa' })
}

export async function listDeals() {
  return pb.collection<Deal>('deals').getFullList({
    sort: 'position,code',
    expand: 'stage,contact,empresa,owner,campaign',
  })
}

export async function listActivities() {
  return pb.collection<Activity>('activities').getFullList({
    sort: '-created',
    expand: 'contact,deal,author',
  })
}

export async function listUsers() {
  return pb.collection<UserRecord>('users').getFullList({ sort: 'name' })
}

export async function createEmpresa(data: Record<string, unknown>) {
  return pb.collection<Empresa>('empresas').create(data, { expand: 'owner' })
}

export async function updateEmpresa(id: string, data: Record<string, unknown>) {
  return pb.collection<Empresa>('empresas').update(id, data, { expand: 'owner' })
}

export async function deleteEmpresa(id: string) {
  return pb.collection('empresas').delete(id)
}

export async function findOrCreateEmpresaByName(name: string, ownerId?: string): Promise<Empresa> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nome da empresa não pode ser vazio.')
  try {
    return await pb
      .collection<Empresa>('empresas')
      .getFirstListItem(`name ~ "${trimmed}" || name = "${trimmed}"`)
  } catch (_) {
    return await createEmpresa({
      name: trimmed,
      owner: ownerId || pb.authStore.record?.id,
    })
  }
}

export async function createDeal(data: Record<string, unknown>) {
  return pb.collection<Deal>('deals').create(data, { expand: 'stage,contact,empresa,owner' })
}

export async function updateDeal(id: string, data: Record<string, unknown>) {
  return pb.collection<Deal>('deals').update(id, data, { expand: 'stage,contact,empresa,owner' })
}

export async function createContact(data: Record<string, unknown>) {
  return pb.collection<Contact>('contacts').create(data, { expand: 'owner,empresa' })
}

export async function updateContact(id: string, data: Record<string, unknown>) {
  return pb.collection<Contact>('contacts').update(id, data, { expand: 'owner,empresa' })
}

export async function deleteContact(id: string) {
  return pb.collection('contacts').delete(id)
}

// ==========================================
// COMPRAS E FIDELIDADE (CAFÉS ESPECIAIS)
// ==========================================

export async function listPurchases(contactId?: string) {
  const filter = contactId ? `contact = "${contactId}"` : ''
  return pb.collection<Purchase>('purchases').getFullList({
    filter,
    sort: '-purchase_date,-created',
    expand: 'contact,owner',
  })
}

export async function registerPurchase(params: {
  contactId: string
  amount: number
  purchaseDate?: string
  itemsDescription?: string
  notes?: string
}) {
  const ownerId = pb.authStore.record?.id
  const purchaseDate = params.purchaseDate || new Date().toISOString()

  // 1. Criar compra na collection purchases
  const purchase = await pb.collection<Purchase>('purchases').create({
    contact: params.contactId,
    owner: ownerId,
    amount: params.amount,
    purchase_date: purchaseDate,
    items_description: params.itemsDescription || '',
    notes: params.notes || '',
  })

  // 2. Atualizar o contador e data no cliente de forma atômica/persistida
  const contact = await pb.collection<Contact>('contacts').getOne(params.contactId)
  const currentCount = Number(contact.purchase_count || 0)
  const currentTotal = Number(contact.total_spent || 0)

  // Comparar se a nova data é mais recente que a atual
  let latestDate = contact.last_purchase_date
  if (!latestDate || new Date(purchaseDate).getTime() >= new Date(latestDate).getTime()) {
    latestDate = purchaseDate
  }

  const updatedContact = await pb.collection<Contact>('contacts').update(params.contactId, {
    purchase_count: currentCount + 1,
    total_spent: currentTotal + Number(params.amount),
    last_purchase_date: latestDate,
  })

  // 3. Registrar activity de histórico
  try {
    await pb.collection<Activity>('activities').create({
      type: 'sistema',
      content: `Compra de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(params.amount)} registrada${params.itemsDescription ? ` (${params.itemsDescription})` : ''}. Total de compras acumuladas: ${currentCount + 1}.`,
      contact: params.contactId,
      author: ownerId,
    })
  } catch {
    /* intentionally ignored */
  }

  return { purchase, contact: updatedContact }
}

export async function deletePurchase(purchaseId: string, contactId: string) {
  // Remover a compra
  await pb.collection('purchases').delete(purchaseId)

  // Recalcular compras restantes do cliente para manter consistência
  const remaining = await pb.collection<Purchase>('purchases').getFullList({
    filter: `contact = "${contactId}"`,
    sort: '-purchase_date',
  })

  const newCount = remaining.length
  const newTotal = remaining.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  const newLastDate = remaining.length > 0 ? remaining[0].purchase_date : null

  return pb.collection<Contact>('contacts').update(contactId, {
    purchase_count: newCount,
    total_spent: newTotal,
    last_purchase_date: newLastDate,
  })
}

// ==========================================
// GERAÇÃO DE CUPOM DE ANIVERSÁRIO
// ==========================================

export function generateBirthdayCouponCode(prefix = 'CAFE-NIVERSARIO'): string {
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${randomChars}`
}

export async function applyBirthdayCouponToContact(contactId: string, discountPct = 15) {
  const couponCode = generateBirthdayCouponCode()
  const todayIso = new Date().toISOString()
  const ownerId = pb.authStore.record?.id

  // 1. Atualizar o cliente com o cupom gerado e a data
  const contact = await pb.collection<Contact>('contacts').update(contactId, {
    last_coupon_code: couponCode,
    last_coupon_date: todayIso,
  })

  // 2. Registrar no histórico de atividades
  try {
    await pb.collection<Activity>('activities').create({
      type: 'sistema',
      content: `🎉 Cupom de Aniversário gerado: ${couponCode} (${discountPct}% de desconto) atribuído ao cliente.`,
      contact: contactId,
      author: ownerId,
    })
  } catch {
    /* intentionally ignored */
  }

  return { contact, couponCode }
}

// ==========================================
// TRATAR RETOMADA DE RECORRÊNCIA (30+ DIAS)
// ==========================================

export async function markReengagementTreated(contactId: string, notes?: string) {
  const todayIso = new Date().toISOString()
  const ownerId = pb.authStore.record?.id

  const contact = await pb.collection<Contact>('contacts').update(contactId, {
    last_reengagement_date: todayIso,
  })

  try {
    await pb.collection<Activity>('activities').create({
      type: 'sistema',
      content: `☕ Contato de retenção / recorrência realizado: ${notes || 'Contato realizado para apresentar novas safras e incentivar recompra.'}`,
      contact: contactId,
      author: ownerId,
    })
  } catch {
    /* intentionally ignored */
  }

  return contact
}

export async function createActivity(data: Record<string, unknown>) {
  return pb.collection<Activity>('activities').create(data, { expand: 'contact,deal,author' })
}

export async function listEmailTemplates() {
  return pb.collection<EmailTemplate>('email_templates').getFullList({ sort: 'name' })
}

export async function sendCrmEmail(params: {
  to: string
  subject: string
  body: string
  dealId?: string
  contactId?: string
}) {
  return pb.send<{ success: boolean; emailSent: boolean; warning?: string; activityId: string }>(
    '/backend/v1/crm/send-email',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  )
}

export async function leadAiAction(params: {
  dealId: string
  action: 'summary' | 'next_step' | 'classify_temperature' | 'draft_followup'
}) {
  return pb.send<{
    summary?: string
    nextStep?: string
    temperature?: 'quente' | 'morno' | 'frio'
    justification?: string
    subject?: string
    body?: string
  }>('/backend/v1/crm/lead-ai', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function listCaptureForms() {
  return pb.collection<CaptureForm>('capture_forms').getFullList({ sort: 'created' })
}

export async function getCaptureForm(idOrName?: string) {
  if (idOrName) {
    try {
      return await pb.collection<CaptureForm>('capture_forms').getOne(idOrName)
    } catch {
      return await pb
        .collection<CaptureForm>('capture_forms')
        .getFirstListItem(`name = "${idOrName}"`)
    }
  }
  const list = await pb.collection<CaptureForm>('capture_forms').getList(1, 1, { sort: 'created' })
  return list.items[0] || null
}

export async function updateCaptureForm(id: string, data: FormData | Record<string, unknown>) {
  return pb.collection<CaptureForm>('capture_forms').update(id, data)
}

export async function createCaptureForm(data: FormData | Record<string, unknown>) {
  if (data instanceof FormData) {
    if (!data.has('owner') && pb.authStore.record?.id) {
      data.set('owner', pb.authStore.record.id)
    }
    return pb.collection<CaptureForm>('capture_forms').create(data)
  }
  return pb.collection<CaptureForm>('capture_forms').create({
    owner: pb.authStore.record?.id,
    ...data,
  })
}

export async function listCampaigns() {
  return pb.collection<Campaign>('campaigns').getFullList({
    sort: '-created',
    expand: 'form',
  })
}

export async function getCampaign(id: string) {
  return pb.collection<Campaign>('campaigns').getOne(id, {
    expand: 'form',
  })
}

export async function createCampaign(data: {
  name: string
  description?: string
  form?: string
  status?: 'ativa' | 'pausada' | 'encerrada'
  owner?: string
}) {
  return pb.collection<Campaign>('campaigns').create(
    {
      status: 'ativa',
      owner: pb.authStore.record?.id,
      ...data,
    },
    {
      expand: 'form',
    },
  )
}

export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string
    description?: string
    form?: string
    status?: 'ativa' | 'pausada' | 'encerrada'
  }>,
) {
  return pb.collection<Campaign>('campaigns').update(id, data, {
    expand: 'form',
  })
}

export async function deleteCampaign(id: string) {
  return pb.collection('campaigns').delete(id)
}

export async function listCustomMetrics() {
  return pb.collection<CustomMetric>('custom_metrics').getFullList({
    sort: 'order,created',
    expand: 'stage',
  })
}

export async function createCustomMetric(data: {
  name: string
  aggregation: CustomMetric['aggregation']
  stage?: string
  status?: CustomMetric['status']
  order?: number
  owner?: string
}) {
  return pb.collection<CustomMetric>('custom_metrics').create(
    {
      owner: pb.authStore.record?.id,
      ...data,
    },
    {
      expand: 'stage',
    },
  )
}

export async function updateCustomMetric(
  id: string,
  data: Partial<{
    name: string
    aggregation: CustomMetric['aggregation']
    stage?: string
    status?: CustomMetric['status']
    order?: number
  }>,
) {
  return pb.collection<CustomMetric>('custom_metrics').update(id, data, {
    expand: 'stage',
  })
}

export async function deleteCustomMetric(id: string) {
  return pb.collection('custom_metrics').delete(id)
}

export async function reorderCustomMetrics(orderedIds: string[]) {
  return Promise.all(
    orderedIds.map((id, index) => pb.collection('custom_metrics').update(id, { order: index + 1 })),
  )
}

export async function captureLeadPublic(params: {
  name: string
  email: string
  phone?: string
  company?: string
  position?: string
  message?: string
  website?: string
  form_id?: string
  campaign_id?: string
  custom_fields?: Record<string, string | number | boolean>
}) {
  return pb.send<{
    success: boolean
    message: string
    deal?: { id: string; code: string; title: string }
    contact?: { id: string; name: string; email: string }
    emails?: {
      leadEmailSent: boolean
      teamEmailSent: boolean
    }
  }>('/backend/v1/public/capture', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}
