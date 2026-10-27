import assert from 'node:assert/strict'
import PocketBase from 'pocketbase'

const backendUrl = process.env.VITE_POCKETBASE_URL
if (!backendUrl) {
  console.log('Integração Skip Cloud ignorada: VITE_POCKETBASE_URL não está disponível.')
  process.exit(0)
}

const pb = new PocketBase(backendUrl)
pb.autoCancellation(false)
const cleanup = []
let dealToRestore = null
let unsubscribe = null

function parseAgentEvents(payload) {
  return payload
    .replaceAll('\r\n', '\n')
    .split('\n\n')
    .flatMap((block) => {
      let event = 'message'
      const data = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
      }
      if (!data.length) return []
      try {
        return [{ event, data: JSON.parse(data.join('\n')) }]
      } catch {
        return []
      }
    })
}

try {
  const auth = await pb.collection('users').authWithPassword('teste@direto.app', 'Direto@2026')
  assert.equal(auth.record.name, 'Adapta')
  assert.equal(auth.record.role, 'admin')

  const [stages, contacts, deals, activities] = await Promise.all([
    pb.collection('pipeline_stages').getFullList({ sort: 'order' }),
    pb.collection('contacts').getFullList({ sort: 'name', expand: 'owner' }),
    pb.collection('deals').getFullList({ sort: 'code', expand: 'stage,contact,owner' }),
    pb.collection('activities').getFullList({ sort: '-created', expand: 'author' }),
  ])
  assert.equal(stages.length, 5)
  assert.ok(contacts.length >= 6)
  assert.ok(deals.length >= 8)
  assert.ok(activities.length >= 4)
  assert.equal(deals.filter((deal) => deal.status === 'aberto').length, 6)
  assert.equal(
    deals.filter((deal) => deal.status === 'aberto').reduce((sum, deal) => sum + deal.value, 0),
    354000,
  )

  const suffix = `${Date.now()}`
  const createdContact = await pb.collection('contacts').create({
    name: 'Contato QA Integração',
    email: `qa.${suffix}@adapta.org`,
    phone: '+55 11 90000-0000',
    company: 'Adapta QA',
    position: 'Validação',
    status: 'lead',
    owner: auth.record.id,
    notes: 'Registro temporário do teste de integração.',
  })
  cleanup.push(() => pb.collection('contacts').delete(createdContact.id))
  const updatedContact = await pb
    .collection('contacts')
    .update(createdContact.id, { status: 'ativo', position: 'Validação completa' })
  assert.equal(updatedContact.status, 'ativo')

  const createdDeal = await pb.collection('deals').create({
    code: `NEG-${suffix.slice(-9)}`,
    title: 'Negócio QA Integração',
    value: 12345,
    stage: stages[0].id,
    status: 'aberto',
    contact: createdContact.id,
    owner: auth.record.id,
    expected_close: '2026-12-18 18:00:00.000Z',
    position: 999,
  })
  cleanup.unshift(() => pb.collection('deals').delete(createdDeal.id))
  const updatedDeal = await pb.collection('deals').update(createdDeal.id, {
    stage: stages[1].id,
    value: 23456,
  })
  assert.equal(updatedDeal.stage, stages[1].id)
  assert.equal(updatedDeal.value, 23456)

  const createdActivity = await pb.collection('activities').create({
    type: 'nota',
    content: 'Atividade temporária do teste de integração.',
    contact: createdContact.id,
    deal: createdDeal.id,
    author: auth.record.id,
  })
  cleanup.unshift(() => pb.collection('activities').delete(createdActivity.id))
  assert.equal(createdActivity.type, 'nota')

  const seededDeal = deals.find((deal) => deal.code === 'NEG-1003')
  assert.ok(seededDeal)
  dealToRestore = { id: seededDeal.id, stage: seededDeal.stage, status: seededDeal.status }
  const negotiation = stages.find((stage) => stage.name === 'Negociação')
  assert.ok(negotiation)
  const realtimeEvent = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Evento realtime de deals não recebido.')),
      10000,
    )
    pb.collection('deals')
      .subscribe(seededDeal.id, (event) => {
        if (event.action === 'update' && event.record.stage === negotiation.id) {
          clearTimeout(timer)
          resolve(event)
        }
      })
      .then((stop) => {
        unsubscribe = stop
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
  while (!unsubscribe) await new Promise((resolve) => setTimeout(resolve, 25))
  await pb.collection('deals').update(seededDeal.id, { stage: negotiation.id })
  await realtimeEvent
  await pb.collection('deals').update(seededDeal.id, {
    stage: dealToRestore.stage,
    status: dealToRestore.status,
  })
  dealToRestore = null
  await unsubscribe()
  unsubscribe = null

  const response = await fetch(`${backendUrl}/backend/v1/ask/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: JSON.stringify({
      message:
        'Consulte os dados reais e informe, de forma curta, o código do negócio de maior valor e o nome do contato.',
    }),
  })
  const streamPayload = await response.text()
  assert.equal(response.status, 200, streamPayload)
  assert.match(response.headers.get('content-type') || '', /text\/event-stream/)
  const conversationId = response.headers.get('x-conversation-id')
  assert.ok(conversationId)
  cleanup.unshift(() => pb.collection('ask_conversations').delete(conversationId))
  const events = parseAgentEvents(streamPayload)
  const chunks = events
    .filter((event) => event.event === 'chunk')
    .map((event) => event.data.content || '')
    .join('')
  assert.ok(chunks.length > 0)
  assert.match(chunks, /NEG-\d{4,}/)
  assert.ok(events.some((event) => event.event === 'done'))

  const [conversation, persistedMessages] = await Promise.all([
    pb.collection('ask_conversations').getOne(conversationId),
    pb.collection('ask_messages').getFullList({
      filter: pb.filter('conversation = {:id}', { id: conversationId }),
      sort: 'created',
    }),
  ])
  assert.equal(conversation.user, auth.record.id)
  assert.deepEqual(
    persistedMessages.map((message) => message.role),
    ['user', 'assistant'],
  )
  assert.equal(persistedMessages[1].content, chunks)

  const memberPb = new PocketBase(backendUrl)
  memberPb.autoCancellation(false)
  const memberEmail = `qa.member.${suffix}@adapta.org`
  const member = await memberPb.collection('users').create({
    name: 'Usuário QA Temporário',
    email: memberEmail,
    password: 'Skip@Pass',
    passwordConfirm: 'Skip@Pass',
    role: 'admin',
  })
  assert.equal(member.role, 'member')
  await memberPb.collection('users').authWithPassword(memberEmail, 'Skip@Pass')
  await memberPb.collection('users').delete(member.id)

  console.log('Integração Skip Cloud aprovada: auth, seed, CRUD, realtime, SSE e agente nativo.')
} finally {
  if (unsubscribe) await unsubscribe().catch(() => {})
  if (dealToRestore) {
    await pb
      .collection('deals')
      .update(dealToRestore.id, { stage: dealToRestore.stage, status: dealToRestore.status })
      .catch(() => {})
  }
  for (const remove of cleanup) await remove().catch(() => {})
}
