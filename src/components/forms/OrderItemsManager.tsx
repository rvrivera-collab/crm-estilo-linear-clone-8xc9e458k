import { useState, useMemo } from 'react'
import {
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingBag,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react'
import type { OrderItem, Product } from '@/types/crm'
import { cn } from '@/lib/utils'

interface OrderItemsManagerProps {
  items: OrderItem[]
  onChange: (items: OrderItem[]) => void
  products: Product[]
  productsLoading?: boolean
  manualFallbackText?: string
  onManualFallbackTextChange?: (text: string) => void
}

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const CATEGORY_LABELS: Record<string, string> = {
  cafe_250g: 'Café 250g',
  cafe_500g: 'Café 500g',
  drip_coffee: 'Drip Coffee',
  capsula: 'Cápsulas',
  caneca: 'Caneca',
  camisa: 'Camisa',
  chaveiro: 'Chaveiro',
  outro: 'Outro',
}

export function OrderItemsManager({
  items,
  onChange,
  products,
  productsLoading = false,
  manualFallbackText = '',
  onManualFallbackTextChange,
}: OrderItemsManagerProps) {
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [manualQuantity, setManualQuantity] = useState('1')

  const activeProducts = useMemo(() => {
    return products.filter((p) => p.active !== false)
  }, [products])

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return activeProducts
    const q = search.toLowerCase().trim()
    return activeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (CATEGORY_LABELS[p.category] || '').toLowerCase().includes(q),
    )
  }, [activeProducts, search])

  const totalCalculated = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.total || item.unit_price * item.quantity), 0)
  }, [items])

  const handleAddProductFromCatalog = (product: Product) => {
    const existingIndex = items.findIndex((i) => i.product_id === product.id)
    if (existingIndex >= 0) {
      // Incrementa quantidade
      const updated = [...items]
      const current = updated[existingIndex]
      const nextQty = current.quantity + 1
      updated[existingIndex] = {
        ...current,
        quantity: nextQty,
        total: nextQty * current.unit_price,
      }
      onChange(updated)
    } else {
      const unitPrice = Number(product.sale_price) || 0
      const newItem: OrderItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: unitPrice,
        total: unitPrice,
      }
      onChange([...items, newItem])
    }
  }

  const handleAddManualItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!manualName.trim()) return
    const priceNum = manualPrice ? parseFloat(manualPrice.replace(',', '.')) : 0
    const qtyNum = Math.max(1, parseInt(manualQuantity, 10) || 1)
    const unitPrice = isNaN(priceNum) ? 0 : priceNum

    const newItem: OrderItem = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: manualName.trim(),
      quantity: qtyNum,
      unit_price: unitPrice,
      total: unitPrice * qtyNum,
    }

    onChange([...items, newItem])
    setManualName('')
    setManualPrice('')
    setManualQuantity('1')
    setShowManualForm(false)
  }

  const handleUpdateQuantity = (id: string, delta: number) => {
    const updated = items
      .map((item) => {
        if (item.id !== id) return item
        const nextQty = item.quantity + delta
        if (nextQty <= 0) return null
        return {
          ...item,
          quantity: nextQty,
          total: nextQty * item.unit_price,
        }
      })
      .filter((item): item is OrderItem => item !== null)
    onChange(updated)
  }

  const handleRemoveItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const handleUpdateItemPrice = (id: string, newPriceStr: string) => {
    const priceNum = parseFloat(newPriceStr.replace(',', '.'))
    const unitPrice = isNaN(priceNum) ? 0 : Math.max(0, priceNum)
    const updated = items.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        unit_price: unitPrice,
        total: item.quantity * unitPrice,
      }
    })
    onChange(updated)
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#e6dbc9] bg-[#fbf9f5] p-3 text-xs">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#2b1c13]">
          <ShoppingBag className="size-3.5 text-[#8c531b]" />
          <span>Itens do Pedido (Catálogo de Produtos)</span>
        </label>
        <span className="text-[10px] text-[#705e4d]">
          {items.length} {items.length === 1 ? 'item' : 'itens'} adicionado(s)
        </span>
      </div>

      {/* Seletor rápido de produtos ativos do catálogo */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Select de produtos */}
          <div className="flex-1">
            <select
              value={selectedProductId}
              onChange={(e) => {
                const prodId = e.target.value
                setSelectedProductId(prodId)
                if (prodId) {
                  const prod = activeProducts.find((p) => p.id === prodId)
                  if (prod) {
                    handleAddProductFromCatalog(prod)
                    setSelectedProductId('')
                  }
                }
              }}
              disabled={productsLoading}
              className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
            >
              <option value="">
                {productsLoading
                  ? 'Carregando catálogo...'
                  : '➕ Selecionar produto do catálogo...'}
              </option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {moneyFormatter.format(p.sale_price || 0)}
                  {p.category ? ` (${CATEGORY_LABELS[p.category] || p.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowManualForm(!showManualForm)}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-[#ded2c3] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#6f4b27] hover:bg-[#f3ece0] transition shrink-0"
          >
            <Plus className="size-3.5" />
            <span>Item fora do catálogo</span>
          </button>
        </div>

        {/* Formulário inline para item manual */}
        {showManualForm && (
          <div className="rounded-md border border-amber-300 bg-amber-50/60 p-2.5 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-900">
              <span>Novo item manual (produto personalizado)</span>
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="text-amber-700 hover:text-amber-900"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="Nome do produto ou serviço (ex: Filtro Hario V60)"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="sm:col-span-6 rounded border border-amber-300 bg-white px-2 py-1 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
              />
              <div className="sm:col-span-3 flex items-center gap-1">
                <span className="text-[10px] text-amber-900 font-bold shrink-0">R$</span>
                <input
                  type="text"
                  placeholder="Preço (ex: 45,00)"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-1">
                <span className="text-[10px] text-amber-900 font-bold shrink-0">Qtd</span>
                <input
                  type="number"
                  min="1"
                  value={manualQuantity}
                  onChange={(e) => setManualQuantity(e.target.value)}
                  className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs text-[#1c1c1e] outline-none focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-1 flex items-center">
                <button
                  type="button"
                  onClick={() => handleAddManualItem()}
                  disabled={!manualName.trim()}
                  className="w-full h-full min-h-[28px] rounded bg-[#8c531b] hover:bg-[#724113] text-white font-bold text-xs disabled:opacity-50 transition"
                  title="Adicionar item"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de itens escolhidos */}
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#ded2c3] bg-white/70 p-3 text-center text-[11px] text-[#8c7865]">
          <p>Nenhum produto adicionado ainda.</p>
          <p className="text-[10px] text-[#a4917f] mt-0.5">
            Selecione um café ou item do catálogo acima para calcular o valor automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[#e8ded1] bg-white p-2 text-xs shadow-2xs hover:border-[#cfbca8] transition"
            >
              {/* Nome do item e indicação de catálogo/manual */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#1c1c1e] truncate">{item.name}</span>
                  {item.product_id ? (
                    <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold px-1 py-0.2 shrink-0">
                      Catálogo
                    </span>
                  ) : (
                    <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold px-1 py-0.2 shrink-0">
                      Manual
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#705e4d] font-mono mt-0.5">
                  {moneyFormatter.format(item.unit_price)} un.
                </div>
              </div>

              {/* Controle de quantidade +/- (toque confortável no mobile) */}
              <div className="flex items-center gap-1 shrink-0 bg-[#f7efe0] border border-[#e8d5be] rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => handleUpdateQuantity(item.id, -1)}
                  className="size-6 grid place-items-center rounded bg-white text-[#5c3e21] hover:bg-[#ede1ce] active:bg-[#ded2c3] transition"
                  title="Diminuir quantidade"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-6 text-center font-bold text-xs text-[#2b1c13] font-mono">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateQuantity(item.id, 1)}
                  className="size-6 grid place-items-center rounded bg-white text-[#5c3e21] hover:bg-[#ede1ce] active:bg-[#ded2c3] transition"
                  title="Aumentar quantidade"
                >
                  <Plus className="size-3" />
                </button>
              </div>

              {/* Subtotal do item */}
              <div className="w-20 text-right font-mono font-bold text-xs text-[#2b1c13] shrink-0">
                {moneyFormatter.format(item.total)}
              </div>

              {/* Remover item */}
              <button
                type="button"
                onClick={() => handleRemoveItem(item.id)}
                className="size-6 grid place-items-center rounded text-[#a08973] hover:text-red-600 hover:bg-red-50 transition shrink-0"
                title="Remover item"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}

          {/* Barra de resumo da soma dos itens */}
          <div className="flex items-center justify-between rounded-md bg-[#f2e7d5] border border-[#e1d0bc] px-3 py-1.5 text-xs font-semibold text-[#3d2716]">
            <span>Soma calculada dos itens:</span>
            <span className="font-mono text-sm font-extrabold text-[#724113]">
              {moneyFormatter.format(totalCalculated)}
            </span>
          </div>
        </div>
      )}

      {/* Campo de compatibilidade com pedidos legados (texto livre) se houver texto antigo */}
      {manualFallbackText && items.length === 0 && (
        <div className="rounded border border-dashed border-[#ded2c3] bg-white p-2 text-[11px] text-[#64748b]">
          <span className="font-semibold text-[#2b1c13] block">Texto original do pedido:</span>
          <span>{manualFallbackText}</span>
        </div>
      )}
    </div>
  )
}
