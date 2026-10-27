import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { listConversations } from '@/services/ask'
import type { AskConversation } from '@/types/crm'

interface AskContextValue {
  open: boolean
  setOpen: (value: boolean) => void
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  conversations: AskConversation[]
  refreshConversations: () => Promise<void>
  newConversation: (showPanel?: boolean) => void
}

const AskContext = createContext<AskContextValue | null>(null)

export function AskProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false)
  const [activeConversationId, setActiveState] = useState<string | null>(() =>
    localStorage.getItem('crm.ask.conversation'),
  )
  const [conversations, setConversations] = useState<AskConversation[]>([])
  const refreshConversations = useCallback(async () => {
    const items = await listConversations()
    setConversations(items)
  }, [])
  useEffect(() => {
    refreshConversations().catch(() => {})
  }, [refreshConversations])
  useRealtime<AskConversation>('ask_conversations', () => {
    refreshConversations().catch(() => {})
  })
  const setActiveConversationId = useCallback((id: string | null) => {
    setActiveState(id)
    if (id) localStorage.setItem('crm.ask.conversation', id)
    else localStorage.removeItem('crm.ask.conversation')
  }, [])
  const newConversation = useCallback(
    (showPanel = true) => {
      setActiveConversationId(null)
      if (showPanel) setOpen(true)
    },
    [setActiveConversationId],
  )
  const value = useMemo(
    () => ({
      open,
      setOpen,
      activeConversationId,
      setActiveConversationId,
      conversations,
      refreshConversations,
      newConversation,
    }),
    [
      open,
      activeConversationId,
      conversations,
      refreshConversations,
      setActiveConversationId,
      newConversation,
    ],
  )
  return <AskContext.Provider value={value}>{children}</AskContext.Provider>
}

export function useAsk() {
  const value = useContext(AskContext)
  if (!value) throw new Error('useAsk deve ser usado dentro de AskProvider')
  return value
}
