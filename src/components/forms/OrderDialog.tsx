import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  DollarSign,
  LoaderCircle,
  Package,
  ShoppingBag,
  Sparkles,
  Truck,
  User,
  X,
} from 'lucide-react'
import { useCrm } from '@/contexts/CrmContext'
import { createOrder, ORDER_STAGE_LABELS } from '@/services/crm'
import type { Contact, Order, OrderStage } from '@/types/crm'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface OrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetStage?: OrderStage
  presetContactId?: string
  onCreated?: (order: Order) => void
}

export function OrderDialog({
  open,
  onOpenChange,
  presetStage = 'pedido_feito',
  presetContactId,
  onCreated,
}: OrderDialogProps) {
  const { contacts, refresh } = useCrm()
  const { toast } = useToast()

  const [contactId, setContactId] = useState(presetContactId || '')
  const [title, setTitle] = useState('')
  const [itemsDescription, setItemsDescription] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<OrderStage>(presetStage)
  const [trackingCode, setTrackingCode] = useState('')
  const [notes, setNotes] = useState('')
  const [registerPurchase, setRegisterPurchase] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setContactId(presetContactId || (contacts[0]?.id ?? ''))
      setStage(presetStage)
      setTitle('')
      setItemsDescription('')
      setValue('')
      setTrackingCode('')
      setNotes('')
      setRegisterPurchase(true)
    }
  }, [open, presetContactId, presetStage, contacts])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactId) {
      toast({
        variant: 'destructive',
        title: 'Selecione um cliente',
        description: 'Todo pedido precisa ser vinculado a um cliente.',
      })
      return
    }
    if (!title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Título obrigatório',
        description: 'Informe o título ou resumo do pedido.',
      })
      return
    }

    const numValue = value ? parseFloat(value.replace(',', '.')) : 0
    setSaving(true)
    try {
      const order = await createOrder({
        contactId,
        title: title.trim(),
        items_description: itemsDescription.trim(),
        value: isNaN(numValue) ? 0 : numValue,
        stage,
        tracking_code: trackingCode.trim(),
        notes: notes.trim(),
        registerPurchaseRecord: registerPurchase,
      })

      await refresh()
      toast({
        title: '📦 Pedido criado com sucesso!',
        description: `Adicionado ao funil na coluna "${ORDER_STAGE_LABELS[stage]}".`,
      })
      if (onCreated) onCreated(order)
      onOpenChange(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar pedido',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-3 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onOpenChange(false)
      }}
    >
      <div className="w-full max-w-lg animate-panel-rise rounded-xl border border-[#e5e7eb] bg-white text-[#1c1c1e] shadow-[0_20px_50px_rgba(0,0,0,.15)] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex h-13 items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-50 border border-amber-200 text-amber-600">
              <ShoppingBag className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#1c1c1e]">Novo Pedido / Negociação</h2>
              <p className="text-[10px] text-[#64748b]">
                Registre a venda e acompanhe até a avaliação no Google
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
          {/* Cliente */}
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">Cliente *</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              required
            >
              <option value="" disabled>
                Selecione o cliente...
              </option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.nickname ? `("${c.nickname}")` : ''}{' '}
                  {c.favorite_coffee ? `· ${c.favorite_coffee}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Título do Pedido */}
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">
              Título / Resumo do Pedido *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: 2x Catuaí Amarelo 250g moído V60"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Itens detalhados */}
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">
              Itens / Descrição detalhada
            </label>
            <input
              type="text"
              placeholder="Ex: 1x Microlote Frutado 250g em grãos + 1x Filtro V60 tamanho 02"
              value={itemsDescription}
              onChange={(e) => setItemsDescription(e.target.value)}
              className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
            />
          </div>

          {/* Valor e Estágio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#475569] mb-1">
                Valor Total (R$)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-[#94a3b8] font-bold text-xs">
                  R$
                </span>
                <input
                  type="text"
                  placeholder="85,00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-md border border-[#cbd5e1] bg-white pl-8 pr-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] mb-1">
                Estágio Inicial
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as OrderStage)}
                className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
              >
                <option value="pedido_feito">Pedido feito</option>
                <option value="pedido_enviado">Pedido enviado</option>
                <option value="pedido_recebido">Pedido recebido</option>
                <option value="pedir_avaliacao_google">Pedir avaliação do Google</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>

          {/* Código de Rastreio */}
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">
              Código de Rastreio / Envio (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: BR123456789SP ou Motoboy / Balcão"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500 font-mono text-[11px]"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">
              Observações do Atendimento / Detalhes Disney
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Cliente prefere pacote com laço de presente, adora notas achocolatadas."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-[#cbd5e1] p-2 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
            />
          </div>

          {/* Checkbox para sincronizar com compras / fidelidade */}
          <label className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={registerPurchase}
              onChange={(e) => setRegisterPurchase(e.target.checked)}
              className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <div className="text-[11px] text-[#475569]">
              <span className="font-bold text-amber-950 block">
                Acumular no Programa de Fidelidade & Histórico
              </span>
              Registra automaticamente o valor no histórico de compras do cliente para pontuar no
              Clube de Fidelidade Disney.
            </div>
          </label>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5e7eb]">
            <button
              type="button"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 disabled:opacity-60 transition"
            >
              {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              Criar Pedido
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
