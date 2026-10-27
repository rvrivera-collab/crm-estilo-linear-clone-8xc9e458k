import pb from '@/lib/pocketbase/client'
import type { AskConversation, AskMessage } from '@/types/crm'

export async function listConversations() {
  return pb.collection<AskConversation>('ask_conversations').getFullList({ sort: '-updated' })
}

export async function listAskMessages(conversationId: string) {
  return pb.collection<AskMessage>('ask_messages').getFullList({
    filter: pb.filter('conversation = {:id}', { id: conversationId }),
    sort: 'created',
  })
}

export async function clearConversationMessages(conversationId: string) {
  const messages = await listAskMessages(conversationId)
  if (!messages.length) return
  await Promise.all(messages.map((m) => pb.collection('ask_messages').delete(m.id)))
}

export async function deleteConversation(conversationId: string) {
  await pb.collection('ask_conversations').delete(conversationId)
}
