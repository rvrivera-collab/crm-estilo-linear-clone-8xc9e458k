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
import { useToast } from '@/hooks/use-toast'

interface SendWhatsAppModalProps {
  open: boolean
  onClose: () => void
  contact: Contact | null
  initialMoment?: 'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  couponCode?: string
  onSent?: () => void
}

export function SendWhatsAppModal({
  open,
  onClose,
  contact,
  initialMoment = 'personalizado',
  couponCode,
  onSent,
}: SendWhatsAppModalProps) {
  const { toast } = useToast()
  const [moment, setMoment] = useState<
    'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  >(initialMoment)
  const [customText, setCustomText] = useState('')
  const [sending, setSending] = useState(false)
  const [waFallbackUrl, setWaFallbackUrl] = useState<string | null>(null)
  const [lastWarning, setLastWarning] = useState<string | null>(null)

  // Gerar o rascunho caloroso no estilo Disney
  const generatedMessage = contact
    ? buildDisneyWhatsAppMessage({
        contact,
        moment,
        couponCode: couponCode || contact.last_coupon_code,
        customNote: customText,
      })
    : ''

  const [message, setMessage] = useState(generatedMessage)

  // Atualizar quando mudar de momento ou quando abrir
  const handleMomentChange = (newMoment: typeof moment) => {
    setMoment(newMoment)
    if (contact) {
      const msg = buildDisneyWhatsAppMessage({
        contact,
        moment: newMoment,
        couponCode: couponCode || contact.last_coupon_code,
        customNote: customText,
      })
      setMessage(msg)
    }
  }

  const handleSend = async () => {
    if (!contact) return
    setSending(true)
    setLastWarning(null)
    setWaFallbackUrl(null)

    try {
      const res = await sendDisneyWhatsApp({
        contactId: contact.id,
        phone: contact.phone,
        message,
        momentType: moment,
      })

      if (res.whatsappSent) {
        toast({
          title: '✨ Mensagem de Encantamento enviada!',
          description: `Disparada com sucesso pela sua conta de WhatsApp para ${contact.name}.`,
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

  if (!open || !contact) return null

  const loyalty = getLoyaltyLevel(contact.purchase_count || 0)

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
                Para: <strong>{contact.name}</strong>{' '}
                {contact.phone ? `(${contact.phone})` : '(Sem telefone cadastrado)'}
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
                <span className="text-[9px] text-[#64748b]">Saudade & aroma</span>
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
                  Nv.{loyalty.level} {loyalty.name}
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
                <span className="text-xs">✨ Especial</span>
                <span className="text-[9px] text-[#64748b]">Atenção total</span>
              </button>
            </div>
          </div>

          {/* Destaque das preferências sensoriais do cliente */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
              Personalização Ativa do Cliente
            </span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-amber-950">
              {contact.nickname && (
                <span>
                  Como prefere ser chamado: <strong>"{contact.nickname}"</strong>
                </span>
              )}
              {contact.favorite_coffee && (
                <span>
                  Café favorito: <strong>{contact.favorite_coffee}</strong>
                </span>
              )}
              {contact.brew_method_preference && (
                <span>
                  Método: <strong>{contact.brew_method_preference}</strong>
                </span>
              )}
              {contact.dietary_restrictions && (
                <span className="text-rose-800">
                  Restrições: <strong>{contact.dietary_restrictions}</strong>
                </span>
              )}
            </div>
          </div>

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
              disabled={sending || !contact.phone}
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
