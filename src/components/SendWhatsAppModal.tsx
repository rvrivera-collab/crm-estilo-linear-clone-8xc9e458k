import { useState } from 'react'
import {
  ExternalLink,
  Flame,
  HeartHandshake,
  LoaderCircle,
  MessageCircle,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react'
import { buildDisneyWhatsAppMessage, getLoyaltyLevel, type Contact } from '@/types/crm'
import { sendDisneyWhatsApp } from '@/services/crm'
import {
  DISNEY_MESSAGE_TEMPLATES,
  formatTemplateText,
  type MessageTemplate,
} from '@/data/messageTemplates'
import { useToast } from '@/hooks/use-toast'

interface SendWhatsAppModalProps {
  open: boolean
  onClose: () => void
  contact?: Contact | null
  allContacts?: Contact[]
  initialMoment?: 'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  initialTemplateId?: string
  couponCode?: string
  onSent?: () => void
}

export function SendWhatsAppModal({
  open,
  onClose,
  contact: initialContact,
  allContacts = [],
  initialMoment = 'personalizado',
  couponCode,
  onSent,
}: SendWhatsAppModalProps) {
  const { toast } = useToast()
  // Permite selecionar/trocar destinatário dentro do modal
  const [activeContact, setActiveContact] = useState<Contact | null>(initialContact || null)
  const [contactSearch, setContactSearch] = useState('')
  const [isChangingContact, setIsChangingContact] = useState(!initialContact)

  // Atualizar quando props mudam
  useState(() => {
    if (initialContact) {
      setActiveContact(initialContact)
      setIsChangingContact(false)
    }
  })

  const [moment, setMoment] = useState<
    'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  >(initialMoment)
  const [customText, setCustomText] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [waFallbackUrl, setWaFallbackUrl] = useState<string | null>(null)
  const [lastWarning, setLastWarning] = useState<string | null>(null)

  // Gerar o rascunho caloroso no estilo Disney
  const currentContact = activeContact || initialContact || null
  const generatedMessage = currentContact
    ? buildDisneyWhatsAppMessage({
        contact: currentContact,
        moment,
        couponCode: couponCode || currentContact.last_coupon_code,
        customNote: customText,
      })
    : ''

  const [message, setMessage] = useState(generatedMessage)

  // Atualizar quando selecionar outro contato da lista
  const handleSelectRecipient = (selected: Contact) => {
    setActiveContact(selected)
    setIsChangingContact(false)
    const msg = buildDisneyWhatsAppMessage({
      contact: selected,
      moment,
      couponCode: couponCode || selected.last_coupon_code,
      customNote: customText,
    })
    setMessage(msg)
  }

  // Atualizar quando mudar de momento ou quando abrir
  const handleMomentChange = (newMoment: typeof moment) => {
    setMoment(newMoment)
    if (!currentContact) return
    if (newMoment === 'recorrencia') {
      setSelectedTemplateId('recompra_30d_aroma_saudade')
      const tmpl = DISNEY_MESSAGE_TEMPLATES[0]
      setMessage(
        formatTemplateText(tmpl.text, currentContact, couponCode ? { couponCode } : undefined),
      )
    } else {
      setSelectedTemplateId('')
      const msg = buildDisneyWhatsAppMessage({
        contact: currentContact,
        moment: newMoment,
        couponCode: couponCode || currentContact.last_coupon_code,
        customNote: customText,
      })
      setMessage(msg)
    }
  }

  const handleSelectTemplate = (template: MessageTemplate) => {
    if (!currentContact) return
    setSelectedTemplateId(template.id)
    const formatted = formatTemplateText(
      template.text,
      currentContact,
      couponCode ? { couponCode } : undefined,
    )
    setMessage(formatted)
  }

  const handleSend = async () => {
    if (!currentContact) {
      toast({
        variant: 'destructive',
        title: 'Destinatário não selecionado',
        description: 'Por favor, selecione um cliente da base para enviar.',
      })
      return
    }
    setSending(true)
    setLastWarning(null)
    setWaFallbackUrl(null)

    try {
      const res = await sendDisneyWhatsApp({
        contactId: currentContact.id,
        phone: currentContact.phone,
        message,
        momentType: moment,
      })

      if (res.whatsappSent) {
        toast({
          title: '✨ Mensagem de Encantamento enviada!',
          description: `Disparada com sucesso pela sua conta de WhatsApp para ${currentContact.name}.`,
        })
        if (onSent) onSent()
        onClose()
      } else {
        // Conexão precisa de ativação em Conectores ou número aguarda resposta
        setWaFallbackUrl(res.waFallbackUrl || null)
        const friendlyWarning =
          res.warning || 'Conexão do WhatsApp do dono pendente de ativação na aba Conectores.'
        setLastWarning(friendlyWarning)

        toast({
          title: 'Atenção aos Detalhes',
          description:
            'A mensagem foi registrada na jornada! Você também pode enviá-la via link direto abaixo.',
        })
        if (onSent) onSent()
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Falha na comunicação',
        description:
          err instanceof Error
            ? err.message
            : 'Não foi possível processar o envio de WhatsApp no momento.',
      })
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  // Contatos filtrados na busca do modal
  const filteredContacts = allContacts.filter((c) => {
    const q = contactSearch.toLowerCase().trim()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.nickname && c.nickname.toLowerCase().includes(q)) ||
      (c.favorite_coffee && c.favorite_coffee.toLowerCase().includes(q))
    )
  })

  const loyalty = currentContact ? getLoyaltyLevel(currentContact.purchase_count || 0) : null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg animate-panel-rise rounded-xl border border-[#e5e7eb] bg-white text-[#1c1c1e] shadow-[0_20px_50px_rgba(0,0,0,.15)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex h-13 items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600">
              <MessageCircle className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#1c1c1e] flex items-center gap-1.5">
                Experiência Disney · Enviar WhatsApp
              </h2>
              <p className="text-[10px] text-[#64748b]">
                {currentContact ? (
                  <>
                    Para: <strong>{currentContact.name}</strong>{' '}
                    {currentContact.phone ? `(${currentContact.phone})` : '(Sem telefone)'}
                  </>
                ) : (
                  'Selecione um cliente da base'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Corpo do modal */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* SELETOR / TROCA DE DESTINATÁRIO (BASE REAL DE CONTATOS) */}
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#334155] flex items-center gap-1">
                Destinatário da Base ({allContacts.length} clientes)
              </label>
              {currentContact && !isChangingContact && (
                <button
                  type="button"
                  onClick={() => setIsChangingContact(true)}
                  className="text-[10px] text-amber-700 hover:text-amber-800 font-semibold"
                >
                  Alterar destinatário
                </button>
              )}
            </div>

            {!currentContact || isChangingContact ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Buscar cliente por nome, telefone ou café favorito..."
                  className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                />

                <div className="max-h-36 overflow-y-auto rounded-md border border-[#e2e8f0] bg-white divide-y divide-[#f1f5f9]">
                  {filteredContacts.length === 0 ? (
                    <div className="p-3 text-center text-[11px] text-[#94a3b8]">
                      Nenhum contato encontrado com este termo.
                    </div>
                  ) : (
                    filteredContacts.slice(0, 50).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectRecipient(c)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-amber-50/60 transition ${
                          currentContact?.id === c.id
                            ? 'bg-amber-50 font-bold text-amber-900'
                            : 'text-[#1c1c1e]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold block truncate">{c.name}</span>
                          <span className="text-[10px] text-[#64748b] font-mono">
                            {c.phone || 'Sem telefone'}{' '}
                            {c.favorite_coffee ? `· ☕ ${c.favorite_coffee}` : ''}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono rounded bg-slate-100 text-[#475569] px-1.5 py-0.5 shrink-0 ml-2">
                          {c.purchase_count || 0} compras
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white rounded-md border border-[#e2e8f0] p-2.5">
                <div className="min-w-0">
                  <p className="font-bold text-xs text-[#1c1c1e] truncate">{currentContact.name}</p>
                  <p className="text-[10px] text-[#64748b] font-mono">
                    {currentContact.phone || 'Sem telefone cadastrado'} ·{' '}
                    {currentContact.favorite_coffee
                      ? `☕ ${currentContact.favorite_coffee}`
                      : 'Café padrão'}
                  </p>
                </div>
                {loyalty && (
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ml-2 ${loyalty.badgeColor}`}
                  >
                    Nv.{loyalty.level} {loyalty.name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Seletor de Momento de Encantamento */}
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1.5">
              Momento de Encantamento Disney
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleMomentChange('aniversario')}
                className={`p-2 rounded-lg border text-left transition flex flex-col gap-1 ${
                  moment === 'aniversario'
                    ? 'border-rose-400 bg-rose-50/80 text-rose-950 font-bold'
                    : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc] text-[#475569]'
                }`}
              >
                <span className="text-xs">🎂 Aniversário</span>
                <span className="text-[9px] text-[#64748b]">Cupom 15%</span>
              </button>
              <button
                type="button"
                onClick={() => handleMomentChange('recorrencia')}
                className={`p-2 rounded-lg border text-left transition flex flex-col gap-1 ${
                  moment === 'recorrencia'
                    ? 'border-orange-400 bg-orange-50/80 text-orange-950 font-bold'
                    : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc] text-[#475569]'
                }`}
              >
                <span className="text-xs">☕ Reengajamento</span>
                <span className="text-[9px] text-[#64748b]">30 dias sem compras</span>
              </button>
              <button
                type="button"
                onClick={() => handleMomentChange('nivel_fidelidade')}
                className={`p-2 rounded-lg border text-left transition flex flex-col gap-1 ${
                  moment === 'nivel_fidelidade'
                    ? 'border-purple-400 bg-purple-50/80 text-purple-950 font-bold'
                    : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc] text-[#475569]'
                }`}
              >
                <span className="text-xs">⭐ Novo Nível</span>
                <span className="text-[9px] text-[#64748b]">
                  {loyalty ? `Nv.${loyalty.level} ${loyalty.name}` : 'Fidelidade'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleMomentChange('personalizado')}
                className={`p-2 rounded-lg border text-left transition flex flex-col gap-1 ${
                  moment === 'personalizado'
                    ? 'border-amber-400 bg-amber-50/80 text-amber-950 font-bold'
                    : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc] text-[#475569]'
                }`}
              >
                <span className="text-xs">✨ Especial / Google</span>
                <span className="text-[9px] text-[#64748b]">Atenção total</span>
              </button>
            </div>
          </div>

          {/* Biblioteca de Mensagens Pré-Prontas de Recompra (30 dias) e Outros Momentos */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-600" />
                Mensagens Pré-Prontas (Variantes Disney)
              </span>
              <span className="text-[10px] text-amber-800 font-mono">
                {DISNEY_MESSAGE_TEMPLATES.length} modelos
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DISNEY_MESSAGE_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`rounded-md px-2 py-1 text-[10px] transition text-left border ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-white font-bold shadow-2xs'
                        : 'border-[#cbd5e1] bg-white text-[#334155] hover:border-amber-400 hover:bg-amber-50'
                    }`}
                    title={tmpl.description}
                  >
                    {tmpl.title}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Destaque das preferências sensoriais do cliente */}
          {currentContact && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                Personalização Ativa do Cliente
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-amber-950">
                {currentContact.nickname && (
                  <span>
                    Como prefere ser chamado: <strong>"{currentContact.nickname}"</strong>
                  </span>
                )}
                {currentContact.favorite_coffee && (
                  <span>
                    Café favorito: <strong>{currentContact.favorite_coffee}</strong>
                  </span>
                )}
                {currentContact.brew_method_preference && (
                  <span>
                    Método: <strong>{currentContact.brew_method_preference}</strong>
                  </span>
                )}
                {currentContact.dietary_restrictions && (
                  <span className="text-rose-800">
                    Restrições: <strong>{currentContact.dietary_restrictions}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Área de edição da mensagem */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-[#475569]">
                Mensagem Personalizada (Você pode editar livremente)
              </label>
              <button
                type="button"
                onClick={() => handleMomentChange(moment)}
                className="text-[10px] text-amber-700 hover:text-amber-800 font-semibold"
              >
                Restaurar texto padrão
              </button>
            </div>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] p-3 text-xs text-[#1c1c1e] leading-relaxed outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-sans"
            />
          </div>

          {/* Mensagem amigável de conexão / fallback */}
          {lastWarning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Aviso Amigável de Envio</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {lastWarning} O evento foi registrado na linha do tempo da jornada!
                  </p>
                </div>
              </div>
              {waFallbackUrl && (
                <div className="pt-2 border-t border-amber-200 flex items-center justify-between">
                  <span className="text-[10px] text-[#64748b]">Enviar agora com um clique:</span>
                  <a
                    href={waFallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                  >
                    <MessageCircle className="size-3.5" /> Abrir no WhatsApp Web / App{' '}
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between border-t border-[#e5e7eb] px-5 py-3 bg-[#f8fafc] rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-white"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            {waFallbackUrl && (
              <a
                href={waFallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <MessageCircle className="size-3.5" /> Abrir WhatsApp
              </a>
            )}
            <button
              type="button"
              disabled={sending || !currentContact || !currentContact.phone}
              onClick={handleSend}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {sending ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <MessageCircle className="size-3.5" />
              )}
              Enviar pelo WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
