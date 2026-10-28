import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Boxes,
  Check,
  ChevronDown,
  Clock3,
  Eraser,
  LoaderCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Repeat,
  Search,
  Sparkles,
  RotateCcw,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useAsk } from '@/contexts/AskContext'
import { useCrm } from '@/contexts/CrmContext'
import pb from '@/lib/pocketbase/client'

import { clearConversationMessages, deleteConversation, listAskMessages } from '@/services/ask'
import type { AskMessage } from '@/types/crm'
import { cn } from '@/lib/utils'
import { MarkdownMessage } from '@/components/MarkdownMessage'

interface ExampleCard {
  icon: typeof Boxes
  title: string
  description: string
  prompt: string
}

const exampleCards: ExampleCard[] = [
  {
    icon: Boxes,
    title: 'Criar nova oportunidade comercial',
    description: 'Transforme uma reunião ou demanda em um negócio estruturado no pipeline',
    prompt:
      'Crie uma nova oportunidade de venda para a empresa Alpha Soluções no estágio Qualificação, valor R$ 45.000',
  },
  {
    icon: Search,
    title: 'Identificar leads esfriando e riscos',
    description: 'Analise negócios parados, pendências de follow-up e oportunidades sem contato',
    prompt:
      'Quais negócios no pipeline estão sem contato há mais de 7 dias ou correm risco de perda?',
  },
  {
    icon: Repeat,
    title: 'Resumo executivo do pipeline e fechamentos',
    description: 'Consolide valores previstos, conversão por etapa e sugestão de próximos passos',
    prompt:
      'Faça um resumo executivo do fechamento previsto para as próximas semanas e sugira próximos passos.',
  },
]

type ViewMessage = Pick<AskMessage, 'id' | 'role' | 'content'> & {
  streaming?: boolean
  error?: boolean
  retryablePrompt?: string
}

