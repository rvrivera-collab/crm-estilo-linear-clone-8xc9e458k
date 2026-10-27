import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/contexts/CrmContext'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { createDeal, updateDeal } from '@/services/crm'
import type { Deal } from '@/types/crm'

export function DealDialog({
  open,
  onOpenChange,
  deal,
  presetStage,
  presetContact,
  presetEmpresa,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  deal?: Deal | null
  presetStage?: string
  presetContact?: string
  presetEmpresa?: string
}) {
  const { stages, contacts, empresas, refresh } = useCrm()
  const { user } = useAuth()
  const { toast } = useToast()

  const initialContact = deal?.contact || presetContact || contacts[0]?.id || ''
  const initialContactObj = contacts.find((c) => c.id === initialContact)

  const initial = useMemo(
    () => ({
      title: deal?.title || '',
      value: deal?.value ? String(deal.value) : '',
      stage: deal?.stage || presetStage || stages[0]?.id || '',
      contact: deal?.contact || presetContact || contacts[0]?.id || '',
      empresa:
        deal?.empresa ||
        presetEmpresa ||
        initialContactObj?.empresa ||
        (initialContactObj?.company
          ? empresas.find((e) => e.name.toLowerCase() === initialContactObj.company.toLowerCase())
              ?.id || ''
          : ''),
      status: deal?.status || 'aberto',
      expected_close: deal?.expected_close ? deal.expected_close.slice(0, 10) : '',
    }),
    [
      deal,
      presetStage,
      presetContact,
      presetEmpresa,
      initialContactObj,
      stages,
      contacts,
      empresas,
    ],
  )
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  // Ao mudar o contato selecionado, vincular a empresa correspondente automaticamente se não houver ou se for o contato inicial
  const handleContactChange = (contactId: string) => {
    const selected = contacts.find((c) => c.id === contactId)
    let autoEmpresa = selected?.empresa || ''
    if (!autoEmpresa && selected?.company) {
      const found = empresas.find(
        (e) => e.name.toLowerCase() === selected.company.trim().toLowerCase(),
      )
      if (found) autoEmpresa = found.id
    }
    setForm((prev) => ({
      ...prev,
      contact: contactId,
      empresa: autoEmpresa || prev.empresa,
    }))
  }

  useEffect(() => {
    if (open) {
      setForm(initial)
      setErrors({})
    }
  }, [open, initial])
  if (!open) return null
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.title.trim()) next.title = 'Informe o título.'
    if (!form.value || Number(form.value) <= 0) next.value = 'Informe um valor maior que zero.'
    if (!form.stage) next.stage = 'Selecione o estágio.'
    if (!form.contact) next.contact = 'Selecione o contato.'
    if (Object.keys(next).length) return setErrors(next)
    setBusy(true)
    setErrors({})
    try {
      const sameStage = Boolean(deal && deal.stage === form.stage)
      const data: Record<string, unknown> = {
        title: form.title.trim(),
        value: Number(form.value),
        stage: form.stage,
        contact: form.contact,
        empresa: form.empresa || null,
        status: form.status,
        expected_close: form.expected_close ? `${form.expected_close} 18:00:00.000Z` : '',
        owner: deal?.owner || user?.id,
        position: sameStage && deal ? deal.position : 1,
      }
      if (deal) await updateDeal(deal.id, data)
      else {
        const allCodes = (await import('@/services/crm')).listDeals
          ? await (await import('@/services/crm')).listDeals()
          : []
        const maxCode = Math.max(
          1000,
          ...allCodes.map((item) => Number(item.code.replace('NEG-', '')) || 0),
        )
        const position =
          Math.max(
            0,
            ...allCodes.filter((item) => item.stage === form.stage).map((item) => item.position),
          ) + 1
        await createDeal({ ...data, code: `NEG-${maxCode + 1}`, position })
      }
      await refresh()
      toast({
        title: deal ? 'Negócio atualizado' : 'Negócio criado',
        description: `${form.title} foi salvo no pipeline.`,
      })
      onOpenChange(false)
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(Object.keys(fields).length ? fields : { form: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg animate-panel-rise rounded-[10px] border border-[#e5e7eb] bg-white text-[#1c1c1e] shadow-[0_18px_50px_rgba(0,0,0,.15)]"
      >
        <div className="flex h-12 items-center border-b border-[#e5e7eb] px-4">
          <h2 className="flex-1 text-sm font-extrabold text-[#1c1c1e]">
            {deal ? 'Editar negócio' : 'Novo negócio'}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Título" error={errors.title} className="sm:col-span-2">
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Valor (R$)" error={errors.value}>
            <input
              type="number"
              min="1"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label="Fechamento esperado" error={errors.expected_close}>
            <input
              type="date"
              value={form.expected_close}
              onChange={(e) => setForm({ ...form, expected_close: e.target.value })}
            />
          </Field>
          <Field label="Estágio" error={errors.stage}>
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={errors.status}>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Deal['status'] })}
            >
              <option value="aberto">Aberto</option>
              <option value="ganho">Ganho</option>
              <option value="perdido">Perdido</option>
            </select>
          </Field>
          <Field label="Contato Principal" error={errors.contact}>
            <select value={form.contact} onChange={(e) => handleContactChange(e.target.value)}>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} {contact.company ? `(${contact.company})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Empresa Vinculada" error={errors.empresa}>
            <select
              value={form.empresa}
              onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            >
              <option value="">Sem empresa associada</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.sector ? `· ${emp.sector}` : ''}
                </option>
              ))}
            </select>
          </Field>
          {errors.form && <p className="sm:col-span-2 text-xs text-red-600">{errors.form}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e5e7eb] px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-md border border-[#e2e8f0] px-3 text-[11px] font-medium text-[#475569] hover:bg-[#f1f5f9]"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            className="flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-[11px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60 shadow-xs"
          >
            {busy && <LoaderCircle className="size-3 animate-spin" />} Salvar negócio
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
