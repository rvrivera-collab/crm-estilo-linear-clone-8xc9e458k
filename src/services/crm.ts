import pb from '@/lib/pocketbase/client'
import { buildLoyaltyProgressMessage, getLoyaltyLevel } from '@/types/crm'
import { isOrderDelivered } from '@/lib/order-shipping'
import type {
  Activity,
  Campaign,
  CaptureForm,
  Contact,
  CustomMetric,
  Deal,
  EmailTemplate,
  AgendaEvent,
  AgendaEventType,
  Empresa,
  JourneyEvent,
  LoyaltyLevelInfo,
  Order,
  OrderStage,
  Purchase,
  Referral,
  ReferralStatus,
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
    sendMethod?: 'api' | 'link' | 'none'
    usedPhoneNumberId?: string | null
    usedWabaId?: string | null
    wabaSource?: string
    warning?: string | null
    metaErrorDetail?: string | null
    journeyEventId?: string
    cleanedPhone?: string
    waFallbackUrl?: string | null
    message: string
  }>('/backend/v1/crm/send-whatsapp', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ===== Configurações do WhatsApp (aba Configurações) =====

export interface CrmWhatsAppSettings {
  id: string
  waba_id: string
  loyalty_progress_disabled?: boolean
  updated?: string
}

/** Resultado do envio automático da mensagem de progresso de fidelidade */
export interface LoyaltyProgressResult {
  /** 'disabled' = opção desligada nas Configurações; 'no-phone' = cliente sem WhatsApp */
  skipped?: 'disabled' | 'no-phone'
  attempted: boolean
  whatsappSent?: boolean
  sendMethod?: 'api' | 'link' | 'none'
  waFallbackUrl?: string | null
  warning?: string | null
  message?: string
}

/** A mensagem automática de progresso está ligada? (padrão: ligada) */
export async function isLoyaltyProgressEnabled(): Promise<boolean> {
  try {
    const settings = await getWhatsAppSettings()
    return !settings?.loyalty_progress_disabled
  } catch {
    return true
  }
}

// Busca o WABA ID manual salvo pelo próprio usuário (crm_settings, 1 registro por dono)
export async function getWhatsAppSettings() {
  const ownerId = pb.authStore.record?.id
  if (!ownerId) return null
  try {
    const record = await pb
      .collection<CrmWhatsAppSettings>('crm_settings')
      .getFirstListItem(`owner = "${ownerId}"`)
    return record
  } catch {
    return null
  }
}

// Salva (cria ou atualiza) o registro único de configurações do usuário.
// waba_id vazio limpa o valor e volta à descoberta automática pelo conector.
export async function saveWhatsAppSettings(
  wabaId: string,
  extra?: { loyaltyProgressDisabled?: boolean },
) {
  const ownerId = pb.authStore.record?.id
  if (!ownerId) throw new Error('Usuário não autenticado.')
  const clean = wabaId.replace(/\D/g, '')
  const existing = await getWhatsAppSettings()
  if (existing) {
    return pb.collection<CrmWhatsAppSettings>('crm_settings').update(existing.id, {
      waba_id: clean,
      ...(extra && extra.loyaltyProgressDisabled !== undefined
        ? { loyalty_progress_disabled: extra.loyaltyProgressDisabled }
        : {}),
    })
  }
  return pb.collection<CrmWhatsAppSettings>('crm_settings').create({
    owner: ownerId,
    waba_id: clean,
    loyalty_progress_disabled: extra?.loyaltyProgressDisabled ?? false,
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
// PROGRAMA DE INDICAÇÃO (REFERRALS)
// ==========================================

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  indicado: 'Indicado',
  primeiro_contato: 'Primeiro contato',
  primeira_compra: 'Primeira compra (Convertido)',
  cancelado: 'Cancelado',
}

export function generateReferralCodeForContact(contact: { name: string }): string {
  const cleanName = contact.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 4)
    .toUpperCase()
  const prefix = (cleanName.length >= 2 ? cleanName : 'CAFE').padEnd(4, 'X')
  const randomNum = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${randomNum}`
}

export function generateRewardCouponCode(prefix = 'INDICOU'): string {
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${randomChars}`
}

/**
 * Mensagem pré-pronta Disney para o cliente compartilhar com amigos via WhatsApp
 */
export function buildReferralShareWhatsAppMessage(contact: Contact): string {
  const displayName = contact.nickname?.trim() || contact.name.trim().split(' ')[0]
  const code = contact.referral_code || generateReferralCodeForContact(contact)
  const favorite = contact.favorite_coffee ? ` (eu adoro o ${contact.favorite_coffee}!)` : ''

  return `Olá! ☕✨ Aqui é o(a) ${displayName}!

Queria te convidar para conhecer a cafeteria de cafés especiais que eu mais amo no mundo${favorite}. Cada lote tem um aroma e cuidado artesanal inesquecíveis, com um acolhimento no padrão Disney!

🎁 Use o meu código de indicação *${code}* e ganhe *15% OFF* no seu primeiro pedido ou xícara especial:
👉 Peça pelo nosso WhatsApp ou visite a gente informando o código!

Espero que você se apaixone como eu me apaixonei! Um abraço carinhoso!`
}

/**
 * Mensagem pré-pronta Disney para parabenizar o indicador quando a indicação realiza a primeira compra
 */
export function buildReferralRewardCongratulationWhatsAppMessage(params: {
  referrer: Contact
  referredName: string
  couponCode: string
  discountPct?: number
}): string {
  const { referrer, referredName, couponCode, discountPct = 20 } = params
  const displayName = referrer.nickname?.trim() || referrer.name.trim().split(' ')[0]

  return `Que alegria imensa, ${displayName}! 🌟☕✨

Seu(sua) amigo(a) *${referredName}* acabou de entrar para o nosso mundo de cafés especiais e realizou a sua primeira compra com o seu código de indicação!

Para nós, não há demonstração maior de carinho e confiança do que ver a nossa casa sendo recomendada por quem tanto admiramos. Cada xícara compartilhada espalha afeto e boas histórias!

🎁 Como nossa forma de agradecimento e retribuição no estilo Disney, preparamos um presente exclusivo para você:
🎟️ Seu cupom de recompensa: *${couponCode}* (*${discountPct}% de desconto especial* na sua próxima visita ou pedido de microlote).

Muito obrigado por fazer parte da nossa família de café! Esperamos você muito em breve para um brinde com café fresquinho! 💛☕`
}

export async function ensureContactReferralCode(contact: Contact): Promise<Contact> {
  if (contact.referral_code) return contact
  const newCode = generateReferralCodeForContact(contact)
  return pb.collection<Contact>('contacts').update(contact.id, { referral_code: newCode })
}

export async function listReferrals(referrerId?: string) {
  const filter = referrerId ? `referrer = "${referrerId}"` : ''
  return pb.collection<Referral>('referrals').getFullList({
    filter,
    sort: '-created',
    expand: 'referrer,owner,contact_converted',
  })
}

export async function createReferral(data: {
  referrerId: string
  referred_name: string
  referred_phone?: string
  referred_email?: string
  status?: ReferralStatus
  notes?: string
}) {
  const ownerId = pb.authStore.record?.id
  const status = data.status || 'indicado'
  const newRef = await pb.collection<Referral>('referrals').create(
    {
      referrer: data.referrerId,
      owner: ownerId,
      referred_name: data.referred_name.trim(),
      referred_phone: data.referred_phone?.trim() || '',
      referred_email: data.referred_email?.trim() || '',
      status,
      notes: data.notes?.trim() || '',
    },
    { expand: 'referrer,owner' },
  )

  // Registrar evento na linha do tempo Disney do indicador
  try {
    const referrer = await pb.collection<Contact>('contacts').getOne(data.referrerId)
    await pb.collection('journey_events').create({
      contact: data.referrerId,
      owner: ownerId,
      type: 'indicacao_feita',
      title: `🤝 Indicação Realizada: ${data.referred_name}`,
      description: `${referrer.name} indicou um amigo para a cafeteria (${data.referred_name}${data.referred_phone ? ` - ${data.referred_phone}` : ''}). Estágio inicial: ${REFERRAL_STATUS_LABELS[status]}.`,
      channel: 'indicacoes',
      metadata: { referralId: newRef.id, referredName: data.referred_name, status },
    })
  } catch {
    /* intentionally ignored */
  }

  return newRef
}

export async function updateReferral(
  id: string,
  data: Partial<Referral> & { triggerRewardIfConverted?: boolean },
) {
  const previous = await pb
    .collection<Referral>('referrals')
    .getOne(id)
    .catch(() => null)
  const updated = await pb.collection<Referral>('referrals').update(id, data, {
    expand: 'referrer,owner,contact_converted',
  })

  // Se avançou para primeira_compra e antes não era
  if (data.status === 'primeira_compra' && previous && previous.status !== 'primeira_compra') {
    const ownerId = pb.authStore.record?.id
    let coupon = updated.reward_coupon
    if (!coupon) {
      coupon = generateRewardCouponCode()
      await pb.collection('referrals').update(id, {
        reward_coupon: coupon,
        converted_at: new Date().toISOString(),
      })
      updated.reward_coupon = coupon
      updated.converted_at = new Date().toISOString()
    }

    // Atualizar último cupom do cliente indicador
    try {
      await pb.collection<Contact>('contacts').update(updated.referrer, {
        last_coupon_code: coupon,
        last_coupon_date: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }

    // Registrar evento de recompensa de indicação na linha do tempo Disney do cliente
    try {
      await pb.collection('journey_events').create({
        contact: updated.referrer,
        owner: ownerId,
        type: 'recompensa_indicacao',
        title: `🎁 Recompensa de Indicação Conquistada! Cupom: ${coupon}`,
        description: `A indicação de ${updated.referred_name} foi convertida com sucesso (primeira compra)! Cupom de recompensa ${coupon} gerado para o cliente indicador.`,
        channel: 'indicacoes',
        metadata: {
          referralId: updated.id,
          referredName: updated.referred_name,
          rewardCoupon: coupon,
        },
      })
    } catch {
      /* intentionally ignored */
    }
  }

  return updated
}

export async function deleteReferral(id: string) {
  return pb.collection('referrals').delete(id)
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
      // Data do envio: registrada no momento em que o rastreio entra no pedido
      ...(data.tracking_code?.trim() ? { shipped_at: new Date().toISOString() } : {}),
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
      const res = await registerPurchase({
        contactId: data.contactId,
        amount: data.value,
        itemsDescription: data.items_description || data.title,
        notes: `Gerado a partir do pedido: ${data.title}`,
      })
      // Propaga o resultado do disparo automático de progresso de fidelidade para a UI
      return Object.assign(newOrder, { loyaltyProgress: res.loyaltyProgress })
    } catch {
      /* intentionally ignored */
    }
  }

  return newOrder
}

/** Dispara manualmente a mensagem de progresso de fidelidade (usado quando o automático ficou pendente) */
export async function resendLoyaltyProgress(contactId: string) {
  const contact = await pb.collection<Contact>('contacts').getOne(contactId)
  const count = Number(contact.purchase_count || 0)
  if (count <= 0) throw new Error('Cliente ainda não tem compras registradas.')
  const message = buildLoyaltyProgressMessage({
    contact,
    purchaseCount: count,
    leveledUp: false,
  })
  return sendDisneyWhatsApp({
    contactId,
    message,
    momentType: 'personalizado',
    title: '☕ Progresso no Clube de Fidelidade',
  })
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
  // Rastreio adicionado agora (antes estava vazio): grava a data do envio
  const addingTracking = !!data.tracking_code?.trim() && !previous?.tracking_code?.trim()
  // Entrou agora no estágio "Pedido recebido" (vindo de antes dele): grava a data do recebimento
  const movingToReceived =
    data.stage === 'pedido_recebido' && !!previous && !isOrderDelivered(previous.stage)
  let payload: Partial<Order> =
    addingTracking && !data.shipped_at ? { ...data, shipped_at: new Date().toISOString() } : data
  if (movingToReceived && !previous?.received_at && !payload.received_at) {
    payload = { ...payload, received_at: new Date().toISOString() }
  }
  const updated = await pb
    .collection<Order>('orders')
    .update(id, payload, { expand: 'contact,owner' })

  const ownerId = pb.authStore.record?.id

  // Se o estágio mudou, registrar evento na jornada
  if (data.stage && previous && previous.stage !== data.stage) {
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
  } else if (
    previous &&
    (data.title !== undefined ||
      data.value !== undefined ||
      data.items_description !== undefined ||
      data.tracking_code !== undefined)
  ) {
    // Registro de atualização das informações do pedido na jornada
    try {
      const changedSummary: string[] = []
      if (data.title && data.title !== previous.title) {
        changedSummary.push(`Título: "${data.title}"`)
      }
      if (data.value !== undefined && Number(data.value) !== Number(previous.value)) {
        changedSummary.push(
          `Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(data.value) || 0)}`,
        )
      }
      if (data.tracking_code && data.tracking_code !== previous.tracking_code) {
        changedSummary.push(`Rastreio: ${data.tracking_code}`)
      }
      if (changedSummary.length > 0) {
        await pb.collection('journey_events').create({
          contact: updated.contact,
          owner: ownerId,
          type: 'pedido_criado',
          title: `✏️ Pedido Atualizado: ${updated.title}`,
          description: `Detalhes do pedido ajustados (${changedSummary.join(', ')}).`,
          channel: 'pedidos',
          metadata: { orderId: updated.id, changes: changedSummary },
        })
      }
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

  // 5. Verificar se atingiu marco de novo nível de fidelidade (threshold por contagem de compras)
  // Níveis oficiais: 10 níveis, um a cada 10 compras (0-9 = sem nível). Importado de types/crm.
  const previousLevel = getLoyaltyLevel(currentCount).level
  const newLevel = getLoyaltyLevel(currentCount + 1).level
  const leveledUp = newLevel > previousLevel
  if (leveledUp) {
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

  // 6. Mensagem AUTOMÁTICA de progresso de fidelidade via WhatsApp (respeita o toggle em Configurações;
  //    usa exatamente o mesmo pipeline do hook crm_send_whatsapp — API oficial com fallback wa.me)
  let loyaltyProgress: LoyaltyProgressResult = { attempted: false }
  if (await isLoyaltyProgressEnabled()) {
    const phoneDigits = (updatedContact.phone || '').replace(/\D/g, '')
    if (!phoneDigits) {
      // Cliente sem WhatsApp cadastrado: a compra segue normalmente, sem tentativa de envio
      loyaltyProgress = { attempted: false, skipped: 'no-phone' }
    } else {
      try {
        const message = buildLoyaltyProgressMessage({
          contact: updatedContact,
          purchaseCount: currentCount + 1,
          leveledUp,
          newLevel: leveledUp ? newLevel : undefined,
        })
        const sendRes = await sendDisneyWhatsApp({
          contactId: params.contactId,
          message,
          momentType: leveledUp ? 'nivel_fidelidade' : 'personalizado',
          title: leveledUp
            ? '⭐ Parabéns por Novo Nível de Fidelidade'
            : '☕ Progresso no Clube de Fidelidade',
        })
        if (sendRes.phoneMissing) {
          // Número ausente/inválido no cadastro: tratado como "sem WhatsApp"
          loyaltyProgress = { attempted: false, skipped: 'no-phone' }
        } else {
          loyaltyProgress = {
            attempted: true,
            whatsappSent: sendRes.whatsappSent,
            sendMethod: sendRes.sendMethod,
            waFallbackUrl: sendRes.waFallbackUrl || null,
            warning: sendRes.warning || sendRes.metaErrorDetail || null,
            message,
          }
        }
      } catch {
        // Falhou a comunicação com o hook: registra como pendente, sem bloquear a compra
        loyaltyProgress = {
          attempted: true,
          whatsappSent: false,
          sendMethod: 'link',
          warning: 'Não foi possível disparar automaticamente — mensagem registrada como pendente.',
        }
      }
    }
  } else {
    loyaltyProgress = { attempted: false, skipped: 'disabled' }
  }

  return { purchase, contact: updatedContact, loyaltyProgress }
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

/**
 * Recalcula purchase_count, total_spent e last_purchase_date de um contato
 * com base nos registros reais da collection purchases (e fallback de last_purchase_date se fornecido)
 */
export async function recalculateContactPurchases(
  contactId: string,
  fallbackLastPurchaseDate?: string | null,
) {
  const allContactPurchases = await pb.collection<Purchase>('purchases').getFullList({
    filter: `contact = "${contactId}"`,
    sort: '-purchase_date',
  })

  const count = allContactPurchases.length
  const total = allContactPurchases.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)

  let latestDate: string | null =
    allContactPurchases.length > 0 ? allContactPurchases[0].purchase_date : null
  if (fallbackLastPurchaseDate) {
    if (
      !latestDate ||
      new Date(fallbackLastPurchaseDate).getTime() > new Date(latestDate).getTime()
    ) {
      latestDate = fallbackLastPurchaseDate
    }
  }

  return pb.collection<Contact>('contacts').update(contactId, {
    purchase_count: count,
    total_spent: total,
    last_purchase_date: latestDate,
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

// ==========================================
// AGENDA E EVENTOS (CALENDÁRIO LINEAR)
// ==========================================

export const AGENDA_TYPE_LABELS: Record<AgendaEventType, string> = {
  follow_up: 'Ligação de follow-up',
  reuniao_degustacao: 'Reunião ou degustação',
  entrega: 'Entrega',
  lembrete_pessoal: 'Lembrete pessoal',
  outro: 'Outro',
}

export const AGENDA_TYPE_COLORS: Record<
  AgendaEventType,
  { bg: string; text: string; border: string; dot: string }
> = {
  follow_up: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  reuniao_degustacao: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-600',
  },
  entrega: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-600',
  },
  lembrete_pessoal: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-600',
  },
  outro: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
}

export async function listAgendaEvents(filterStr?: string): Promise<AgendaEvent[]> {
  return pb.collection<AgendaEvent>('agenda_events').getFullList({
    filter: filterStr || '',
    sort: 'date,time,created',
    expand: 'customer,owner',
  })
}

export async function createAgendaEvent(data: {
  title: string
  date: string
  time?: string
  type: AgendaEventType
  customer?: string
  notes?: string
  done?: boolean
}): Promise<AgendaEvent> {
  const ownerId = pb.authStore.record?.id
  const dateFormatted = data.date.includes('T') ? data.date : `${data.date} 12:00:00.000Z`
  const newEvent = await pb.collection<AgendaEvent>('agenda_events').create(
    {
      title: data.title.trim(),
      date: dateFormatted,
      time: data.time || '',
      type: data.type,
      customer: data.customer || null,
      owner: ownerId || null,
      notes: data.notes || '',
      done: Boolean(data.done),
    },
    { expand: 'customer,owner' },
  )

  // Se o evento foi vinculado a um cliente, registrar na Linha do Tempo Disney
  if (data.customer) {
    try {
      const typeLabel = AGENDA_TYPE_LABELS[data.type] || data.type
      await pb.collection('journey_events').create({
        contact: data.customer,
        owner: ownerId,
        type: 'agenda_criada',
        title: `📅 Agendamento Criado: ${data.title}`,
        description: `Compromisso (${typeLabel}) agendado para ${data.date}${data.time ? ` às ${data.time}` : ''}.${data.notes ? ` Notas: ${data.notes}` : ''}`,
        channel: 'agenda',
        metadata: {
          agendaEventId: newEvent.id,
          date: data.date,
          time: data.time,
          type: data.type,
        },
      })
    } catch {
      /* intentionally ignored */
    }
  }

  return newEvent
}

export async function updateAgendaEvent(
  id: string,
  data: Partial<{
    title: string
    date: string
    time: string
    type: AgendaEventType
    customer: string | null
    notes: string
    done: boolean
  }>,
): Promise<AgendaEvent> {
  const previous = await pb
    .collection<AgendaEvent>('agenda_events')
    .getOne(id)
    .catch(() => null)

  const payload: Record<string, unknown> = { ...data }
  if (data.date && !data.date.includes('T')) {
    payload.date = `${data.date} 12:00:00.000Z`
  }

  const updated = await pb.collection<AgendaEvent>('agenda_events').update(id, payload, {
    expand: 'customer,owner',
  })

  // Se foi marcado como concluído e antes não era, e está vinculado a um cliente, registrar na jornada Disney
  if (data.done === true && previous && !previous.done && updated.customer) {
    const ownerId = pb.authStore.record?.id
    try {
      await pb.collection('journey_events').create({
        contact: updated.customer,
        owner: ownerId,
        type: 'agenda_concluida',
        title: `✅ Compromisso Concluído: ${updated.title}`,
        description: `Compromisso realizado com sucesso.${updated.notes ? ` Notas: ${updated.notes}` : ''}`,
        channel: 'agenda',
        metadata: {
          agendaEventId: updated.id,
          date: updated.date,
          time: updated.time,
          type: updated.type,
        },
      })
    } catch {
      /* intentionally ignored */
    }
  }

  return updated
}

export async function deleteAgendaEvent(id: string): Promise<boolean> {
  return pb.collection('agenda_events').delete(id)
}
