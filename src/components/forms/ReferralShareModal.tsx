import { useState } from 'react'
import {
  ExternalLink,
  Gift,
  LoaderCircle,
  MessageCircle,
  Share2,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react'
import {
  buildReferralRewardCongratulationWhatsAppMessage,
  buildReferralShareWhatsAppMessage,
  sendDisneyWhatsApp,
} from '@/services/crm'
import type { Contact } from '@/types/crm'
import { useToast } from '@/hooks/use-toast'

interface ReferralShareModalProps {
  open: boolean
  onClose: () => void
  contact: Contact | null
  rewardCoupon?: string
  referredName?: string
  mode?: 'share_code' | 'reward_congrats'
}

export function ReferralShareModal({
  open,
  onClose,
  contact,
  rewardCoupon,
  referredName,
  mode = 'share_code',
}: ReferralShareModalProps) {
  const { toast } = useToast()
  const [sending, setSending] = useState(false)
  const [waFallbackUrl, setWaFallbackUrl] = useState<string | null>(null)
  const [lastWarning, setLastWarning] = useState<string | null>(null)

  // Mensagem calculada
  const initialText =
    contact && mode === 'reward_congrats'
      ? buildReferralRewardCongratulationWhatsAppMessage({
          referrer: contact,
          referredName: referredName || 'seu(sua) amigo(a)',
          couponCode: rewardCoupon || contact.last_coupon_code || 'INDICOU-XXXX',
        })
      : contact
        ? buildReferralShareWhatsAppMessage(contact)
        : ''

  const [message, setMessage] = useState(initialText)

  // Atualizar quando props mudarem
  useState(() => {
    setMessage(initialText)
  })

  if (!open || !contact) return null

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message)
      toast({
        title: 'Texto copiado!',
        description: 'Mensagem pronta copiada para a área de transferência.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível copiar',
      })
    }
  }

  const handleSend = async () => {
    setSending(true)
    setLastWarning(null)
    setWaFallbackUrl(null)

    try {
      const res = await sendDisneyWhatsApp({
        contactId: contact.id,
        phone: contact.phone,
        message,
        momentType: 'personalizado',
        title:
          mode === 'reward_congrats'
            ? '🎁 Recompensa de Indicação (Cupom Disney)'
            : '✨ Código de Indicação Disney para Amigos',
      })

      if (res.whatsappSent) {
        toast({
          title: '✨ Mensagem enviada via API oficial do WhatsApp!',
          description: `Disparada com sucesso para ${contact.name}.`,
        })
        onClose()
      } else {
        setWaFallbackUrl(res.waFallbackUrl || null)
        const friendlyWarning =
          res.warning ||
          'Envio via API indisponível no momento. Use o link do WhatsApp para envio com 1 clique.'
        setLastWarning(friendlyWarning)

        toast({
          title: 'Link do WhatsApp pronto (wa.me)',
          description: 'Clique em "Abrir no WhatsApp" para enviar instantaneamente ao cliente.',
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Falha na comunicação',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setSending(false)
    }
  }

  const isReward = mode === 'reward_congrats'

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
            <span
              className={`grid size-8 place-items-center rounded-full border ${
                isReward
                  ? 'bg-purple-50 border-purple-200 text-purple-600'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
            >
              {isReward ? <Gift className="size-4" /> : <Share2 className="size-4" />}
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#1c1c1e] flex items-center gap-1.5">
                {isReward
                  ? 'Parabenizar pela Indicação Convertida'
                  : 'Compartilhar Código de Indicação'}
              </h2>
              <p className="text-[10px] text-[#64748b]">
                Para: <strong>{contact.name}</strong>{' '}
                {contact.phone ? `(${contact.phone})` : '(Sem fone)'}
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

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Card com Código e Cupom */}
          <div
            className={`rounded-lg border p-3 flex items-center justify-between ${
              isReward
                ? 'border-purple-200 bg-purple-50/60 text-purple-950'
                : 'border-amber-200 bg-amber-50/60 text-amber-950'
            }`}
          >
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider block">
                {isReward ? 'Cupom de Recompensa Gerado' : 'Código Único de Indicação'}
              </span>
              <span className="text-base font-extrabold font-mono mt-0.5 block">
                {isReward
                  ? rewardCoupon || contact.last_coupon_code || 'INDICOU-XXXX'
                  : contact.referral_code || 'CÓDIGO PENDENTE'}
              </span>
              <span className="text-[10px] text-[#64748b] mt-0.5 block">
                {isReward
                  ? `Recompensa pela conversão de ${referredName || 'amigo indicado'}`
                  : 'O cliente pode enviar este código para quantos amigos quiser'}
              </span>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                isReward
                  ? 'border-purple-300 bg-purple-100 text-purple-900'
                  : 'border-amber-300 bg-amber-100 text-amber-900'
              }`}
            >
              {isReward ? '20% OFF' : '15% OFF pro amigo'}
            </span>
          </div>

          {/* Área de edição da mensagem */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[#475569] flex items-center gap-1">
                <Sparkles className="size-3 text-amber-600" />
                Mensagem Pré-Pronta Disney para WhatsApp
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[10px] text-amber-700 hover:text-amber-800 font-semibold"
              >
                Copiar texto
              </button>
            </div>
            <textarea
              rows={9}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] p-3 text-xs text-[#1c1c1e] leading-relaxed outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-sans"
            />
          </div>

          {/* Aviso / fallback */}
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
                  <span className="text-[10px] text-[#64748b]">Disparar com 1 clique:</span>
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

        {/* Rodapé */}
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
