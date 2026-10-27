import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/contexts/CrmContext'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { createContact, updateContact } from '@/services/crm'
import type { Contact } from '@/types/crm'

export function ContactDialog({
  open,
  onOpenChange,
  contact,
  presetEmpresa,
  presetCompanyName,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  contact?: Contact | null
  presetEmpresa?: string
  presetCompanyName?: string
}) {
  const { empresas, refresh } = useCrm()
  const { user } = useAuth()
  const { toast } = useToast()

  const initial = useMemo(
    () => ({
      name: contact?.name || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      company:
        contact?.company ||
        presetCompanyName ||
        (presetEmpresa ? empresas.find((e) => e.id === presetEmpresa)?.name || '' : ''),
      empresa: contact?.empresa || presetEmpresa || '',
      position: contact?.position || '',
      status: contact?.status || 'lead',
      notes: contact?.notes || '',
    }),
    [contact, presetEmpresa, presetCompanyName, empresas],
  )
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [isCreatingInlineEmpresa, setIsCreatingInlineEmpresa] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial)
      setErrors({})
      setIsCreatingInlineEmpresa(false)
    }
  }, [open, initial])
  if (!open) return null
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Informe o nome.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Informe um e-mail válido.'
    if (Object.keys(next).length) return setErrors(next)
    setBusy(true)
    setErrors({})
    try {
      let finalEmpresaId = form.empresa

      // Se o usuário digitou um nome de empresa mas não selecionou uma existente:
      if (!finalEmpresaId && form.company.trim()) {
        const found = empresas.find(
          (e) => e.name.toLowerCase() === form.company.trim().toLowerCase(),
        )
        if (found) {
          finalEmpresaId = found.id
        } else {
          // Criar empresa inline para garantir contato -> empresa
          try {
            const { createEmpresa } = await import('@/services/crm')
            const newEmp = await createEmpresa({
              name: form.company.trim(),
              owner: contact?.owner || user?.id,
            })
            finalEmpresaId = newEmp.id
          } catch {
            /* intentionally ignored */
          }
        }
      }

      const data: Record<string, unknown> = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        owner: contact?.owner || user?.id,
      }
      if (finalEmpresaId) {
        data.empresa = finalEmpresaId
      }

      if (contact) await updateContact(contact.id, data)
      else await createContact(data)
      await refresh()
      toast({
        title: contact ? 'Contato atualizado' : 'Contato criado',
        description: `${form.name} foi salvo com sucesso.`,
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
            {contact ? 'Editar contato' : 'Novo contato'}
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
          <Field label="Nome" error={errors.name} className="sm:col-span-2">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="E-mail" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone" error={errors.phone}>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Empresa" error={errors.company}>
            <div className="space-y-1">
              {!isCreatingInlineEmpresa ? (
                <div className="flex gap-1.5">
                  <select
                    className="flex-1"
                    value={form.empresa}
                    onChange={(e) => {
                      const selectedId = e.target.value
                      if (selectedId === '__create_new__') {
                        setIsCreatingInlineEmpresa(true)
                        setForm((prev) => ({ ...prev, empresa: '' }))
                      } else {
                        const emp = empresas.find((item) => item.id === selectedId)
                        setForm((prev) => ({
                          ...prev,
                          empresa: selectedId,
                          company: emp ? emp.name : '',
                        }))
                      }
                    }}
                  >
                    <option value="">Selecione ou crie nova empresa...</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.sector ? `(${emp.sector})` : ''}
                      </option>
                    ))}
                    <option value="__create_new__">+ Digitar nova empresa...</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    placeholder="Nome da nova empresa..."
                    value={form.company}
                    autoFocus
                    onChange={(e) => setForm({ ...form, company: e.target.value, empresa: '' })}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingInlineEmpresa(false)
                      if (!form.empresa && form.company) {
                        const found = empresas.find(
                          (emp) => emp.name.toLowerCase() === form.company.toLowerCase(),
                        )
                        if (found) setForm((prev) => ({ ...prev, empresa: found.id }))
                      }
                    }}
                    className="shrink-0 rounded border border-[#e2e8f0] px-2 text-[10px] text-[#64748b] hover:bg-[#f1f5f9]"
                  >
                    Lista
                  </button>
                </div>
              )}
            </div>
          </Field>
          <Field label="Cargo" error={errors.position}>
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
          </Field>
          <Field label="Status" error={errors.status} className="sm:col-span-2">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Contact['status'] })}
            >
              <option value="lead">Lead</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </Field>
          <Field label="Notas" error={errors.notes} className="sm:col-span-2">
            <textarea
              rows={3}
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
            {busy && <LoaderCircle className="size-3 animate-spin" />} Salvar contato
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
