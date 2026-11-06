import { useState, useEffect, useMemo } from 'react'
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
  Pencil,
  Calculator,
} from 'lucide-react'
import { useCrm } from '@/contexts/CrmContext'
import {
  createOrder,
  updateOrder,
  listProducts,
  createContact,
  ORDER_STAGE_LABELS,
} from '@/services/crm'
import type { Contact, Order, OrderStage, OrderItem, Product } from '@/types/crm'
import type { LoyaltyProgressResult } from '@/services/crm'
import { useToast } from '@/hooks/use-toast'
import { OrderItemsManager } from './OrderItemsManager'
import { ContactAutocomplete } from './ContactAutocomplete'
import { cn } from '@/lib/utils'

interface OrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order?: Order | null
  presetStage?: OrderStage
  presetContactId?: string
  onCreated?: (order: Order) => void
  onUpdated?: (order: Order) => void
}

export function OrderDialog({
  open,
  onOpenChange,
  order,
  presetStage = 'pedido_feito',
  presetContactId,
  onCreated,
  onUpdated,
}: OrderDialogProps) {
  const { contacts, refresh } = useCrm()
  const { toast } = useToast()

  const isEditing = Boolean(order?.id)

  const [contactId, setContactId] = useState(presetContactId || '')
  const [title, setTitle] = useState('')
  const [itemsDescription, setItemsDescription] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<OrderStage>(presetStage)
  const [trackingCode, setTrackingCode] = useState('')
  const [notes, setNotes] = useState('')
  const [registerPurchase, setRegisterPurchase] = useState(true)
  const [saving, setSaving] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)

  // Carregar produtos quando o diálogo for aberto
  useEffect(() => {
    if (open) {
      setProductsLoading(true)
      listProducts()
        .then((prods) => setProducts(prods))
        .catch(() => setProducts([]))
        .finally(() => setProductsLoading(false))
    }
  }, [open])

  useEffect(() => {
    if (open) {
      if (order) {
        setContactId(order.contact || '')
        setStage(order.stage || 'pedido_feito')
        setTitle(order.title || '')
        setItemsDescription(order.items_description || '')
        const loadedItems = Array.isArray(order.items) ? order.items : []
        setItems(loadedItems)
        setValue(order.value !== undefined && order.value !== null ? String(order.value) : '')
        setTrackingCode(order.tracking_code || '')
        setNotes(order.notes || '')
        setRegisterPurchase(false)
      } else {
        setContactId(presetContactId || '')
        setStage(presetStage)
        setTitle('')
        setItemsDescription('')
        setItems([])
        setValue('')
        setTrackingCode('')
        setNotes('')
        setRegisterPurchase(true)
      }
    }
  }, [open, order, presetContactId, presetStage])

  // Cadastro rápido de cliente avulso caso o usuário digite um nome que ainda não existe na base
  const handleCreateQuickContact = async (name: string): Promise<Contact | null> => {
    try {
      const created = await createContact({
        name: name.trim(),
        acquisition_channel: 'balcao',
        status: 'ativo',
        notes: 'Cliente avulso cadastrado rapidamente pelo lançamento de pedido.',
      })
      await refresh()
      toast({
        title: '👤 Cliente avulso cadastrado!',
        description: `"${created.name}" foi adicionado à base e vinculado a este pedido.`,
      })
      return created
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar cliente',
        description: err instanceof Error ? err.message : 'Não foi possível cadastrar o cliente.',
      })
      return null
    }
  }

  // Atualizar valor total e gerar título/resumo automático se o usuário estiver montando itens
  const handleItemsChange = (newItems: OrderItem[]) => {
    setItems(newItems)
    const newTotal = newItems.reduce(
      (sum, item) => sum + (item.total || item.unit_price * item.quantity),
      0,
    )
    if (newItems.length > 0) {
      // Atualiza o valor total automaticamente
      setValue(newTotal > 0 ? newTotal.toFixed(2).replace('.', ',') : '')

      // Se o título do pedido estiver vazio ou se já era gerado a partir dos itens,
      // sugere automaticamente um resumo limpo (ex: "2x Cápsulas + 1x Café 250g")
      const summaryText = newItems.map((i) => `${i.quantity}x ${i.name}`).join(' + ')
      setItemsDescription(summaryText)

      if (!title.trim() || title.includes('x ')) {
        setTitle(summaryText)
      }
    }
  }

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
      // Se não preencheu items_description explicitamente mas tem items estruturados,
      // gera a descrição a partir deles
      const finalItemsDescription =
        itemsDescription.trim() ||
        (items.length > 0 ? items.map((i) => `${i.quantity}x ${i.name}`).join(' + ') : '')

      if (isEditing && order) {
        const updated = await updateOrder(order.id, {
          contact: contactId,
          title: title.trim(),
          items_description: finalItemsDescription,
          items: items,
          value: isNaN(numValue) ? 0 : numValue,
          stage,
          tracking_code: trackingCode.trim(),
          notes: notes.trim(),
        })

        await refresh()
        toast({
          title: '✏️ Pedido atualizado!',
          description: `Alterações salvas com sucesso na coluna "${ORDER_STAGE_LABELS[stage]}".`,
        })
        if (onUpdated) onUpdated(updated)
        onOpenChange(false)
      } else {
        const created = await createOrder({
          contactId,
          title: title.trim(),
          items_description: finalItemsDescription,
          items: items,
          value: isNaN(numValue) ? 0 : numValue,
          stage,
          tracking_code: trackingCode.trim(),
          notes: notes.trim(),
          registerPurchaseRecord: registerPurchase,
        })

        await refresh()
        // Confirmação discreta do disparo automático da mensagem de progresso de fidelidade
        let progressSuffix = ''
        const lp = (created as Order & { loyaltyProgress?: LoyaltyProgressResult }).loyaltyProgress
        if (lp) {
          if (lp.skipped === 'no-phone') {
            progressSuffix = ' Cliente sem WhatsApp cadastrado — mensagem automática não enviada.'
          } else if (lp.skipped === 'disabled') {
            progressSuffix = ' Mensagem automática de progresso está desligada nas Configurações.'
          } else if (lp.whatsappSent) {
            progressSuffix =
              lp.sendMethod === 'api'
                ? ' Mensagem de progresso enviada via WhatsApp API Oficial. ✅'
                : ' Mensagem de progresso pronta via link wa.me (WhatsApp Web). ✅'
          } else if (lp.attempted) {
            progressSuffix = ' Mensagem de progresso pendente — link wa.me disponível em Mensagens.'
          }
        }
        toast({
          title: '📦 Pedido criado com sucesso!',
          description: `Adicionado ao funil na coluna "${ORDER_STAGE_LABELS[stage]}".${progressSuffix}`,
        })
        if (onCreated) onCreated(created)
        onOpenChange(false)
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isEditing ? 'Erro ao atualizar pedido' : 'Erro ao criar pedido',
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
      <div className="w-full max-w-lg animate-panel-rise rounded-xl border border-[#ded2c3] bg-white text-[#1c1c1e] shadow-[0_20px_50px_rgba(0,0,0,.15)] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex h-13 items-center justify-between border-b border-[#ded2c3] bg-[#fbf9f5] px-5 py-3 rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[#f7efe0] border border-[#e8d5be] text-[#8c531b]">
              {isEditing ? <Pencil className="size-4" /> : <ShoppingBag className="size-4" />}
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#2b1c13]">
                {isEditing ? 'Editar Pedido' : 'Novo Pedido / Negociação'}
              </h2>
              <p className="text-[10px] text-[#705e4d]">
                {isEditing
                  ? 'Altere dados, itens, valor ou a etapa do pedido'
                  : 'Registre a venda e acompanhe até a avaliação no Google'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="rounded p-1.5 text-[#705e4d] hover:bg-[#f3ece0]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
          {/* Cliente com Autocomplete */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-[#475569]">Cliente *</label>
              <span className="text-[10px] text-[#705e4d]">{contacts.length} clientes na base</span>
            </div>
            <ContactAutocomplete
              contacts={contacts}
              selectedContactId={contactId}
              onSelectContact={(c) => setContactId(c.id)}
              onClear={() => setContactId('')}
              onCreateQuickContact={handleCreateQuickContact}
              required
            />
          </div>

          {/* Seção de Itens Integrada com o Catálogo de Produtos */}
          <OrderItemsManager
            items={items}
            onChange={handleItemsChange}
            products={products}
            productsLoading={productsLoading}
            manualFallbackText={itemsDescription}
            onManualFallbackTextChange={setItemsDescription}
          />

          {/* Título do Pedido */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-[#475569]">
                Título / Resumo do Pedido *
              </label>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const summary = items.map((i) => `${i.quantity}x ${i.name}`).join(' + ')
                    setTitle(summary)
                  }}
                  className="text-[10px] text-[#8c531b] hover:underline"
                >
                  Usar resumo dos itens
                </button>
              )}
            </div>
            <input
              type="text"
              required
              placeholder="Ex: 2x Catuaí Amarelo 250g moído V60"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Itens detalhados / observações dos itens (opcional) */}
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">
              Descrição complementar dos itens (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: 1x moído para Prensa Francesa, 1x em grãos"
              value={itemsDescription}
              onChange={(e) => setItemsDescription(e.target.value)}
              className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
            />
          </div>

          {/* Valor e Estágio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-[#475569]">
                  Valor Total (R$)
                </label>
                {items.length > 0 && (
                  <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                    <Calculator className="size-2.5" /> Calculado dos itens
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-[#94a3b8] font-bold text-xs">
                  R$
                </span>
                <input
                  type="text"
                  placeholder="85,00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-md border border-[#cbd5e1] bg-white pl-8 pr-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] mb-1">
                {isEditing ? 'Estágio do Funil' : 'Estágio Inicial'}
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

          {/* Checkbox para sincronizar com compras / fidelidade (apenas em novo pedido) */}
          {!isEditing && (
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
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded2c3]">
            <button
              type="button"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-[#d6c7b6] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c4735] hover:bg-[#f3ece0]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#8c531b] border border-[#6f3f12] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#724113] disabled:opacity-60 transition"
            >
              {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {isEditing ? 'Salvar Alterações' : 'Criar Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