export function AskChat({
  mode = 'panel',
  onClose,
}: {
  mode?: 'panel' | 'page'
  onClose?: () => void
}) {
  const {
    activeConversationId,
    setActiveConversationId,
    conversations,
    refreshConversations,
    newConversation,
  } = useAsk()
  const { deals, refresh: refreshCrm } = useCrm()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [messages, setMessages] = useState<ViewMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [historyDropdownOpen, setHistoryDropdownOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return localStorage.getItem('crm.agent.banner.dismissed') === 'true'
  })
  const endRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }
    listAskMessages(activeConversationId)
      .then(setMessages)
      .catch(() => setMessages([]))
  }, [activeConversationId])
  useRealtime<AskMessage>(
    'ask_messages',
    (event) => {
      if (sending || event.record.conversation !== activeConversationId) return
      listAskMessages(activeConversationId)
        .then(setMessages)
        .catch(() => {})
    },
    Boolean(activeConversationId),
  )
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  useEffect(() => () => abortRef.current?.abort(), [])

  const title = useMemo(
    () => conversations.find((item) => item.id === activeConversationId)?.title || 'Nova conversa',
    [conversations, activeConversationId],
  )

  async function send(text = input) {
    const message = text.trim()
    if (!message || sending) return
    setInput('')
    setSending(true)
    const userId = `local-user-${Date.now()}`
    const assistantId = `local-assistant-${Date.now()}`
    setMessages((current) => [
      ...current.filter((item) => !item.error || item.content),
      { id: userId, role: 'user', content: message },
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ])
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/ask/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({ conversationId: activeConversationId, message }),
        signal: controller.signal,
      })
      const payload = (await response.json()) as {
        content?: string
        conversation_id?: string
        error?: string
      }
      if (!response.ok) throw new Error(payload.error || `Erro ${response.status}`)

      const finalContent = payload.content || 'O agente concluiu sem retornar texto.'
      const conversationId = payload.conversation_id
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId ? { ...item, content: finalContent, streaming: false } : item,
        ),
      )
      if (conversationId && conversationId !== activeConversationId)
        setActiveConversationId(conversationId)
      await refreshConversations()
      // Refresh CRM data so any deal creation or update immediately reflects on UI/Kanban
      await refreshCrm().catch(() => {})
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const errorMsg =
          error instanceof Error
            ? error.message
            : 'Erro ao consultar o Ask CRM. Verifique sua conexão e tente novamente.'
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content:
                    item.content.trim() ||
                    `Não foi possível obter resposta do Ask CRM (${errorMsg}).`,
                  streaming: false,
                  error: true,
                  retryablePrompt: message,
                }
              : item,
          ),
        )
        toast({
          variant: 'destructive',
          title: 'Não foi possível consultar o Ask CRM',
          description: errorMsg,
        })
      }
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }

  function openDeal(code: string) {
    const deal = deals.find((item) => item.code === code)
    if (deal) {
      onClose?.()
      navigate(`/negocios?deal=${deal.id}`)
    }
  }

  function richText(content: string) {
    return content.split(/(NEG-\d{4,})/g).map((part, index) =>
      /^NEG-\d{4,}$/.test(part) ? (
        <button
          key={`${part}-${index}`}
          onClick={() => openDeal(part)}
          className="mx-0.5 rounded border border-blue-400/25 bg-blue-400/10 px-1.5 py-0.5 font-mono text-[11px] text-blue-300 hover:border-blue-400/50"
        >
          {part}
        </button>
      ) : (
        <span key={index}>{part}</span>
      ),
    )
  }

  async function handleClearConversation() {
    if (!activeConversationId || clearing) return
    if (!messages.length) return
    setClearing(true)
    try {
      await clearConversationMessages(activeConversationId)
      setMessages([])
      setInput('')
      toast({
        title: 'Conversa limpa',
        description: 'Todas as mensagens desta conversa foram removidas.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao limpar conversa',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      })
    } finally {
      setClearing(false)
      setClearDialogOpen(false)
    }
  }

  async function handleDeleteConversation() {
    if (!activeConversationId || clearing) return
    setClearing(true)
    try {
      const convId = activeConversationId
      await deleteConversation(convId)
      newConversation(false)
      await refreshConversations()
      toast({
        title: 'Conversa excluída',
        description: 'A conversa e suas mensagens foram removidas.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir conversa',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      })
    } finally {
      setClearing(false)
      setDeleteDialogOpen(false)
    }
  }

  const dismissBanner = (permanent = true) => {
    setBannerDismissed(true)
    if (permanent) localStorage.setItem('crm.agent.banner.dismissed', 'true')
  }

  const skillsList = [
    { label: 'Pesquisa em Negócios', desc: 'Consulta pipeline, estágios e previsões' },
    { label: 'Gestão de Contatos', desc: 'Filtra empresas, cargos e dados comerciais' },
    { label: 'Atualização de Estágio', desc: 'Move oportunidades com confirmação de segurança' },
    { label: 'Resumo e Insights', desc: 'Analisa riscos de perda e negócios parados' },
  ]

  return (
    <div
      className={cn(
        'relative flex min-h-0 w-full overflow-hidden bg-white text-[#1c1c1e]',
        mode === 'panel'
          ? 'h-[min(760px,calc(100vh-56px))] rounded-[12px] border border-[#e5e7eb] shadow-[0_24px_70px_rgba(0,0,0,.15)]'
          : 'h-full',
      )}
    >
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Top Header estilo Linear Agent */}
        <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-4">
          <div className="relative" data-tour-id="agent-history-dropdown">
            <button
              onClick={() => setHistoryDropdownOpen(!historyDropdownOpen)}
              className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-[#1c1c1e] hover:bg-[#f1f5f9] transition"
            >
              <span className="truncate max-w-[220px] sm:max-w-[320px]">
                {activeConversationId ? title : 'New chat'}
              </span>
              <ChevronDown className="size-3.5 text-[#64748b] transition group-hover:text-[#1c1c1e]" />
            </button>

            {historyDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setHistoryDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-40 w-72 rounded-lg border border-[#e2e8f0] bg-white p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.12)] backdrop-blur">
                  <button
                    onClick={() => {
                      newConversation(false)
                      setHistoryDropdownOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium text-amber-700 hover:bg-amber-50"
                  >
                    <Plus className="size-3.5 text-amber-600" />
                    <span>Novo chat</span>
                  </button>
                  <div className="my-1 border-t border-[#f1f5f9]" />
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {conversations.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          'group flex w-full items-center rounded-md px-2.5 py-1 transition',
                          c.id === activeConversationId ? 'bg-[#f1f5f9]' : 'hover:bg-[#f8fafc]',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveConversationId(c.id)
                            setHistoryDropdownOpen(false)
                          }}
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] transition',
                            c.id === activeConversationId
                              ? 'font-medium text-[#1c1c1e]'
                              : 'text-[#475569] group-hover:text-[#1c1c1e]',
                          )}
                          title={c.title}
                        >
                          <Clock3 className="size-3 shrink-0 text-[#94a3b8]" />
                          <span className="truncate">{c.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveConversationId(c.id)
                            setDeleteDialogOpen(true)
                            setHistoryDropdownOpen(false)
                          }}
                          title="Excluir conversa"
                          className="ml-1 shrink-0 rounded p-1 text-[#94a3b8] opacity-0 transition hover:bg-[#e2e8f0] hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                    {!conversations.length && (
                      <p className="px-2.5 py-3 text-[10px] text-[#94a3b8]">
                        Nenhuma conversa recente encontrada.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Botão Limpar conversa direto no header estilo Linear */}
            <button
              type="button"
              data-tour-id="agent-clear-button"
              onClick={() => {
                if (!activeConversationId || messages.length === 0 || clearing || sending) return
                setClearDialogOpen(true)
              }}
              disabled={!activeConversationId || messages.length === 0 || clearing || sending}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition disabled:opacity-40 disabled:pointer-events-none"
              title="Limpar mensagens da conversa"
            >
              <Eraser className="size-3.5" />
              <span className="hidden sm:inline">Limpar conversa</span>
            </button>

            {/* Menu Dropdown de opções da conversa (Limpar / Excluir) */}
            {activeConversationId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid size-7 place-items-center rounded-md text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition"
                    title="Mais opções da conversa"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white border-[#e2e8f0]">
                  <DropdownMenuItem
                    onClick={() => setClearDialogOpen(true)}
                    disabled={messages.length === 0 || clearing || sending}
                    className="cursor-pointer gap-2 text-[12px] text-[#1c1c1e] hover:bg-[#f8fafc]"
                  >
                    <Eraser className="size-3.5 text-[#64748b]" />
                    <span>Limpar conversa</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#f1f5f9]" />
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={clearing || sending}
                    className="cursor-pointer gap-2 text-[12px] text-red-600 focus:bg-red-50 focus:text-red-700"
                  >
                    <Trash2 className="size-3.5 text-red-500" />
                    <span>Excluir conversa</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Online
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e]"
                title="Fechar"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </header>

        {/* Diálogo de confirmação para Limpar conversa */}
        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogContent className="bg-white border-[#e2e8f0] max-w-[420px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[15px] font-semibold text-[#1c1c1e]">
                Limpar conversa?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] text-[#64748b]">
                Todas as mensagens desta conversa serão removidas. O histórico da conversa será
                mantido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2">
              <AlertDialogCancel
                disabled={clearing}
                className="text-[12px] h-8 border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={clearing}
                onClick={(e) => {
                  e.preventDefault()
                  handleClearConversation()
                }}
                className="text-[12px] h-8 bg-amber-500 hover:bg-amber-600 text-white font-medium"
              >
                {clearing ? <LoaderCircle className="size-3.5 animate-spin mr-1.5" /> : null}
                Limpar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Diálogo de confirmação para Excluir conversa */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-white border-[#e2e8f0] max-w-[420px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[15px] font-semibold text-[#1c1c1e]">
                Excluir conversa?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] text-[#64748b]">
                Esta conversa e todas as mensagens associadas serão excluídas permanentemente do
                histórico.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2">
              <AlertDialogCancel
                disabled={clearing}
                className="text-[12px] h-8 border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={clearing}
                onClick={(e) => {
                  e.preventDefault()
                  handleDeleteConversation()
                }}
                className="text-[12px] h-8 bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                {clearing ? <LoaderCircle className="size-3.5 animate-spin mr-1.5" /> : null}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Banner pill central estilo "Linear Agent is now your default view" */}
        {!bannerDismissed && (
          <div className="flex justify-center pt-3 px-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-1 text-[11px] text-[#475569] shadow-2xs animate-in fade-in slide-in-from-top-1">
              <span>O CRM Agent agora é sua visualização padrão</span>
              <button
                onClick={() => navigate('/dashboard')}
                className="font-medium text-[#1c1c1e] hover:underline transition"
              >
                Alterar
              </button>
              <button
                onClick={() => dismissBanner(true)}
                className="rounded bg-[#e2e8f0] px-2 py-0.5 text-[10px] font-semibold text-[#1c1c1e] hover:bg-[#cbd5e1] transition"
              >
                Manter
              </button>
            </div>
          </div>
        )}

        {/* Área central com histórico ou estado inicial estilo Linear */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 bg-white">
          {!messages.length ? (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center">
              {/* Watermark / sutil Linear background glyph */}
              <div className="relative mb-6">
                {/* Input grande central "Ask Linear..." / "Ask CRM..." */}
                <div
                  data-tour-id="agent-chat-input"
                  className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,.06)] transition-all focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/15"
                >
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    placeholder="Pergunte ao CRM..."
                    className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
                  />

                  <div className="mt-2 flex items-center justify-between pt-1">
                    <div className="relative">
                      <button
                        type="button"
                        data-tour-id="agent-skills-button"
                        onClick={() => setSkillsOpen(!skillsOpen)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition"
                      >
                        <Boxes className="size-3.5 text-[#94a3b8]" />
                        <span>Habilidades</span>
                        <ChevronDown className="size-3 text-[#94a3b8]" />
                      </button>

                      {skillsOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setSkillsOpen(false)}
                          />
                          <div className="absolute left-0 bottom-full mb-2 z-40 w-64 rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-xl">
                            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                              Habilidades ativas
                            </p>
                            <div className="mt-1 space-y-1">
                              {skillsList.map((skill) => (
                                <div
                                  key={skill.label}
                                  className="rounded px-2 py-1.5 text-left hover:bg-[#f8fafc]"
                                >
                                  <p className="text-[11px] font-semibold text-[#1c1c1e]">
                                    {skill.label}
                                  </p>
                                  <p className="text-[10px] text-[#64748b]">{skill.desc}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          toast({
                            title: 'Anexo de arquivo',
                            description:
                              'Para enviar documentos de suporte, cole o texto na mensagem.',
                          })
                        }}
                        className="grid size-7 place-items-center rounded-md text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition"
                        title="Anexar arquivo"
                      >
                        <Paperclip className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!input.trim() || sending}
                        onClick={() => send()}
                        className="grid size-7 place-items-center rounded-md bg-amber-500 text-white transition hover:bg-amber-600 disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
                        title="Enviar mensagem"
                      >
                        {sending ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <ArrowUp className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção "Get started with some examples" com cards estilo Linear */}
              <div data-tour-id="agent-example-cards">
                <div className="mb-3 flex items-center justify-between text-[11px] text-[#64748b]">
                  <span>Comece com alguns exemplos</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {exampleCards.map((card) => {
                    const CardIcon = card.icon
                    return (
                      <button
                        key={card.title}
                        onClick={() => send(card.prompt)}
                        className="group flex flex-col justify-between rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-3.5 text-left transition hover:border-[#cbd5e1] hover:bg-white hover:shadow-xs"
                      >
                        <div>
                          <div className="mb-3 grid size-7 place-items-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] group-hover:border-amber-400 group-hover:text-amber-600 transition">
                            <CardIcon className="size-3.5" />
                          </div>
                          <h4 className="text-[12px] font-semibold text-[#1c1c1e] leading-snug">
                            {card.title}
                          </h4>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748b]">
                            {card.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[86%] text-[13px] leading-6',
                      message.role === 'user'
                        ? 'rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 text-[#1c1c1e] shadow-2xs'
                        : message.error
                          ? 'rounded-lg border border-red-200 bg-red-50/70 p-3.5 text-red-900 shadow-2xs'
                          : 'text-[#334155]',
                    )}
                  >
                    {message.role === 'assistant' && !message.error && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                        <Sparkles className="size-3" /> Ask CRM
                      </div>
                    )}
                    {message.error && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
                        <TriangleAlert className="size-3.5" /> Erro na resposta
                      </div>
                    )}
                    {message.role === 'assistant' && !message.error ? (
                      <MarkdownMessage
                        content={message.content}
                        isStreaming={message.streaming}
                        onOpenDeal={openDeal}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {richText(message.content)}
                        {message.streaming && (
                          <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-amber-500 align-middle" />
                        )}
                      </div>
                    )}
                    {message.error && message.retryablePrompt && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          disabled={sending}
                          onClick={() => send(message.retryablePrompt)}
                          className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50"
                        >
                          <RotateCcw className="size-3" />
                          <span>Tentar novamente</span>
                        </button>
                      </div>
                    )}
                    {message.role === 'assistant' &&
                      !message.streaming &&
                      /(aplicar mudança|confirm[ea]|posso mover)/i.test(message.content) && (
                        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                          <p className="text-[11px] font-bold text-[#1c1c1e]">Aplicar mudança?</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              disabled={sending}
                              onClick={() => send('Confirmo. Aplique a mudança descrita acima.')}
                              className="flex items-center gap-1 rounded bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs transition hover:bg-amber-600"
                            >
                              <Check className="size-3" /> Aplicar
                            </button>
                            <button
                              disabled={sending}
                              onClick={() => send('Não aplique a mudança. Descartar esta ação.')}
                              className="rounded border border-[#e2e8f0] bg-white px-2.5 py-1 text-[10px] text-[#475569] font-medium hover:bg-[#f8fafc]"
                            >
                              Descartar
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input fixo inferior estilo chat quando já há mensagens */}
        {Boolean(messages.length) && (
          <div className="shrink-0 border-t border-[#e5e7eb] bg-white/95 p-3 sm:p-4 backdrop-blur">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
              className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-[#e2e8f0] bg-white p-2 shadow-xs focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/15"
            >
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Pergunte ao CRM..."
                className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-2 py-1 text-[13px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="grid size-8 place-items-center rounded-lg bg-amber-500 text-white transition hover:bg-amber-600 disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
              >
                {sending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </form>
            <p className="mt-1.5 text-center text-[9px] text-[#64748b]">
              Dados reais do CRM · ações estruturadas exigem confirmação
            </p>
          </div>
        )}

        {/* Footer do bottom estilo Linear "What's new / Agent" */}
        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[#ded2c3] bg-[#f5ede2] px-4 text-[10px] text-[#5c4735]">
          <div className="flex items-center gap-2">
            <span className="rounded bg-white/80 border border-[#d6c7b6] px-1.5 py-0.5 font-bold text-[#2b1c13]">
              Barista IA
            </span>
            <span>
              Use o Copiloto para consultar pedidos, clientes em risco ou métricas do café.
            </span>
          </div>
          <div className="flex items-center gap-1 text-[#8c531b] font-bold">
            <Sparkles className="size-3 text-amber-600" />
            <span>CRM Barista Agent</span>
          </div>
        </footer>
      </section>
    </div>
  )
}
