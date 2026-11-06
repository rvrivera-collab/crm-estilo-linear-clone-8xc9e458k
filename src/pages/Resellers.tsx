import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Coffee, Edit3, Plus, Store, Tag, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import {
  createReseller,
  deleteResalePrice,
  deleteReseller,
  listProducts,
  listResalePrices,
  listResellers,
  updateReseller,
  upsertResalePrice,
} from '@/services/crm'
import { PRODUCT_CATEGORY_LABELS, type Product, type ResalePrice, type Reseller } from '@/types/crm'

interface ResellerForm {
  name: string
  contact_name: string
  phone: string
  city: string
  notes: string
  active: boolean
  products: string[]
}

const EMPTY_RESELLER: ResellerForm = {
  name: '',
  contact_name: '',
  phone: '',
  city: '',
  notes: '',
  active: true,
  products: [],
}

function toNumber(value: string): number | null {
  const clean = value.replace(/\s/g, '').replace(',', '.')
  if (!clean) return null
  const parsed = Number(clean)
  return isNaN(parsed) ? null : parsed
}

function formatPrice(value?: number | null): string {
  if (value === undefined || value === null || isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(value))
}

export default function Resellers() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [resellers, setResellers] = useState<Reseller[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [prices, setPrices] = useState<ResalePrice[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Reseller | null>(null)
  const [detail, setDetail] = useState<Reseller | null>(null)
  const [deleting, setDeleting] = useState<Reseller | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function load() {
    try {
      const [r, p, pricesAll] = await Promise.all([
        listResellers(),
        listProducts(),
        listResalePrices(),
      ])
      setResellers(r)
      setProducts(p)
      setPrices(pricesAll)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar pontos de revenda',
        description: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return resellers
    return resellers.filter((r) =>
      `${r.name} ${r.city || ''} ${r.contact_name || ''} ${r.phone || ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [resellers, query])

  const activeCount = resellers.filter((r) => r.active).length
  const pricedProductIds = new Set(prices.map((p) => p.product))
  const pricedCount = pricedProductIds.size

  async function handleDelete() {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteReseller(deleting.id)
      setResellers((rows) => rows.filter((r) => r.id !== deleting.id))
      setPrices((rows) => rows.filter((p) => p.reseller !== deleting.id))
      toast({
        title: 'Ponto de revenda excluído',
        description: `${deleting.name} foi removido.`,
      })
      if (detail?.id === deleting.id) setDetail(null)
      setDeleting(null)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir ponto',
        description: getErrorMessage(error),
      })
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleToggleActive(reseller: Reseller) {
    try {
      const updated = await updateReseller(reseller.id, { active: !reseller.active })
      setResellers((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))
      if (detail?.id === updated.id) setDetail(updated)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar ponto',
        description: getErrorMessage(error),
      })
    }
  }

  function handleSaved(saved: Reseller) {
    setResellers((rows) => {
      const exists = rows.some((r) => r.id === saved.id)
      return exists ? rows.map((r) => (r.id === saved.id ? saved : r)) : [...rows, saved]
    })
    if (detail?.id === saved.id) setDetail(saved)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#faf7f2]">
      {/* Header Linear */}
      <div className="shrink-0 border-b border-[#ded2c3] bg-[#fbf9f5] px-4 pb-3 pt-4 sm:px-5 shadow-2xs">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
              Revenda B2B
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#2b1c13] flex items-center gap-2">
              <Store className="size-5 text-amber-600" />
              Pontos de Revenda
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Onde os produtos são repassados e a que preço em cada parceiro.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-[11px] font-bold text-white shadow-xs transition hover:bg-amber-600"
          >
            <Plus className="size-3.5" />
            <span className="sm:inline">Novo ponto</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <div className="relative min-w-[160px] flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ponto de revenda..."
              className="h-9 w-full rounded-md border border-[#ded2c3] bg-white pl-3 pr-3 text-[12px] text-[#2b1c13] outline-none placeholder:text-[#a89582] focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <div className="flex items-center gap-3 rounded-md border border-[#ded2c3] bg-white px-3 py-1.5 text-[11px] text-[#475569]">
            <span>
              <strong className="text-[#2b1c13]">{activeCount}</strong> ativo
              {activeCount === 1 ? '' : 's'}
            </span>
            <span className="h-3 w-px bg-[#e8ddd0]" />
            <span>
              <strong className="text-[#2b1c13]">{pricedCount}</strong> produto
              {pricedCount === 1 ? '' : 's'} com repasse
            </span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[#64748b]">
          {resellers.length} ponto{resellers.length === 1 ? '' : 's'} cadastrado
          {resellers.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-lg border border-[#e8ddd0] bg-white/70"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center rounded-lg border border-dashed border-[#ded2c3] bg-white/60 px-6 py-14 text-center">
            <Store className="mb-3 size-8 text-[#c9b8a5]" />
            <p className="text-sm font-semibold text-[#2b1c13]">
              {resellers.length === 0 ? 'Nenhum ponto de revenda ainda' : 'Nada encontrado'}
            </p>
            <p className="mt-1 max-w-xs text-xs text-[#64748b]">
              {resellers.length === 0
                ? 'Cadastre o primeiro parceiro — padaria, empório, cafeteria — e defina os preços de repasse.'
                : 'Ajuste a busca.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((reseller) => {
              const resellerPrices = prices.filter((p) => p.reseller === reseller.id)
              return (
                <button
                  key={reseller.id}
                  onClick={() => setDetail(reseller)}
                  className={cn(
                    'flex flex-col rounded-lg border border-[#e8ddd0] bg-white p-3.5 text-left shadow-2xs transition hover:shadow-sm',
                    !reseller.active && 'bg-[#faf7f2] opacity-70',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="truncate text-[13px] font-bold text-[#2b1c13]"
                      title={reseller.name}
                    >
                      {reseller.name}
                    </span>
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-[#8c7a68]" />
                  </div>
                  <p className="mt-1 text-[11px] text-[#64748b]">
                    {reseller.contact_name || '—'}
                    {reseller.phone ? ` · ${reseller.phone}` : ''}
                  </p>
                  {reseller.city && (
                    <p className="mt-0.5 text-[11px] text-[#64748b]">📍 {reseller.city}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded border border-amber-300/60 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                        <Tag className="size-2.5" />
                        {resellerPrices.length} preço{resellerPrices.length === 1 ? '' : 's'}
                      </span>
                      {(reseller.products?.length || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded border border-[#e8ddd0] bg-[#fbf9f5] px-1.5 py-0.5 text-[9px] font-bold text-[#8c531b]">
                          <Coffee className="size-2.5" />
                          {reseller.products?.length} produto
                          {reseller.products?.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {!reseller.active && (
                      <span className="rounded bg-[#f1ece5] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#8c7a68]">
                        Inativo
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {dialogOpen && (
        <ResellerDialog
          open={dialogOpen}
          reseller={editing}
          products={products}
          prices={prices}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSaved={handleSaved}
          ownerId={user?.id}
        />
      )}

      {detail && (
        <ResellerDetail
          reseller={detail}
          products={products}
          prices={prices.filter((p) => p.reseller === detail.id)}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail)
            setDetail(null)
            setDialogOpen(true)
          }}
          onPricesChanged={(resellerId, updatedRows) => {
            setPrices((rows) => {
              const others = rows.filter((p) => p.reseller !== resellerId)
              return [...others, ...updatedRows]
            })
          }}
          onResellerUpdated={(updated) => {
            setResellers((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))
            setDetail(updated)
          }}
          onToggleActive={handleToggleActive}
          onDelete={() => setDeleting(detail)}
        />
      )}

      {/* Confirmação de exclusão */}
      {deleting && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) setDeleting(null)
          }}
        >
          <div className="w-full max-w-sm animate-panel-rise rounded-[10px] border border-[#e5e7eb] bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,.15)]">
            <h2 className="text-sm font-extrabold text-[#1c1c1e]">Excluir ponto de revenda?</h2>
            <p className="mt-1 text-xs text-[#64748b]">
              <strong className="text-[#2b1c13]">{deleting.name}</strong> e todos os seus preços de
              repasse serão removidos.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="h-8 rounded-md border border-[#e2e8f0] px-3 text-[11px] font-medium text-[#475569] hover:bg-[#f1f5f9]"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBusy}
                className="flex h-8 items-center gap-1.5 rounded-md bg-red-600 px-3 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// Drawer de detalhe: preços de repasse por produto
// ==========================================

function ResellerDetail({
  reseller,
  products,
  prices,
  onClose,
  onEdit,
  onPricesChanged,
  onResellerUpdated,
  onToggleActive,
  onDelete,
}: {
  reseller: Reseller
  products: Product[]
  prices: ResalePrice[]
  onClose: () => void
  onEdit: () => void
  onPricesChanged: (resellerId: string, updated: ResalePrice[]) => void
  onResellerUpdated: (updated: Reseller) => void
  onToggleActive: (r: Reseller) => void
  onDelete: () => void
}) {
  const { toast } = useToast()
  const [busyProduct, setBusyProduct] = useState<string | null>(null)
  const [savingProducts, setSavingProducts] = useState(false)
  const selectedProductIds = reseller.products || []

  const priceByProduct = new Map(prices.map((p) => [p.product, p]))

  async function toggleResoldProduct(productId: string) {
    if (savingProducts) return
    const current = reseller.products || []
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]

    setSavingProducts(true)
    try {
      const updated = await updateReseller(reseller.id, { products: next })
      onResellerUpdated(updated)
      const prodName = products.find((p) => p.id === productId)?.name || 'Produto'
      toast({
        title: next.includes(productId)
          ? 'Produto adicionado à revenda'
          : 'Produto removido da revenda',
        description: `${prodName} ${next.includes(productId) ? 'marcado como revendido' : 'desmarcado'} em ${reseller.name}.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar produtos',
        description: getErrorMessage(error),
      })
    } finally {
      setSavingProducts(false)
    }
  }

  // Produtos ativos primeiro, depois inativos; dentro de cada grupo por nome
  const sortedProducts = [...products].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  async function savePrice(product: Product, raw: string, notes?: string) {
    if (busyProduct) return
    const price = toNumber(raw)
    if (price === null || price < 0) {
      toast({
        variant: 'destructive',
        title: 'Preço inválido',
        description: 'Informe um valor numérico maior ou igual a zero.',
      })
      return
    }
    setBusyProduct(product.id)
    try {
      const saved = await upsertResalePrice({
        resellerId: reseller.id,
        productId: product.id,
        price,
        notes,
      })
      onPricesChanged(reseller.id, [saved])
      toast({
        title: 'Preço de repasse salvo',
        description: `${product.name}: ${formatPrice(price)} em ${reseller.name}.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar preço',
        description: getErrorMessage(error),
      })
    } finally {
      setBusyProduct(null)
    }
  }

  async function removePrice(row: ResalePrice) {
    try {
      await deleteResalePrice(row.id)
      onPricesChanged(
        reseller.id,
        prices.filter((p) => p.id !== row.id),
      )
      toast({ title: 'Preço removido' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover preço',
        description: getErrorMessage(error),
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-black/30 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[#e5e7eb] bg-[#fbf9f5] shadow-2xl animate-panel-rise">
        <div className="shrink-0 border-b border-[#e5e7eb] px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
                Ponto de revenda
              </p>
              <h2 className="mt-0.5 truncate text-base font-extrabold text-[#2b1c13]">
                {reseller.name}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                title="Editar ponto"
                onClick={onEdit}
                className="rounded p-1.5 text-[#8c7a68] hover:bg-[#f3ece2] hover:text-[#2b1c13]"
              >
                <Edit3 className="size-4" />
              </button>
              <button
                title={reseller.active ? 'Marcar como inativo' : 'Reativar ponto'}
                onClick={() => onToggleActive(reseller)}
                className="rounded p-1.5 text-[10px] font-bold text-[#8c7a68] hover:bg-[#f3ece2] hover:text-[#2b1c13]"
              >
                {reseller.active ? 'Inativar' : 'Ativar'}
              </button>
              <button
                title="Excluir ponto"
                onClick={onDelete}
                className="rounded p-1.5 text-[#8c7a68] hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
              <button onClick={onClose} className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#64748b]">
            {reseller.contact_name && <span>👤 {reseller.contact_name}</span>}
            {reseller.phone && <span>📞 {reseller.phone}</span>}
            {reseller.city && <span>📍 {reseller.city}</span>}
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                reseller.active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f1ece5] text-[#8c7a68]',
              )}
            >
              {reseller.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          {reseller.notes && (
            <p className="mt-2 rounded border border-[#e8ddd0] bg-white px-2 py-1.5 text-[11px] leading-snug text-[#475569]">
              {reseller.notes}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          {/* Seção: Produtos revendidos neste ponto */}
          <div className="rounded-lg border border-[#e8ddd0] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Coffee className="size-3.5 text-amber-600" />
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#8c531b]">
                  Produtos revendidos neste ponto
                </p>
              </div>
              <span className="font-mono text-[10px] font-bold text-[#8c531b]">
                {selectedProductIds.length} selecionado{selectedProductIds.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#64748b]">
              Marque os produtos do catálogo que estão disponíveis para revenda neste parceiro.
            </p>

            {products.length === 0 ? (
              <p className="mt-2 text-xs text-[#8c7a68]">Nenhum produto cadastrado no catálogo.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sortedProducts.map((prod) => {
                  const isSelected = selectedProductIds.includes(prod.id)
                  const priceRow = priceByProduct.get(prod.id)
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      disabled={savingProducts}
                      onClick={() => toggleResoldProduct(prod.id)}
                      className={cn(
                        'group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95',
                        isSelected
                          ? 'border-amber-500 bg-amber-500 text-white shadow-2xs hover:bg-amber-600'
                          : 'border-[#ded2c3] bg-[#fbf9f5] text-[#475569] hover:border-amber-300 hover:bg-amber-50/50',
                        savingProducts && 'opacity-60 cursor-not-allowed',
                      )}
                      title={
                        isSelected
                          ? 'Clique para desmarcar este produto'
                          : 'Clique para marcar este produto como revendido'
                      }
                    >
                      <span
                        className={cn(
                          'grid size-3.5 place-items-center rounded-full text-[9px]',
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#e8ddd0] text-[#64748b]',
                        )}
                      >
                        {isSelected ? '✓' : '+'}
                      </span>
                      <span>{prod.name}</span>
                      {priceRow && (
                        <span
                          className={cn(
                            'font-mono text-[10px]',
                            isSelected ? 'text-amber-100 font-bold' : 'text-amber-700 font-bold',
                          )}
                        >
                          ({formatPrice(priceRow.resale_price)})
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Seção: Preços de repasse */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#8c531b]">
                Preços de repasse por produto
              </p>
              <span className="text-[10px] text-[#64748b]">
                {prices.length} cadastrado{prices.length === 1 ? '' : 's'}
              </span>
            </div>
            {products.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#ded2c3] bg-white/60 px-4 py-8 text-center text-xs text-[#64748b]">
                Cadastre produtos na aba <strong>Produtos</strong> para definir os preços de repasse
                aqui.
              </p>
            ) : (
              <div className="space-y-2">
                {sortedProducts.map((product) => {
                  const isResold = selectedProductIds.includes(product.id)
                  return (
                    <PriceRow
                      key={product.id}
                      product={product}
                      existing={priceByProduct.get(product.id)}
                      isResold={isResold}
                      busy={busyProduct === product.id}
                      onSave={(raw) => savePrice(product, raw)}
                      onRemove={
                        priceByProduct.get(product.id)
                          ? () => removePrice(priceByProduct.get(product.id)!)
                          : undefined
                      }
                      onToggleResold={() => toggleResoldProduct(product.id)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function PriceRow({
  product,
  existing,
  isResold,
  busy,
  onSave,
  onRemove,
  onToggleResold,
}: {
  product: Product
  existing?: ResalePrice
  isResold?: boolean
  busy: boolean
  onSave: (raw: string) => void
  onRemove?: () => void
  onToggleResold?: () => void
}) {
  const [value, setValue] = useState(
    existing ? String(existing.resale_price).replace('.', ',') : '',
  )
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setValue(existing ? String(existing.resale_price).replace('.', ',') : '')
    setTouched(false)
  }, [existing?.id, existing?.resale_price])

  const dirty =
    touched && value !== (existing ? String(existing.resale_price).replace('.', ',') : '')

  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 transition',
        isResold ? 'border-amber-300/80 bg-amber-50/20' : 'border-[#e8ddd0] bg-white',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="truncate text-[12px] font-bold text-[#2b1c13]">{product.name}</p>
            {isResold && (
              <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                Revendido
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#64748b]">
            {PRODUCT_CATEGORY_LABELS[product.category] || product.category} · venda{' '}
            {formatPrice(product.sale_price)}
            {existing ? ` · desde ${dateShort(existing.set_at)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleResold && (
            <button
              type="button"
              onClick={onToggleResold}
              className={cn(
                'rounded px-1.5 py-1 text-[10px] font-bold transition',
                isResold
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'border border-[#ded2c3] bg-white text-[#64748b] hover:bg-[#fbf9f5] hover:text-[#2b1c13]',
              )}
              title={isResold ? 'Desmarcar como revendido' : 'Marcar como revendido'}
            >
              {isResold ? '✓ Revendido' : '+ Marcar revenda'}
            </button>
          )}
          {onRemove && (
            <button
              title="Remover preço de repasse"
              onClick={onRemove}
              className="rounded p-1 text-[#8c7a68] hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          inputMode="decimal"
          value={value}
          placeholder="Ex: 32,00"
          onChange={(e) => {
            setValue(e.target.value)
            setTouched(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSave(value)
            }
          }}
          className="h-8 w-28 rounded-md border border-[#ded2c3] bg-[#fbf9f5] px-2 text-right text-[12px] font-bold text-[#2b1c13] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
        <button
          onClick={() => onSave(value)}
          disabled={busy || (!touched && !!existing)}
          className={cn(
            'h-8 rounded-md px-2.5 text-[10px] font-bold transition',
            dirty
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'border border-[#e2e8f0] text-[#475569] hover:bg-[#f1f5f9]',
          )}
        >
          {busy ? 'Salvando...' : existing ? 'Atualizar' : 'Definir'}
        </button>
      </div>
    </div>
  )
}

function dateShort(value?: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d)
}

// ==========================================
// Dialog criar/editar ponto de revenda
// ==========================================

function ResellerDialog({
  open,
  reseller,
  products = [],
  prices = [],
  onClose,
  onSaved,
  ownerId,
}: {
  open: boolean
  reseller: Reseller | null
  products?: Product[]
  prices?: ResalePrice[]
  onClose: () => void
  onSaved: (reseller: Reseller) => void
  ownerId?: string
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<ResellerForm>(EMPTY_RESELLER)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setBusy(false)
    setForm(
      reseller
        ? {
            name: reseller.name || '',
            contact_name: reseller.contact_name || '',
            phone: reseller.phone || '',
            city: reseller.city || '',
            notes: reseller.notes || '',
            active: reseller.active !== false,
            products: reseller.products || [],
          }
        : EMPTY_RESELLER,
    )
  }, [open, reseller])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Informe o nome do parceiro/loja.'
    if (Object.keys(next).length) return setErrors(next)

    setBusy(true)
    setErrors({})
    try {
      const data = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        notes: form.notes.trim(),
        active: form.active,
        products: form.products,
        owner: reseller?.owner || ownerId,
      }
      const saved = reseller ? await updateReseller(reseller.id, data) : await createReseller(data)
      onSaved(saved)
      toast({
        title: reseller ? 'Ponto atualizado' : 'Ponto criado',
        description: `${saved.name} foi salvo com sucesso.`,
      })
      onClose()
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(Object.keys(fields).length ? fields : { form: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 backdrop-blur-[2px] p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg animate-panel-rise rounded-t-[12px] border border-[#e5e7eb] bg-white text-[#1c1c1e] shadow-[0_18px_50px_rgba(0,0,0,.15)] sm:rounded-[10px]"
      >
        <div className="flex h-12 items-center border-b border-[#e5e7eb] px-4">
          <h2 className="flex-1 text-sm font-extrabold text-[#1c1c1e]">
            {reseller ? 'Editar ponto de revenda' : 'Novo ponto de revenda'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto p-4 sm:max-h-none sm:grid-cols-2">
          <Field label="Nome do parceiro / loja *" error={errors.name} className="sm:col-span-2">
            <input
              autoFocus
              value={form.name}
              placeholder="Ex: Padaria Pão Quente"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Contato" error={errors.contact_name}>
            <input
              value={form.contact_name}
              placeholder="Ex: João Pereira"
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </Field>
          <Field label="Telefone" error={errors.phone}>
            <input
              value={form.phone}
              placeholder="+55 11 3000-0000"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Cidade" error={errors.city}>
            <input
              value={form.city}
              placeholder="Ex: São Paulo / SP"
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-4 accent-amber-500"
            />
            <span className="text-[11px] font-semibold text-[#475569]">
              Ponto ativo (compra/repassa produtos atualmente)
            </span>
          </label>

          {/* Produtos revendidos */}
          <div className="sm:col-span-2 rounded-lg border border-[#e8ddd0] bg-[#fbf9f5] p-3">
            <div className="flex items-center justify-between">
              <span className="block text-[11px] font-semibold text-[#475569]">
                Produtos revendidos neste ponto
              </span>
              <span className="font-mono text-[10px] font-bold text-[#8c531b]">
                {form.products.length} selecionado{form.products.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-[#64748b]">
              Marque os produtos que este parceiro compra para revender:
            </p>
            {products.length === 0 ? (
              <p className="mt-2 text-xs text-[#8c7a68]">Nenhum produto cadastrado no catálogo.</p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {products.map((prod) => {
                  const selected = form.products.includes(prod.id)
                  const priceRow = reseller
                    ? prices.find((p) => p.reseller === reseller.id && p.product === prod.id)
                    : undefined
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? form.products.filter((id) => id !== prod.id)
                          : [...form.products, prod.id]
                        setForm({ ...form, products: next })
                      }}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95',
                        selected
                          ? 'border-amber-500 bg-amber-500 text-white shadow-2xs hover:bg-amber-600'
                          : 'border-[#ded2c3] bg-white text-[#475569] hover:border-amber-300 hover:bg-amber-50/50',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-3.5 place-items-center rounded-full text-[9px]',
                          selected ? 'bg-white/20 text-white' : 'bg-[#e8ddd0] text-[#64748b]',
                        )}
                      >
                        {selected ? '✓' : '+'}
                      </span>
                      <span>{prod.name}</span>
                      {priceRow && (
                        <span
                          className={cn(
                            'font-mono text-[10px]',
                            selected ? 'text-amber-100 font-bold' : 'text-amber-700 font-bold',
                          )}
                        >
                          ({formatPrice(priceRow.resale_price)})
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <Field label="Observações" error={errors.notes} className="sm:col-span-2">
            <textarea
              rows={3}
              value={form.notes}
              placeholder="Condições combinadas, histórico de negociação, preferências do parceiro..."
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          {errors.form && <p className="sm:col-span-2 text-xs text-red-600">{errors.form}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e5e7eb] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-[#e2e8f0] px-3 text-[11px] font-medium text-[#475569] hover:bg-[#f1f5f9]"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            className="flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-[11px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60 shadow-xs"
          >
            {reseller ? 'Salvar alterações' : 'Criar ponto'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  error,
  children,
  className = '',
}: {
  label: string
  error?: string
  children: React.ReactElement
  className?: string
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[11px] font-semibold text-[#475569]">{label}</span>
      <span className="crm-field-control block">{children}</span>
      {error && <span className="mt-1 block text-[10px] text-red-600">{error}</span>}
    </label>
  )
}
