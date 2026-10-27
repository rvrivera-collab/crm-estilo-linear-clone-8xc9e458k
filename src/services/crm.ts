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
  JourneyEvent,
  Order,
  OrderStage,
  Purchase,
  Stage,
  UserRecord,
} from '@/types/crm'

export async function listJourneyEvents(contactId?: string) {
  const filter = contactId ? `contact = "${contactId}"` : ''
  return pb.collection<JourneyEvent>('journey_events').getFullList({
    filter,
    sort: '-created',
    expand: 'contact,owner',
  })
}

export async function createJourneyEvent(data: {
  contactId: string
  type: JourneyEvent['type']
  title: string
  description?: string
  channel?: string
  metadata?: Record<string, unknown>
}) {
  const ownerId = pb.authStore.record?.id
  return pb.collection<JourneyEvent>('journey_events').create({
    contact: data.contactId,
    owner: ownerId,
    type: data.type,
    title: data.title,
    description: data.description || '',
    channel: data.channel || 'crm',
    metadata: data.metadata || {},
  })
}

export async function sendDisneyWhatsApp(params: {
  contactId: string
  message: string
  phone?: string
  momentType?: 'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  title?: string
}) {
  return pb.send<{
    success: boolean
    whatsappSent: boolean
    phoneMissing: boolean
    warning?: string | null
    journeyEventId?: string
    cleanedPhone?: string
    waFallbackUrl?: string | null
    message: string
  }>('/backend/v1/crm/send-whatsapp', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

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
  const newContact = await pb
    .collection<Contact>('contacts')
    .create(data, { expand: 'owner,empresa' })
  const ownerId = pb.authStore.record?.id || (data.owner as string)
  // Registrar evento inicial de boas-vindas na Linha do Tempo
  try {
    await pb.collection('journey_events').create({
      contact: newContact.id,
      owner: ownerId,
      type: 'cadastro',
      title: 'Boas-vindas à Cafeteria',
      description: `Cliente ${newContact.name} cadastrado na base. Início da jornada com atendimento personalizado e atenção aos detalhes.`,
      channel: (data.acquisition_channel as string) || 'presencial',
    })
  } catch {
    /* intentionally ignored */
  }
  return newContact
}

export async function updateContact(id: string, data: Record<string, unknown>) {
  return pb.collection<Contact>('contacts').update(id, data, { expand: 'owner,empresa' })
}

export async function deleteContact(id: string) {
  return pb.collection('contacts').delete(id)
}

// ==========================================
// FUNIL DE PEDIDOS (ORDERS / NEGOCIAÇÃO)
// ==========================================

export async function listOrders(contactId?: string) {
  const filter = contactId ? `contact = "${contactId}"` : ''
  return pb.collection<Order>('orders').getFullList({
    filter,
    sort: 'position,created',
    expand: 'contact,owner',
  })
}

export async function createOrder(data: {
  contactId: string
  title: string
  items_description?: string
  value?: number
  stage?: OrderStage
  tracking_code?: string
  notes?: string
  registerPurchaseRecord?: boolean
}) {
  const ownerId = pb.authStore.record?.id
  const stage = data.stage || 'pedido_feito'
  const newOrder = await pb.collection<Order>('orders').create(
    {
      contact: data.contactId,
      owner: ownerId,
      title: data.title,
      items_description: data.items_description || '',
      value: data.value || 0,
      stage,
      tracking_code: data.tracking_code || '',
      google_review_requested: false,
      notes: data.notes || '',
      position: 1,
    },
    { expand: 'contact,owner' },
  )

  // Registrar na Linha do Tempo da Jornada
  try {
    await pb.collection('journey_events').create({
      contact: data.contactId,
      owner: ownerId,
      type: 'pedido_criado',
      title: `🛍️ Pedido Feito: ${data.title}`,
      description: `Novo pedido registrado no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.value || 0)}.${data.items_description ? ` Itens: ${data.items_description}` : ''}`,
      channel: 'pedidos',
      metadata: { orderId: newOrder.id, value: data.value, stage },
    })
  } catch {
    /* intentionally ignored */
  }

  // Se solicitado, registrar também como compra/fidelidade do cliente
  if (data.registerPurchaseRecord && data.value && data.value > 0) {
    try {
      await registerPurchase({
        contactId: data.contactId,
        amount: data.value,
        itemsDescription: data.items_description || data.title,
        notes: `Gerado a partir do pedido: ${data.title}`,
      })
    } catch {
      /* intentionally ignored */
    }
  }

  return newOrder
}

export const ORDER_STAGE_LABELS: Record<OrderStage, string> = {
  pedido_feito: 'Pedido feito',
  pedido_enviado: 'Pedido enviado',
  pedido_recebido: 'Pedido recebido',
  pedir_avaliacao_google: 'Pedir avaliação do Google',
  concluido: 'Concluído',
}

export async function updateOrder(id: string, data: Partial<Order>) {
  const previous = await pb
    .collection<Order>('orders')
    .getOne(id)
    .catch(() => null)
  const updated = await pb.collection<Order>('orders').update(id, data, { expand: 'contact,owner' })

  // Se o estágio mudou, registrar evento na jornada
  if (data.stage && previous && previous.stage !== data.stage) {
    const ownerId = pb.authStore.record?.id
    const prevLabel = ORDER_STAGE_LABELS[previous.stage] || previous.stage
    const nextLabel = ORDER_STAGE_LABELS[data.stage] || data.stage

    try {
      await pb.collection('journey_events').create({
        contact: updated.contact,
        owner: ownerId,
        type: 'pedido_movido',
        title: `📦 Pedido Movido: ${nextLabel}`,
        description: `O pedido "${updated.title}" avançou de "${prevLabel}" para "${nextLabel}".`,
        channel: 'pedidos',
        metadata: { orderId: updated.id, fromStage: previous.stage, toStage: data.stage },
      })
    } catch {
      /* intentionally ignored */
    }
  }

  return updated
}

export async function markGoogleReviewRequested(orderId: string, notes?: string) {
  const todayIso = new Date().toISOString()
  const ownerId = pb.authStore.record?.id
  const updated = await pb.collection<Order>('orders').update(
    orderId,
    {
      google_review_requested: true,
      google_review_date: todayIso,
    },
    { expand: 'contact,owner' },
  )

  try {
    await pb.collection('journey_events').create({
      contact: updated.contact,
      owner: ownerId,
      type: 'avaliacao_google_solicitada',
      title: '🌟 Solicitação de Avaliação no Google Enviada',
      description:
        notes ||
        `Mensagem carinhosa com link de avaliação do Google enviada após recebimento do pedido "${updated.title}".`,
      channel: 'whatsapp',
      metadata: { orderId: updated.id },
    })
  } catch {
    /* intentionally ignored */
  }

  return updated
}

export async function deleteOrder(id: string) {
  return pb.collection('orders').delete(id)
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

  // 3. Registrar activity de histórico e evento de jornada
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

  // 4. Registrar na Linha do Tempo da Jornada (journey_events)
  try {
    await pb.collection('journey_events').create({
      contact: params.contactId,
      owner: ownerId,
      type: 'compra',
      title: `Nova Compra Registrada (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(params.amount)})`,
      description: `${params.itemsDescription ? `Itens: ${params.itemsDescription}. ` : ''}Total acumulado: ${currentCount + 1} compras.`,
      channel: 'loja',
      metadata: {
        amount: params.amount,
        itemsDescription: params.itemsDescription,
        purchaseCount: currentCount + 1,
      },
    })
  } catch {
    /* intentionally ignored */
  }

  // 5. Verificar se atingiu marco de novo nível de fidelidade (múltiplo de 10)
  const previousLevel = Math.floor(currentCount / 10) + 1
  const newLevel = Math.floor((currentCount + 1) / 10) + 1
  if (newLevel > previousLevel) {
    try {
      await pb.collection('journey_events').create({
        contact: params.contactId,
        owner: ownerId,
        type: 'nivel_alcancado',
        title: `⭐ Avanço de Nível de Fidelidade: Nível ${newLevel}`,
        description: `O cliente conquistou um novo patamar no Clube de Fidelidade Disney ao atingir ${currentCount + 1} compras!`,
        channel: 'clube',
        metadata: { newLevel, previousLevel },
      })
    } catch {
      /* intentionally ignored */
    }
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

  // 2. Registrar no histórico de atividades e na jornada
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

  try {
    await pb.collection('journey_events').create({
      contact: contactId,
      owner: ownerId,
      type: 'cupom_aniversario',
      title: `🎁 Cupom de Encantamento: ${couponCode}`,
      description: `Presente de ${discountPct}% OFF gerado para celebrar o aniversário.`,
      channel: 'crm',
      metadata: { couponCode, discountPct },
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

  try {
    await pb.collection('journey_events').create({
      contact: contactId,
      owner: ownerId,
      type: 'reengajamento',
      title: '☕ Contato de Reengajamento & Retomada Realizado',
      description: notes || 'Contato realizado para apresentar novas safras e acolher o cliente.',
      channel: 'crm',
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
