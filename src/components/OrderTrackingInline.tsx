import { useEffect, useRef, useState } from 'react'
import { Check, LoaderCircle, Pencil, X } from 'lucide-react'
import { updateOrder } from '@/services/crm'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { Order } from '@/types/crm'

interface OrderTrackingInlineProps {
  order: Order
  /** Chamado após salvar com sucesso (ex.: refresh da lista). */
  onSaved: () => void | Promise<void>
}

/**
 * Edição inline do código de rastreio dos Correios direto no card do funil,
 * sem abrir o formulário completo do pedido. Usa o mesmo updateOrder do
 * formulário: grava a data de envio automática (shipped_at) e o evento na
 * jornada do cliente — inclusive a troca/limpeza do código em rastreio
 * existente (a data de envio original é preservada nesse caso).
 *
 * Salva com Enter, no botão de confirmar ou ao sair do campo (blur);
 * Esc/botão de cancelar descarta a alteração.
 *
 * O componente sempre interrompe a propagação de mousedown/dragstart para
 * não conflitar com o drag-and-drop do kanban.
 */
export function OrderTrackingInline({ order, onSaved }: OrderTrackingInlineProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentCode = (order.tracking_code || '').trim()

  useEffect(() => {
    if (!editing) return
    setValue(currentCode)
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const close = () => {
    if (!saving) setEditing(false)
  }

  const save = async () => {
    if (saving) return
    const trimmed = value.trim()
    if (trimmed === currentCode) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      // Mesmo serviço do formulário: grava shipped_at automaticamente quando
      // o rastreio é adicionado a um pedido que não tinha código.
      await updateOrder(order.id, { tracking_code: trimmed })
      toast({
        title: trimmed ? 'Rastreio salvo!' : 'Rastreio removido',
        description: trimmed
          ? `Código ${trimmed} gravado no pedido${currentCode ? '' : ' com a data de envio de hoje'}.`
          : 'O código de rastreio foi retirado do pedido.',
      })
      setEditing(false)
      await onSaved()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar o rastreio',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        draggable={false}
        onDragStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setEditing(true)
        }}
        title={currentCode ? 'Editar rastreio' : 'Adicionar rastreio'}
        aria-label={currentCode ? 'Editar rastreio' : 'Adicionar rastreio'}
        className="inline-flex size-8 w-fit shrink-0 items-center justify-center rounded border border-dashed border-blue-300/80 bg-blue-50/60 text-blue-800 transition hover:border-blue-400 hover:bg-blue-100/80 active:bg-blue-100"
      >
        <Pencil className="size-3.5 shrink-0" />
      </button>
    )
  }

  return (
    <div
      className="flex items-center gap-1 rounded border border-blue-300 bg-white px-1 py-1 shadow-2xs"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        draggable={false}
        disabled={saving}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
        onBlur={() => {
          // Salva ao sair do campo somente se o código mudou
          const trimmed = value.trim()
          if (!saving && trimmed !== currentCode) save()
        }}
        placeholder="AA123456789BR"
        title="Código de rastreio dos Correios"
        aria-label="Código de rastreio dos Correios"
        className="h-7 min-w-0 flex-1 rounded border border-blue-200 bg-blue-50/50 px-2 font-mono text-[11px] font-bold tracking-wider text-blue-900 uppercase outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/40 disabled:opacity-60"
      />
      {/* preventDefault no mousedown evita que o clique dispare o blur-save antes da ação */}
      <button
        type="button"
        disabled={saving}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          save()
        }}
        title="Salvar rastreio"
        aria-label="Salvar rastreio"
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded bg-emerald-600 text-white transition hover:bg-emerald-700',
          saving && 'opacity-70',
        )}
      >
        {saving ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
      </button>
      <button
        type="button"
        disabled={saving}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          close()
        }}
        title="Cancelar (descartar alteração)"
        aria-label="Cancelar edição do rastreio"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded text-[#94a3b8] transition hover:bg-[#f3ece0] hover:text-red-600"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
