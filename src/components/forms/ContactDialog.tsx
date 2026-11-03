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
      nickname: contact?.nickname || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      birthday: contact?.birthday ? contact.birthday.split('T')[0] : '',
      favorite_coffee: contact?.favorite_coffee || '',
      roast_preference: contact?.roast_preference || '',
      brew_method_preference: contact?.brew_method_preference || '',
      coffee_machine: contact?.coffee_machine || '',
      sent_mug: Boolean(contact?.sent_mug),
      sent_welcome_folder: Boolean(contact?.sent_welcome_folder),
      sent_stickers: Boolean(contact?.sent_stickers),
      intensity_preference: contact?.intensity_preference || '',
      dietary_restrictions: contact?.dietary_restrictions || '',
      special_date_description: contact?.special_date_description || '',
      special_date: contact?.special_date ? contact.special_date.split('T')[0] : '',
      acquisition_channel: contact?.acquisition_channel || '',
      service_notes: contact?.service_notes || '',
      city: contact?.city || '',
      state: contact?.state || '',
      address: contact?.address || '',
      cpf_cnpj: contact?.cpf_cnpj || '',
      coffee_preference: contact?.coffee_preference || '',
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
        nickname: form.nickname.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        favorite_coffee: form.favorite_coffee.trim(),
        roast_preference: form.roast_preference.trim(),
        brew_method_preference: form.brew_method_preference.trim(),
        coffee_machine: form.coffee_machine.trim(),
        sent_mug: Boolean(form.sent_mug),
        sent_welcome_folder: Boolean(form.sent_welcome_folder),
        sent_stickers: Boolean(form.sent_stickers),
        intensity_preference: form.intensity_preference.trim(),
        dietary_restrictions: form.dietary_restrictions.trim(),
        special_date_description: form.special_date_description.trim(),
        acquisition_channel: form.acquisition_channel.trim(),
        service_notes: form.service_notes.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        address: form.address.trim(),
        cpf_cnpj: form.cpf_cnpj.trim(),
        coffee_preference: form.coffee_preference.trim(),
        owner: contact?.owner || user?.id,
      }
      if (form.birthday) {
        data.birthday = new Date(`${form.birthday}T00:00:00.000Z`).toISOString()
      } else {
        data.birthday = null
      }
      if (form.special_date) {
        data.special_date = new Date(`${form.special_date}T00:00:00.000Z`).toISOString()
      } else {
        data.special_date = null
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
        <div className="grid gap-4 p-4 sm:grid-cols-2 max-h-[75vh] overflow-y-auto">
          <Field label="Nome Completo" error={errors.name}>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Como prefere ser chamado (Apelido caloroso)">
            <input
              placeholder="Ex: Dani, Rafa, Doutor Paulo..."
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            />
          </Field>
          <Field label="E-mail" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone / WhatsApp" error={errors.phone}>
            <input
              placeholder="Ex: (11) 98765-4321"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>

          {/* Localização & Documento */}
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <Field label="Cidade" className="col-span-2">
              <input
                placeholder="Ex: Três Pontas, São Paulo..."
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="UF">
              <input
                maxLength={2}
                placeholder="Ex: MG"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>
          <Field label="Endereço Completo (Correios / Envio)" className="sm:col-span-2">
            <input
              placeholder="Rua, número, complemento, bairro (CEP...)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="CPF / CNPJ" className="sm:col-span-2">
            <input
              placeholder="Ex: 000.000.000-00 ou 00.000.000/0000-00"
              value={form.cpf_cnpj}
              onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })}
            />
          </Field>

          {/* SEÇÃO MIMOS DA SÃO DOMINGOS */}
          <div className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50/70 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-amber-950">
              <span className="flex items-center gap-1.5">
                <span>🎁 Mimos São Domingos · Envio de Boas-Vindas</span>
              </span>
              <span className="text-[10px] font-normal text-amber-800">
                Marque para registrar os mimos já despachados
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 pt-1 border-t border-amber-200">
              <label className="flex items-start gap-2 rounded-md bg-white/80 border border-amber-200/80 p-2 cursor-pointer transition hover:bg-white text-[11px] text-[#1c1c1e]">
                <input
                  type="checkbox"
                  checked={form.sent_mug}
                  onChange={(e) => setForm({ ...form, sent_mug: e.target.checked })}
                  className="mt-0.5 size-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
                />
                <span className="leading-snug select-none font-medium">
                  Já enviei a caneca da São Domingos
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-md bg-white/80 border border-amber-200/80 p-2 cursor-pointer transition hover:bg-white text-[11px] text-[#1c1c1e]">
                <input
                  type="checkbox"
                  checked={form.sent_welcome_folder}
                  onChange={(e) => setForm({ ...form, sent_welcome_folder: e.target.checked })}
                  className="mt-0.5 size-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
                />
                <span className="leading-snug select-none font-medium">
                  Já enviei o folder de boas-vindas
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-md bg-white/80 border border-amber-200/80 p-2 cursor-pointer transition hover:bg-white text-[11px] text-[#1c1c1e]">
                <input
                  type="checkbox"
                  checked={form.sent_stickers}
                  onChange={(e) => setForm({ ...form, sent_stickers: e.target.checked })}
                  className="mt-0.5 size-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
                />
                <span className="leading-snug select-none font-medium">Já enviei os adesivos</span>
              </label>
            </div>
          </div>

          {/* SEÇÃO DISNEY: PREFERÊNCIAS SENSORIAIS & ATENÇÃO AOS DETALHES */}
          <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <span>✨ Experiência Disney · Fazer o Cliente se Sentir Único</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Máquina de café que o cliente possui">
                <div>
                  <input
                    list="coffee-machines-list"
                    placeholder="Selecione ou digite (Espresso, Cápsula, Outro...)"
                    value={form.coffee_machine}
                    onChange={(e) => setForm({ ...form, coffee_machine: e.target.value })}
                  />
                  <datalist id="coffee-machines-list">
                    <option value="Espresso" />
                    <option value="Cápsula" />
                    <option value="Prensa Francesa" />
                    <option value="Moka" />
                    <option value="V60" />
                    <option value="Coador" />
                    <option value="Aeropress" />
                    <option value="Outro" />
                  </datalist>
                </div>
              </Field>
              <Field label="Método preferido de consumo do café">
                <div>
                  <input
                    list="brew-methods-list"
                    placeholder="Selecione ou digite (V60, Coador, Espresso...)"
                    value={form.brew_method_preference}
                    onChange={(e) => setForm({ ...form, brew_method_preference: e.target.value })}
                  />
                  <datalist id="brew-methods-list">
                    <option value="Espresso" />
                    <option value="Cápsula" />
                    <option value="Prensa Francesa" />
                    <option value="Moka" />
                    <option value="V60" />
                    <option value="Coador" />
                    <option value="Aeropress" />
                    <option value="Chemex" />
                    <option value="Outro" />
                  </datalist>
                </div>
              </Field>
              <Field label="Café Favorito / Variedade">
                <input
                  placeholder="Ex: Geisha do Cerrado, Bourbon Amarelo..."
                  value={form.favorite_coffee}
                  onChange={(e) => setForm({ ...form, favorite_coffee: e.target.value })}
                />
              </Field>
              <Field label="Torra Preferida">
                <input
                  placeholder="Ex: Clara floral, Média achocolatada, Escura..."
                  value={form.roast_preference}
                  onChange={(e) => setForm({ ...form, roast_preference: e.target.value })}
                />
              </Field>
              <Field label="Intensidade / Perfil de Paladar">
                <input
                  placeholder="Ex: Cítrico/Frutado, Encorpado, Suave/Doce..."
                  value={form.intensity_preference}
                  onChange={(e) => setForm({ ...form, intensity_preference: e.target.value })}
                />
              </Field>
              <Field label="Como conheceu a cafeteria">
                <input
                  placeholder="Ex: Indicação de amigo, Instagram, Passou na frente..."
                  value={form.acquisition_channel}
                  onChange={(e) => setForm({ ...form, acquisition_channel: e.target.value })}
                />
              </Field>
              <Field label="Alergias ou Restrições Alimentares" className="sm:col-span-2">
                <input
                  placeholder="Ex: Sem lactose, Sem glúten, Zero cafeína, Adoçante stevia..."
                  value={form.dietary_restrictions}
                  onChange={(e) => setForm({ ...form, dietary_restrictions: e.target.value })}
                />
              </Field>
              <Field
                label="Observações de Atendimento Minucioso (Disney)"
                className="sm:col-span-2"
              >
                <textarea
                  rows={2}
                  placeholder="Ex: Sempre pede copo de água com gás antes do espresso, adora falar sobre cafés especiais..."
                  value={form.service_notes}
                  onChange={(e) => setForm({ ...form, service_notes: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <Field label="Data de Aniversário" error={errors.birthday}>
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
            />
          </Field>

          {/* Outra data especial */}
          <div className="space-y-1">
            <Field label="Outra Data Especial (ex.: Cônjuge, Casamento)">
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  placeholder="Descrição (ex.: Esposa Ana)"
                  value={form.special_date_description}
                  onChange={(e) => setForm({ ...form, special_date_description: e.target.value })}
                />
                <input
                  type="date"
                  value={form.special_date}
                  onChange={(e) => setForm({ ...form, special_date: e.target.value })}
                />
              </div>
            </Field>
          </div>

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
          <Field label="Notas Gerais" error={errors.notes} className="sm:col-span-2">
            <textarea
              rows={2}
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
