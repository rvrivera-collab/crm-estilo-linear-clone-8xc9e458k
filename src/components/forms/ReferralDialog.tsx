import { useState, useEffect } from 'react'
import { Gift, LoaderCircle, Sparkles, UserPlus, X } from 'lucide-react'
import { createReferral, REFERRAL_STATUS_LABELS, updateReferral } from '@/services/crm'
import type { Contact, Referral, ReferralStatus } from '@/types/crm'
import { useToast } from '@/hooks/use-toast'

interface ReferralDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  referral?: Referral | null
  contacts: Contact[]
  presetReferrerId?: string
  presetStatus?: ReferralStatus
  onSaved?: (saved: Referral, wasConvertedNow: boolean) => void
}

export function ReferralDialog({
  open,
  onOpenChange,
  referral,
  contacts,
  presetReferrerId,
  presetStatus = 'indicado',
  onSaved,
}: ReferralDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [referrerId, setReferrerId] = useState(presetReferrerId || '')
  const [referrerSearch, setReferrerSearch] = useState('')
  const [referredName, setReferredName] = useState('')
  const [referredPhone, setReferredPhone] = useState('')
  const [referredEmail, setReferredEmail] = useState('')
  const [status, setStatus] = useState<ReferralStatus>(presetStatus)
  const [notes, setNotes] = useState('')

  // Sincronizar ao abrir/editar
  useEffect(() => {
    if (!open) return
    if (referral) {
      setReferrerId(referral.referrer)
      setReferredName(referral.referred_name || '')
      setReferredPhone(referral.referred_phone || '')
      setReferredEmail(referral.referred_email || '')
      setStatus(referral.status || 'indicado')
      setNotes(referral.notes || '')
    } else {
      setReferrerId(presetReferrerId || contacts[0]?.id || '')
      setReferredName('')
      setReferredPhone('')
      setReferredEmail('')
      setStatus(presetStatus)
      setNotes('')
    }
    setReferrerSearch('')
  }, [open, referral, presetReferrerId, presetStatus, contacts])

  if (!open) return null

  // Contatos filtrados na busca
  const filteredContacts = contacts.filter((c) => {
    const q = referrerSearch.toLowerCase().trim()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.referral_code && c.referral_code.toLowerCase().includes(q))
    )
  })

  const selectedReferrer = contacts.find((c) => c.id === referrerId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!referrerId) {
      toast({
        variant: 'destructive',
        title: 'Selecione quem indicou',
        description: 'É necessário indicar qual cliente da base fez a recomendação.',
      })
      return
    }
    if (!referredName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome do indicado é obrigatório',
      })
      return
    }

    setSubmitting(true)
    try {
      const wasConvertedNow =
        status === 'primeira_compra' && (!referral || referral.status !== 'primeira_compra')

      let saved: Referral
      if (referral) {
        saved = await updateReferral(referral.id, {
          referrer: referrerId,
          referred_name: referredName.trim(),
          referred_phone: referredPhone.trim(),
          referred_email: referredEmail.trim(),
          status,
          notes: notes.trim(),
        })
        toast({
          title: 'Indicação atualizada',
          description: wasConvertedNow
            ? '🎉 Primeira compra registrada! Recompensa gerada para o cliente indicador.'
            : 'Dados da indicação atualizados com sucesso.',
        })
      } else {
        saved = await createReferral({
          referrerId,
          referred_name: referredName.trim(),
          referred_phone: referredPhone.trim(),
          referred_email: referredEmail.trim(),
          status,
          notes: notes.trim(),
        })
        toast({
          title: 'Indicação registrada com sucesso!',
          description: `Novo amigo registrado e vinculado à jornada de ${selectedReferrer?.name || 'cliente'}.`,
        })
      }

      onOpenChange(false)
      if (onSaved) {
        onSaved(saved, wasConvertedNow)
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar indicação',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onOpenChange(false)
      }}
    >
      <div className="w-full max-w-lg animate-panel-rise rounded-xl border border-[#e5e7eb] bg-white text-[#1c1c1e] shadow-[0_20px_50px_rgba(0,0,0,.15)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex h-13 items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-amber-50 border border-amber-200 text-amber-700">
              <UserPlus className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#1c1c1e]">
                {referral ? 'Editar Indicação' : 'Registrar Nova Indicação'}
              </h2>
              <p className="text-[10px] text-[#64748b]">
                Conecte novos apaixonados por café especial aos clientes atuais da base
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Seletor do Cliente Indicador */}
          <div>
            <label className="block text-[11px] font-bold text-[#334155] mb-1">
              Quem indicou? (Cliente da Base) *
            </label>
            {selectedReferrer ? (
              <div className="flex items-center justify-between rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <div>
                  <span className="font-bold text-xs text-[#1c1c1e] block">
                    {selectedReferrer.name}
                  </span>
                  <span className="text-[10px] font-mono text-[#64748b]">
                    Código: <strong>{selectedReferrer.referral_code || '—'}</strong> ·{' '}
                    {selectedReferrer.phone || 'Sem telefone'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReferrerId('')}
                  className="text-[10px] text-amber-700 hover:text-amber-800 font-semibold"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={referrerSearch}
                  onChange={(e) => setReferrerSearch(e.target.value)}
                  placeholder="Buscar cliente por nome ou código..."
                  className="w-full rounded-md border border-[#cbd5e1] px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                />
                <div className="max-h-32 overflow-y-auto rounded-md border border-[#e2e8f0] bg-white divide-y divide-[#f1f5f9]">
                  {filteredContacts.length === 0 ? (
                    <div className="p-2 text-center text-[10px] text-[#94a3b8]">
                      Nenhum cliente encontrado
                    </div>
                  ) : (
                    filteredContacts.slice(0, 30).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setReferrerId(c.id)}
                        className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-amber-50 flex items-center justify-between"
                      >
                        <span className="font-medium text-[#1c1c1e] truncate">{c.name}</span>
                        <span className="text-[10px] font-mono text-amber-800">
                          {c.referral_code || 'Sem código'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dados do Novo Lead Indicado */}
          <div className="space-y-3 pt-1">
            <h3 className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              Novo Amigo / Lead Indicado
            </h3>

            <div>
              <label className="block text-[11px] font-semibold text-[#334155] mb-1">
                Nome completo *
              </label>
              <input
                type="text"
                required
                value={referredName}
                onChange={(e) => setReferredName(e.target.value)}
                placeholder="Ex.: Mariana Fernandes"
                className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#334155] mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={referredPhone}
                  onChange={(e) => setReferredPhone(e.target.value)}
                  placeholder="Ex.: (11) 98765-4321"
                  className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#334155] mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={referredEmail}
                  onChange={(e) => setReferredEmail(e.target.value)}
                  placeholder="Ex.: mariana@email.com"
                  className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Estágio da Indicação */}
            <div>
              <label className="block text-[11px] font-semibold text-[#334155] mb-1">
                Estágio da Indicação
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(
                  [
                    'indicado',
                    'primeiro_contato',
                    'primeira_compra',
                    'cancelado',
                  ] as ReferralStatus[]
                ).map((st) => {
                  const isSelected = status === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`p-2 rounded-lg border text-left transition text-xs font-semibold ${
                        isSelected
                          ? st === 'primeira_compra'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400'
                            : 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-400'
                          : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <span className="block truncate">{REFERRAL_STATUS_LABELS[st]}</span>
                      {st === 'primeira_compra' && (
                        <span className="text-[9px] font-mono text-emerald-700 block mt-0.5">
                          ⭐ Gera cupom!
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-[11px] font-semibold text-[#334155] mb-1">
                Observações de atendimento (gostos, preparo de café, detalhes Disney)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Prefere cafés florais, usa prensa francesa em casa e foi indicada para a degustação de sábado."
                className="w-full rounded-md border border-[#cbd5e1] p-2.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {status === 'primeira_compra' && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-3 flex items-start gap-2.5">
              <Sparkles className="size-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-950">
                <p className="font-bold">Recompensa Automática Disney Ativada!</p>
                <p className="mt-0.5 text-emerald-800">
                  Ao salvar como <strong>Primeira compra (Convertido)</strong>, o sistema criará o
                  cupom exclusivo de recompensa <strong>INDICOU-XXXX</strong> para o cliente que
                  indicou e sugerirá a mensagem pré-pronta para você enviar via WhatsApp!
                </p>
              </div>
            </div>
          )}

          {/* Rodapé do Form */}
          <div className="pt-3 border-t border-[#e5e7eb] flex items-center justify-between">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-white"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-600 transition disabled:opacity-60"
            >
              {submitting ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              {referral ? 'Atualizar Indicação' : 'Salvar Indicação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
