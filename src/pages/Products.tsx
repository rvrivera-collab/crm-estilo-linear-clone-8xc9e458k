import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Coffee, Edit3, Eye, EyeOff, Package, Plus, Search, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { createProduct, deleteProduct, listProducts, updateProduct } from '@/services/crm'
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  money,
  type Product,
  type ProductCategory,
} from '@/types/crm'

interface ProductForm {
  name: string
  category: '' | ProductCategory
  description: string
  sale_price: string
  cost: string
  stock: string
  active: boolean
}

const EMPTY_FORM: ProductForm = {
  name: '',
  category: '',
  description: '',
  sale_price: '',
  cost: '',
  stock: '',
  active: true,
}

function toNumber(value: string): number | null {
  const clean = value.replace(/\s/g, '').replace(',', '.')
  if (!clean) return null
  const parsed = Number(clean)
  return isNaN(parsed) ? null : parsed
}

function formatPrice(value?: number | null): string {
  if (value === undefined || value === null || isNaN(Number(value))) return '—'
  // money formata sem centavos (padrão do app); aqui centavos importam, então usamos Intl completo
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(value))
}

export default function Products() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'' | ProductCategory>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function load() {
    try {
      const rows = await listProducts()
      setProducts(rows)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar produtos',
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
    return products.filter((p) => {
      const text = `${p.name} ${p.description || ''} ${
        PRODUCT_CATEGORY_LABELS[p.category] || ''
      }`.toLowerCase()
      const matchesQuery = !q || text.includes(q)
      const matchesCategory = !categoryFilter || p.category === categoryFilter
      return matchesQuery && matchesCategory
    })
  }, [products, query, categoryFilter])

  const activeCount = products.filter((p) => p.active).length

  async function handleDelete() {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteProduct(deleting.id)
      setProducts((rows) => rows.filter((p) => p.id !== deleting.id))
      toast({
        title: 'Produto excluído',
        description: `${deleting.name} foi removido do catálogo.`,
      })
      setDeleting(null)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir produto',
        description: getErrorMessage(error),
      })
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleToggleActive(product: Product) {
    try {
      const updated = await updateProduct(product.id, { active: !product.active })
      setProducts((rows) => rows.map((p) => (p.id === updated.id ? updated : p)))
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar produto',
        description: getErrorMessage(error),
      })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#faf7f2]">
      {/* Header Linear */}
      <div className="shrink-0 border-b border-[#ded2c3] bg-[#fbf9f5] px-4 pb-3 pt-4 sm:px-5 shadow-2xs">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
              Catálogo
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#2b1c13] flex items-center gap-2">
              <Package className="size-5 text-amber-600" />
              Produtos
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Catálogo de cafés e brindes vendidos ao cliente final. Preços praticados na loja.
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
            <span className="sm:inline">Novo produto</span>
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8c7a68]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="h-9 w-full rounded-md border border-[#ded2c3] bg-white pl-8 pr-3 text-[12px] text-[#2b1c13] outline-none placeholder:text-[#a89582] focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as '' | ProductCategory)}
            className="h-9 rounded-md border border-[#ded2c3] bg-white px-2 text-[12px] text-[#2b1c13] outline-none focus:border-amber-400"
          >
            <option value="">Todas as categorias</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PRODUCT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <p className="mt-2 text-[11px] text-[#64748b]">
          {products.length} produto{products.length === 1 ? '' : 's'} no catálogo · {activeCount}{' '}
          ativo{activeCount === 1 ? '' : 's'}
        </p>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border border-[#e8ddd0] bg-white/70"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center rounded-lg border border-dashed border-[#ded2c3] bg-white/60 px-6 py-14 text-center">
            <Coffee className="mb-3 size-8 text-[#c9b8a5]" />
            <p className="text-sm font-semibold text-[#2b1c13]">
              {products.length === 0 ? 'Nenhum produto ainda' : 'Nada encontrado'}
            </p>
            <p className="mt-1 max-w-xs text-xs text-[#64748b]">
              {products.length === 0
                ? 'Lance o primeiro produto do catálogo — café em grãos, drip, cápsula, caneca ou o que mais você vender.'
                : 'Ajuste a busca ou o filtro de categoria.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => (
              <div key={product.id} className={cnCard(product.active)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="truncate text-[13px] font-bold text-[#2b1c13]"
                        title={product.name}
                      >
                        {product.name}
                      </span>
                    </div>
                    <span className="mt-1 inline-block rounded border border-amber-300/60 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                      {PRODUCT_CATEGORY_LABELS[product.category] || product.category}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      title={product.active ? 'Marcar como inativo' : 'Reativar produto'}
                      onClick={() => handleToggleActive(product)}
                      className="rounded p-1.5 text-[#8c7a68] transition hover:bg-[#f3ece2] hover:text-[#2b1c13]"
                    >
                      {product.active ? (
                        <Eye className="size-3.5" />
                      ) : (
                        <EyeOff className="size-3.5" />
                      )}
                    </button>
                    <button
                      title="Editar produto"
                      onClick={() => {
                        setEditing(product)
                        setDialogOpen(true)
                      }}
                      className="rounded p-1.5 text-[#8c7a68] transition hover:bg-[#f3ece2] hover:text-[#2b1c13]"
                    >
                      <Edit3 className="size-3.5" />
                    </button>
                    <button
                      title="Excluir produto"
                      onClick={() => setDeleting(product)}
                      className="rounded p-1.5 text-[#8c7a68] transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {product.description && (
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-[#64748b]">
                    {product.description}
                  </p>
                )}

                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[#8c531b] font-bold">
                      Preço de venda
                    </p>
                    <p className="text-lg font-extrabold tracking-tight text-[#2b1c13]">
                      {formatPrice(product.sale_price)}
                    </p>
                  </div>
                  <div className="text-right text-[10px] text-[#64748b]">
                    {product.cost !== undefined && product.cost !== null && (
                      <p>
                        Custo:{' '}
                        <span className="font-semibold text-[#475569]">
                          {formatPrice(product.cost)}
                        </span>
                      </p>
                    )}
                    {product.stock !== undefined && product.stock !== null && (
                      <p>
                        Estoque:{' '}
                        <span className="font-semibold text-[#475569]">{product.stock} un</span>
                      </p>
                    )}
                    {!product.active && (
                      <span className="mt-1 inline-block rounded bg-[#f1ece5] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#8c7a68]">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialogOpen && (
        <ProductDialog
          open={dialogOpen}
          product={editing}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSaved={(saved) => {
            setProducts((rows) => {
              const exists = rows.some((p) => p.id === saved.id)
              return exists ? rows.map((p) => (p.id === saved.id ? saved : p)) : [...rows, saved]
            })
          }}
          ownerId={user?.id}
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
            <h2 className="text-sm font-extrabold text-[#1c1c1e]">Excluir produto?</h2>
            <p className="mt-1 text-xs text-[#64748b]">
              <strong className="text-[#2b1c13]">{deleting.name}</strong> será removido do catálogo.
              Preços de repasse vinculados a ele também desaparecem dos pontos de revenda.
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

function cnCard(active: boolean) {
  return cn(
    'flex flex-col rounded-lg border bg-white p-3.5 shadow-2xs transition hover:shadow-sm',
    active ? 'border-[#e8ddd0]' : 'border-[#e8ddd0] bg-[#faf7f2] opacity-70',
  )
}

function ProductDialog({
  open,
  product,
  onClose,
  onSaved,
  ownerId,
}: {
  open: boolean
  product: Product | null
  onClose: () => void
  onSaved: (product: Product) => void
  ownerId?: string
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setBusy(false)
    setForm(
      product
        ? {
            name: product.name || '',
            category: product.category,
            description: product.description || '',
            sale_price: product.sale_price !== undefined ? String(product.sale_price) : '',
            cost: product.cost !== undefined && product.cost !== null ? String(product.cost) : '',
            stock:
              product.stock !== undefined && product.stock !== null ? String(product.stock) : '',
            active: product.active !== false,
          }
        : EMPTY_FORM,
    )
  }, [open, product])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Informe o nome do produto.'
    if (!form.category) next.category = 'Escolha a categoria.'
    const salePrice = toNumber(form.sale_price)
    if (salePrice === null || salePrice < 0) next.sale_price = 'Informe o preço de venda.'
    const cost = toNumber(form.cost)
    if (form.cost.trim() && cost === null) next.cost = 'Custo inválido.'
    const stockRaw = form.stock.replace(/\D/g, '')
    if (form.stock.trim() && !stockRaw) next.stock = 'Estoque inválido.'
    if (Object.keys(next).length) return setErrors(next)

    setBusy(true)
    setErrors({})
    try {
      const data: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        sale_price: salePrice,
        cost: cost ?? null,
        stock: stockRaw ? Number(stockRaw) : null,
        active: form.active,
        owner: product?.owner || ownerId,
      }
      const saved = product ? await updateProduct(product.id, data) : await createProduct(data)
      onSaved(saved)
      toast({
        title: product ? 'Produto atualizado' : 'Produto criado',
        description: `${saved.name} foi salvo no catálogo.`,
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
            {product ? 'Editar produto' : 'Novo produto'}
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
          <Field label="Nome do produto *" error={errors.name} className="sm:col-span-2">
            <input
              autoFocus
              value={form.name}
              placeholder="Ex: Bourbon Amarelo Fermentado 250g"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Tipo / categoria *" error={errors.category}>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
            >
              <option value="">Selecione...</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PRODUCT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preço de venda ao cliente *" error={errors.sale_price}>
            <input
              inputMode="decimal"
              value={form.sale_price}
              placeholder="Ex: 45,00"
              onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
            />
          </Field>
          <Field label="Custo (opcional)" error={errors.cost}>
            <input
              inputMode="decimal"
              value={form.cost}
              placeholder="Ex: 18,50"
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </Field>
          <Field label="Estoque (opcional)" error={errors.stock}>
            <input
              inputMode="numeric"
              value={form.stock}
              placeholder="Ex: 30"
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </Field>
          <Field label="Descrição" error={errors.description} className="sm:col-span-2">
            <textarea
              rows={3}
              value={form.description}
              placeholder="Notas de catação, moagem, detalhes do brinde..."
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
              Produto ativo (aparece no catálogo e disponível para repasse)
            </span>
          </label>
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
            {product ? 'Salvar alterações' : 'Criar produto'}
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
