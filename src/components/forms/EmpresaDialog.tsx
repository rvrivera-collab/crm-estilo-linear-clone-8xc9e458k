import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/contexts/CrmContext'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { createEmpresa, updateEmpresa } from '@/services/crm'
import type { Empresa, EmpresaSize } from '@/types/crm'

export function EmpresaDialog({
  open,
  onOpenChange,
  empresa,
  initialName = '',
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  empresa?: Empresa | null
  initialName?: string
}) {
  const { refresh } = useCrm()
  const { user } = useAuth()
  const { toast } = useToast()

  const initial = useMemo(
    () => ({
      name: empresa?.name || initialName || '',
      sector: empresa?.sector || '',
      size: (empresa?.size || '') as '' | EmpresaSize,
      website: empresa?.website || '',
      phone: empresa?.phone || '',
      email: empresa?.email || '',
      notes: empresa?.notes || '',
    }),
    [empresa, initialName],
  )

  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

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
    if (!form.name.trim()) next.name = 'Informe o nome da empresa.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      next.email = 'Informe um e-mail válido.'
    }
    if (form.website && !/^https?:\/\//i.test(form.website)) {
      // Permitir preencher automaticamente com https:// se não tiver protocolo
      form.website = `https://${form.website.trim()}`
    }
    if (Object.keys(next).length) return setErrors(next)

    setBusy(true)
    setErrors({})
    try {
      const data: Record<string, unknown> = {
        name: form.name.trim(),
        sector: form.sector.trim(),
        website: form.website.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
        owner: empresa?.owner || user?.id,
      }
      if (form.size) {
        data.size = form.size
      } else {
        data.size = null
      }

      if (empresa) {
        await updateEmpresa(empresa.id, data)
      } else {
        await createEmpresa(data)
      }
      await refresh()
      toast({
        title: empresa ? 'Empresa atualizada' : 'Empresa criada',
        description: `${form.name} foi salva com sucesso.`,
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
            {empresa ? 'Editar empresa' : 'Nova empresa'}
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
          <Field label="Nome da empresa *" error={errors.name} className="sm:col-span-2">
            <input
              autoFocus
              value={form.name}
              placeholder="Ex: Alpha Soluções"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Setor de atuação" error={errors.sector}>
            <input
              value={form.sector}
              placeholder="Ex: Tecnologia, Varejo, Saúde"
              onChange={(e) => setForm({ ...form, sector: e.target.value })}
            />
          </Field>
          <Field label="Porte da empresa" error={errors.size}>
            <select
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value as EmpresaSize })}
            >
              <option value="">Não informado</option>
              <option value="pequena">Pequena</option>
              <option value="média">Média</option>
              <option value="grande">Grande</option>
            </select>
          </Field>
          <Field label="Website" error={errors.website}>
            <input
              type="text"
              placeholder="https://exemplo.com.br"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <Field label="Telefone comercial" error={errors.phone}>
            <input
              placeholder="+55 11 3000-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="E-mail de contato" error={errors.email} className="sm:col-span-2">
            <input
              type="email"
              placeholder="contato@empresa.com.br"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Notas internas" error={errors.notes} className="sm:col-span-2">
            <textarea
              rows={3}
              placeholder="Informações relevantes sobre a conta comercial, tomadores de decisão ou contexto do negócio..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
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
            {busy && <LoaderCircle className="size-3 animate-spin" />}{' '}
            {empresa ? 'Salvar alterações' : 'Criar empresa'}
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
