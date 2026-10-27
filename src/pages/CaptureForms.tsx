import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Camera,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  Globe,
  LoaderCircle,
  Mail,
  MessageSquare,
  Palette,
  Phone,
  Plus,
  Save,
  Send,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { Link } from 'react-router-dom'
import {
  createCaptureForm,
  listCampaigns,
  listCaptureForms,
  updateCaptureForm,
} from '@/services/crm'
import type { Campaign, CaptureForm, CustomFieldConfig, CustomFieldType } from '@/types/crm'
import { toast } from '@/hooks/use-toast'

const presetColors = [
  { name: 'Âmbar Linear', hex: '#f59e0b' },
  { name: 'Índigo Adapta', hex: '#6366f1' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Azul Real', hex: '#2563eb' },
  { name: 'Rosa Magenta', hex: '#ec4899' },
  { name: 'Grafite Escuro', hex: '#0f172a' },
]

export default function CaptureForms() {
  const [forms, setForms] = useState<CaptureForm[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedFormId, setSelectedFormId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [savingForm, setSavingForm] = useState(false)
  const [creatingNewFormModal, setCreatingNewFormModal] = useState(false)
  const [newFormName, setNewFormName] = useState('')
  const [creatingForm, setCreatingForm] = useState(false)

  // Navigation tab inside this unified page
  const [activeTab, setActiveTab] = useState<'customize' | 'embed'>('customize')

  // Form customizer states
  const [formName, setFormName] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formSubtitle, setFormSubtitle] = useState('')
  const [formSubmitText, setFormSubmitText] = useState('')
  const [formSuccessMessage, setFormSuccessMessage] = useState('')
  const [formAccentColor, setFormAccentColor] = useState('#f59e0b')
  const [formLogoFile, setFormLogoFile] = useState<File | null>(null)
  const [formLogoRemove, setFormLogoRemove] = useState(false)
  const [showPhone, setShowPhone] = useState(true)
  const [requirePhone, setRequirePhone] = useState(false)
  const [showCompany, setShowCompany] = useState(true)
  const [requireCompany, setRequireCompany] = useState(false)
  const [showPosition, setShowPosition] = useState(true)
  const [requirePosition, setRequirePosition] = useState(false)
  const [showMessage, setShowMessage] = useState(true)
  const [requireMessage, setRequireMessage] = useState(false)
  const [customFields, setCustomFields] = useState<CustomFieldConfig[]>([])

  // Preview options
  const [previewTab, setPreviewTab] = useState<'form' | 'success'>('form')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [iframeKey, setIframeKey] = useState(0)

  // Embed options
  const [embedType, setEmbedType] = useState<'iframe' | 'script'>('iframe')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)

  // Custom Field modal
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>('text')
  const [fieldRequired, setFieldRequired] = useState(false)
  const [fieldPlaceholder, setFieldPlaceholder] = useState('')
  const [fieldOptionsText, setFieldOptionsText] = useState('')

  // Load forms and campaigns
  useEffect(() => {
    let active = true
    async function fetchForms() {
      try {
        setLoading(true)
        const [items, camps] = await Promise.all([listCaptureForms(), listCampaigns()])
        if (active) {
          setForms(items)
          setCampaigns(camps)
          if (items.length > 0) {
            const first = items[0]
            setSelectedFormId(first.id)
            populateFormData(first)
          } else {
            setSelectedFormId('')
          }
        }
      } catch (err) {
        console.error('Erro ao carregar formulários de captação', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchForms()
    return () => {
      active = false
    }
  }, [])

  // Campaigns linked to the currently selected form
  const linkedCampaigns = useMemo(() => {
    if (!selectedFormId) return []
    return campaigns.filter((c) => c.form === selectedFormId)
  }, [campaigns, selectedFormId])

  async function handleCreateNewForm(e: React.FormEvent) {
    e.preventDefault()
    if (!newFormName.trim()) return
    setCreatingForm(true)
    try {
      const created = await createCaptureForm({
        name: newFormName.trim(),
        title: 'Vamos transformar seu processo comercial',
        subtitle: 'Preencha o formulário abaixo para nossa equipe entrar em contato.',
        submit_text: 'Enviar solicitação',
        success_message: 'Muito obrigado pelo contato. Seu atendimento foi registrado com sucesso.',
        accent_color: '#f59e0b',
        show_phone: true,
        require_phone: false,
        show_company: true,
        require_company: false,
        show_position: true,
        require_position: false,
        show_message: true,
        require_message: false,
        custom_fields: [],
      })
      setForms((prev) => [...prev, created])
      setSelectedFormId(created.id)
      populateFormData(created)
      setCreatingNewFormModal(false)
      setNewFormName('')
      toast({
        title: 'Formulário criado!',
        description: `O formulário "${created.name}" foi criado e já pode ser vinculado a uma campanha.`,
      })
    } catch (err) {
      toast({
        title: 'Erro ao criar formulário',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setCreatingForm(false)
    }
  }

  function populateFormData(cfg: CaptureForm) {
    setFormName(cfg.name || 'Formulário Principal')
    setFormTitle(cfg.title || 'Vamos transformar seu processo comercial')
    setFormSubtitle(
      cfg.subtitle ||
        'Preencha o formulário abaixo. Nossa equipe responderá de forma personalizada em menos de 2 horas.',
    )
    setFormSubmitText(cfg.submit_text || 'Enviar solicitação')
    setFormSuccessMessage(
      cfg.success_message ||
        'Muito obrigado pelo contato. Seu atendimento já foi registrado em nossa esteira comercial. Nossa equipe entrará em contato.',
    )
    setFormAccentColor(cfg.accent_color || '#f59e0b')
    setShowPhone(Boolean(cfg.show_phone))
    setRequirePhone(Boolean(cfg.require_phone))
    setShowCompany(Boolean(cfg.show_company))
    setRequireCompany(Boolean(cfg.require_company))
    setShowPosition(Boolean(cfg.show_position))
    setRequirePosition(Boolean(cfg.require_position))
    setShowMessage(Boolean(cfg.show_message))
    setRequireMessage(Boolean(cfg.require_message))
    setFormLogoFile(null)
    setFormLogoRemove(false)

    if (Array.isArray(cfg.custom_fields)) {
      setCustomFields(cfg.custom_fields)
    } else if (typeof cfg.custom_fields === 'string' && (cfg.custom_fields as string).trim()) {
      try {
        setCustomFields(JSON.parse(cfg.custom_fields as unknown as string))
      } catch {
        setCustomFields([])
      }
    } else {
      setCustomFields([])
    }
  }

  function handleSelectForm(id: string) {
    setSelectedFormId(id)
    const found = forms.find((f) => f.id === id)
    if (found) {
      populateFormData(found)
    }
  }

  const selectedForm = forms.find((f) => f.id === selectedFormId) || forms[0]

  // URL pública dedicada
  const dedicatedUrl = selectedForm?.id
    ? `${window.location.origin}/form/${selectedForm.id}`
    : `${window.location.origin}/captura`

  const iframeSnippet = `<iframe\n  src="${dedicatedUrl}"\n  width="100%"\n  height="720"\n  frameborder="0"\n  style="border:none; border-radius:12px; max-width:600px; width:100%; display:block; margin:0 auto;"\n></iframe>`

  const scriptSnippet = `<!-- Embed CRM Linear Lead Capture -->\n<div id="crm-capture-container" style="max-width:600px; margin:0 auto;"></div>\n<script>\n  (function() {\n    var ifr = document.createElement("iframe");\n    ifr.src = "${dedicatedUrl}";\n    ifr.style.width = "100%";\n    ifr.style.height = "720px";\n    ifr.style.border = "none";\n    ifr.style.borderRadius = "12px";\n    document.getElementById("crm-capture-container").appendChild(ifr);\n  })();\n</script>`

  const currentSnippet = embedType === 'iframe' ? iframeSnippet : scriptSnippet

  function copyUrl() {
    navigator.clipboard.writeText(dedicatedUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
    toast({
      title: 'Link direto copiado!',
      description: 'URL do formulário pronta para compartilhar.',
    })
  }

  function copySnippet() {
    navigator.clipboard.writeText(currentSnippet)
    setCopiedEmbed(true)
    setTimeout(() => setCopiedEmbed(false), 2000)
    toast({
      title: 'Código copiado para a área de transferência!',
      description: 'Cole em seu site, WordPress, Webflow ou Landing Page.',
    })
  }

  // Logo preview
  const currentLogoUrl = useMemo(() => {
    if (formLogoRemove) return null
    if (formLogoFile) return URL.createObjectURL(formLogoFile)
    if (selectedForm?.logo) return pb.files.getURL(selectedForm, selectedForm.logo)
    return null
  }, [formLogoFile, formLogoRemove, selectedForm])

  // Custom fields helpers
  function openNewCustomFieldModal() {
    setEditingFieldId('__new__')
    setFieldLabel('')
    setFieldType('text')
    setFieldRequired(false)
    setFieldPlaceholder('')
    setFieldOptionsText('')
  }

  function openEditCustomFieldModal(field: CustomFieldConfig) {
    setEditingFieldId(field.id)
    setFieldLabel(field.label)
    setFieldType(field.type)
    setFieldRequired(field.required)
    setFieldPlaceholder(field.placeholder || '')
    setFieldOptionsText(field.options?.join('\n') || '')
  }

  function closeCustomFieldModal() {
    setEditingFieldId(null)
  }

  function saveCustomField() {
    if (!fieldLabel.trim()) {
      toast({
        title: 'Rótulo obrigatório',
        description: 'Por favor, informe o rótulo do campo.',
        variant: 'destructive',
      })
      return
    }

    const options =
      fieldType === 'select'
        ? fieldOptionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined

    if (fieldType === 'select' && (!options || options.length === 0)) {
      toast({
        title: 'Opções obrigatórias',
        description: 'Informe pelo menos uma opção para o campo de seleção (uma por linha).',
        variant: 'destructive',
      })
      return
    }

    if (editingFieldId === '__new__') {
      const newField: CustomFieldConfig = {
        id: 'cf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        label: fieldLabel.trim(),
        type: fieldType,
        required: fieldRequired,
        placeholder: fieldPlaceholder.trim() || undefined,
        options,
      }
      setCustomFields((prev) => [...prev, newField])
      toast({ title: 'Campo personalizado adicionado' })
    } else {
      setCustomFields((prev) =>
        prev.map((f) =>
          f.id === editingFieldId
            ? {
                ...f,
                label: fieldLabel.trim(),
                type: fieldType,
                required: fieldRequired,
                placeholder: fieldPlaceholder.trim() || undefined,
                options,
              }
            : f,
        ),
      )
      toast({ title: 'Campo personalizado atualizado' })
    }
    setEditingFieldId(null)
  }

  function removeCustomField(id: string) {
    setCustomFields((prev) => prev.filter((f) => f.id !== id))
    toast({ title: 'Campo removido' })
  }

  function moveCustomField(index: number, direction: 'up' | 'down') {
    setCustomFields((prev) => {
      const next = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  // Save form
  async function saveCaptureSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingForm(true)
    try {
      const data = new FormData()
      data.set('name', formName.trim() || 'Formulário Principal')
      data.set('title', formTitle.trim())
      data.set('subtitle', formSubtitle.trim())
      data.set('submit_text', formSubmitText.trim())
      data.set('success_message', formSuccessMessage.trim())
      data.set('accent_color', formAccentColor.trim() || '#f59e0b')
      data.set('show_phone', String(showPhone))
      data.set('require_phone', String(showPhone && requirePhone))
      data.set('show_company', String(showCompany))
      data.set('require_company', String(showCompany && requireCompany))
      data.set('show_position', String(showPosition))
      data.set('require_position', String(showPosition && requirePosition))
      data.set('show_message', String(showMessage))
      data.set('require_message', String(showMessage && requireMessage))
      data.set('custom_fields', JSON.stringify(customFields))

      if (formLogoRemove) {
        data.set('logo', '')
      } else if (formLogoFile) {
        data.set('logo', formLogoFile)
      }

      if (!selectedForm) {
        const created = await createCaptureForm(data)
        setForms([created])
        setSelectedFormId(created.id)
        populateFormData(created)
        setFormLogoFile(null)
        setFormLogoRemove(false)
        setIframeKey((k) => k + 1)
        toast({
          title: 'Formulário criado com sucesso!',
          description: 'O formulário foi inicializado e já pode ser compartilhado.',
        })
      } else {
        const updated = await updateCaptureForm(selectedForm.id, data)
        setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
        setFormLogoFile(null)
        setFormLogoRemove(false)
        // Recarrega o iframe do embed para refletir alterações
        setIframeKey((k) => k + 1)
        toast({
          title: 'Formulário salvo com sucesso!',
          description: 'As alterações já estão ativas na página pública e em todos os embeds.',
        })
      }
    } catch (err) {
      toast({
        title: 'Erro ao salvar formulário',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSavingForm(false)
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 min-h-[calc(100vh-3.5rem)]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#e5e7eb]">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-600">
                Captação & Integração
              </p>
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-700">
                PÚBLICO
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e] flex items-center gap-2">
              <Sliders className="size-5 text-amber-600" />
              Formulário de Captação
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Personalize o design, campos e mensagens do seu formulário e obtenha o código de embed
              ou link direto em um só lugar.
            </p>
          </div>

          {/* Action Links & Nova Criação */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setNewFormName('')
                setCreatingNewFormModal(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition shadow-xs"
            >
              <Plus className="size-3.5" /> Novo Formulário
            </button>
            <a
              href={dedicatedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition shadow-2xs"
              title="Abrir URL pública em nova aba"
            >
              <Globe className="size-3.5 text-amber-600" />
              Página Pública
              <ExternalLink className="size-3 text-[#94a3b8]" />
            </a>
            <Link
              to="/campanhas"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition shadow-2xs"
            >
              Ver Campanhas
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-xs text-[#64748b]">
            <LoaderCircle className="size-6 animate-spin text-amber-500" />
            <span>Carregando formulário e integrações...</span>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Barra Superior: Seletor de Formulário (se houver) + Indicador de Campanhas + Alternador de Abas */}
            <div
              data-tour-id="forms-selector-header"
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-3 shadow-2xs"
            >
              {/* Seletor quando houver formulários */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[11px] font-bold text-[#1c1c1e] shrink-0">
                  Formulário ativo:
                </span>
                {forms.length > 1 ? (
                  <select
                    value={selectedFormId}
                    onChange={(e) => handleSelectForm(e.target.value)}
                    className="rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1 text-xs font-medium text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                  >
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name || 'Formulário Principal'} ({f.id.slice(0, 6)}…)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-[#475569]">
                    {selectedForm?.name ||
                      (forms.length === 0 ? 'Nenhum formulário ativo' : 'Formulário Principal')}
                  </span>
                )}

                {/* Indicador de Campanhas que usam este formulário */}
                {linkedCampaigns.length > 0 ? (
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-0.5 text-[10px] text-amber-800 font-medium">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span>
                      Usado em <strong>{linkedCampaigns.length}</strong>{' '}
                      {linkedCampaigns.length === 1 ? 'campanha' : 'campanhas'}:
                    </span>
                    <div className="flex items-center gap-1">
                      {linkedCampaigns.slice(0, 2).map((c) => (
                        <Link
                          key={c.id}
                          to="/campanhas"
                          className="font-bold underline hover:text-amber-900 truncate max-w-[120px]"
                          title={c.name}
                        >
                          {c.name}
                        </Link>
                      ))}
                      {linkedCampaigns.length > 2 && (
                        <span className="text-[9px] text-amber-700">
                          +{linkedCampaigns.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#94a3b8] italic">
                    (Nenhuma campanha vinculada a este formulário)
                  </span>
                )}
              </div>

              {/* Abas Lineares: Personalização vs Embed & Códigos */}
              <div
                data-tour-id="forms-tabs-nav"
                className="inline-flex rounded-md border border-[#cbd5e1] p-0.5 bg-white text-xs self-start sm:self-auto"
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('customize')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
                    activeTab === 'customize'
                      ? 'bg-[#0f172a] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#1c1c1e]'
                  }`}
                >
                  <Sliders className="size-3.5" />
                  Personalizar Campos & Visual
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('embed')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
                    activeTab === 'embed'
                      ? 'bg-[#0f172a] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#1c1c1e]'
                  }`}
                >
                  <Code2 className="size-3.5" />
                  Embed & Instalação
                </button>
              </div>
            </div>

            {/* CONTEÚDO DA ABA 1: PERSONALIZAÇÃO + PREVIEW AO VIVO */}
            {activeTab === 'customize' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
                {/* COLUNA ESQUERDA: EDITOR */}
                <form onSubmit={saveCaptureSettings} className="space-y-5">
                  {/* Logotipo */}
                  <div className="rounded-lg border border-[#e2e8f0] p-3.5 bg-white shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#1c1c1e] flex items-center gap-1.5">
                        <Camera className="size-3.5 text-amber-600" /> Logotipo do Formulário
                      </span>
                      {currentLogoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormLogoFile(null)
                            setFormLogoRemove(true)
                          }}
                          className="text-[10px] text-red-600 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="size-3" /> Remover logo
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {currentLogoUrl ? (
                        <div className="size-12 rounded border border-[#cbd5e1] bg-white p-1 grid place-items-center overflow-hidden">
                          <img
                            src={currentLogoUrl}
                            alt="Logo preview"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="size-12 rounded border border-dashed border-[#cbd5e1] bg-white grid place-items-center text-[#94a3b8]">
                          <Sparkles className="size-4" />
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] hover:bg-[#f1f5f9] transition">
                          <Upload className="size-3" /> Escolher logotipo
                          <input
                            type="file"
                            className="hidden"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) {
                                setFormLogoFile(f)
                                setFormLogoRemove(false)
                              }
                            }}
                          />
                        </label>
                        <p className="mt-1 text-[10px] text-[#64748b]">
                          PNG, JPG, WebP ou SVG (máx 5MB). Substitui o ícone padrão.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Textos & Nome do Formulário */}
                  <div className="rounded-lg border border-[#e2e8f0] p-3.5 bg-white shadow-xs space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                        Nome interno do formulário
                      </label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Ex: Formulário Principal - LP"
                        className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                        Título principal (visível aos leads)
                      </label>
                      <input
                        type="text"
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Ex: Vamos transformar seu processo comercial"
                        className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                        Subtítulo / Descrição
                      </label>
                      <textarea
                        rows={2}
                        value={formSubtitle}
                        onChange={(e) => setFormSubtitle(e.target.value)}
                        placeholder="Preencha o formulário abaixo..."
                        className="w-full resize-none rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                          Texto do botão de envio
                        </label>
                        <input
                          type="text"
                          required
                          value={formSubmitText}
                          onChange={(e) => setFormSubmitText(e.target.value)}
                          placeholder="Ex: Enviar solicitação"
                          className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                          Cor de acento / Botões
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formAccentColor}
                            onChange={(e) => setFormAccentColor(e.target.value)}
                            className="size-8 rounded cursor-pointer border border-[#cbd5e1] p-0.5 bg-white"
                          />
                          <input
                            type="text"
                            value={formAccentColor}
                            onChange={(e) => setFormAccentColor(e.target.value)}
                            placeholder="#f59e0b"
                            className="w-24 rounded-md border border-[#cbd5e1] px-2 py-1.5 font-mono text-xs uppercase text-[#1c1c1e] focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Presets de cores */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-[#94a3b8] mr-1 flex items-center gap-1">
                        <Palette className="size-3" /> Sugestões:
                      </span>
                      {presetColors.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setFormAccentColor(c.hex)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border border-[#cbd5e1] hover:bg-[#f1f5f9] transition"
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: c.hex }}
                          />
                          {c.name}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                        Mensagem de agradecimento (pós-envio)
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={formSuccessMessage}
                        onChange={(e) => setFormSuccessMessage(e.target.value)}
                        placeholder="Muito obrigado pelo contato..."
                        className="w-full resize-none rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Configuração dos campos padrão */}
                  <div className="rounded-lg border border-[#e2e8f0] p-3.5 bg-white shadow-xs">
                    <h3 className="text-xs font-bold text-[#1c1c1e] mb-1">
                      Campos Padrão do Formulário
                    </h3>
                    <p className="text-[10px] text-[#64748b] mb-3">
                      Nome e E-mail são obrigatórios para identificar o contato no CRM. Configure a
                      visibilidade dos demais:
                    </p>

                    <div className="divide-y divide-[#e2e8f0] text-xs">
                      {/* Nome */}
                      <div className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#1c1c1e]">Nome completo</span>
                          <span className="ml-2 text-[10px] text-[#94a3b8]">Base do contato</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Obrigatório
                        </span>
                      </div>

                      {/* Email */}
                      <div className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#1c1c1e]">E-mail</span>
                          <span className="ml-2 text-[10px] text-[#94a3b8]">Identificador</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Obrigatório
                        </span>
                      </div>

                      {/* Telefone */}
                      <div className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#1c1c1e]">Telefone / WhatsApp</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-[11px] text-[#475569] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showPhone}
                              onChange={(e) => setShowPhone(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            Visível
                          </label>
                          <label
                            className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${
                              showPhone ? 'text-[#475569]' : 'text-[#cbd5e1] pointer-events-none'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!showPhone}
                              checked={showPhone && requirePhone}
                              onChange={(e) => setRequirePhone(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            Obrigatório
                          </label>
                        </div>
                      </div>

                      {/* Empresa */}
                      <div className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#1c1c1e]">Nome da empresa</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-[11px] text-[#475569] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showCompany}
                              onChange={(e) => setShowCompany(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            Visível
                          </label>
                          <label
                            className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${
                              showCompany ? 'text-[#475569]' : 'text-[#cbd5e1] pointer-events-none'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!showCompany}
                              checked={showCompany && requireCompany}
                              onChange={(e) => setRequireCompany(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            Obrigatório
                          </label>
                        </div>
                      </div>

                      {/* Cargo */}
                      <div className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#1c1c1e]">Cargo</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-[11px] text-[#475569] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showPosition}
                              onChange={(e) => setShowPosition(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            Visível
                          </label>
                          <label
                            className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${
                              showPosition ? 'text-[#475569]' : 'text-[#cbd5e1] pointer-events-none'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!showPosition}
                              checked={showPosition && requirePosition}
                              onChange={(e) => setRequirePosition(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            Obrigatório
                          </label>
                        </div>
                      </div>

                      {/* Mensagem */}
                      <div className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#1c1c1e]">
                            Necessidade / Desafio
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-[11px] text-[#475569] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showMessage}
                              onChange={(e) => setShowMessage(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            Visível
                          </label>
                          <label
                            className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${
                              showMessage ? 'text-[#475569]' : 'text-[#cbd5e1] pointer-events-none'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!showMessage}
                              checked={showMessage && requireMessage}
                              onChange={(e) => setRequireMessage(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500"
                            />
                            Obrigatório
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Campos Personalizados */}
                  <div
                    data-tour-id="forms-custom-fields-section"
                    className="rounded-lg border border-[#e2e8f0] p-3.5 bg-white shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1.5">
                        <Plus className="size-3.5 text-amber-600" />
                        Campos Personalizados
                      </h3>
                      <button
                        type="button"
                        onClick={openNewCustomFieldModal}
                        className="inline-flex items-center gap-1 rounded border border-[#cbd5e1] bg-white px-2 py-1 text-[11px] font-semibold text-[#1c1c1e] hover:bg-[#f1f5f9] transition shadow-2xs"
                      >
                        <Plus className="size-3 text-amber-600" /> Adicionar campo
                      </button>
                    </div>
                    <p className="text-[10px] text-[#64748b] mb-3">
                      Crie campos específicos para seu segmento (ex: Orçamento, Segmento, Número de
                      licenças).
                    </p>

                    {customFields.length === 0 ? (
                      <div className="rounded-md border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-center">
                        <p className="text-xs text-[#64748b]">
                          Nenhum campo personalizado adicionado ainda.
                        </p>
                        <button
                          type="button"
                          onClick={openNewCustomFieldModal}
                          className="mt-2 text-[11px] font-semibold text-amber-600 hover:underline"
                        >
                          + Criar primeiro campo personalizado
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customFields.map((field, index) => {
                          const typeLabels: Record<CustomFieldType, string> = {
                            text: 'Texto curto',
                            textarea: 'Texto longo',
                            number: 'Número',
                            phone: 'Telefone',
                            email: 'E-mail',
                            select: 'Seleção única',
                            checkbox: 'Checkbox',
                          }
                          return (
                            <div
                              key={field.id}
                              className="flex items-center justify-between rounded-md border border-[#e2e8f0] bg-[#fafafa] p-2.5 text-xs shadow-2xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[#1c1c1e] truncate">
                                    {field.label}
                                  </span>
                                  <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[9px] font-mono text-[#64748b]">
                                    {typeLabels[field.type] || field.type}
                                  </span>
                                  {field.required ? (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                      Obrigatório
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-[#94a3b8]">Opcional</span>
                                  )}
                                </div>
                                {field.type === 'select' && field.options && (
                                  <p className="text-[10px] text-[#64748b] mt-0.5 truncate">
                                    Opções: {field.options.join(', ')}
                                  </p>
                                )}
                                {field.placeholder && (
                                  <p className="text-[10px] text-[#94a3b8] mt-0.5 italic truncate">
                                    Placeholder: "{field.placeholder}"
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => moveCustomField(index, 'up')}
                                  title="Mover para cima"
                                  className="p-1 rounded text-[#64748b] hover:bg-[#f1f5f9] disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  <ArrowUp className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === customFields.length - 1}
                                  onClick={() => moveCustomField(index, 'down')}
                                  title="Mover para baixo"
                                  className="p-1 rounded text-[#64748b] hover:bg-[#f1f5f9] disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  <ArrowDown className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditCustomFieldModal(field)}
                                  className="rounded px-2 py-1 text-[10px] font-medium text-[#475569] hover:bg-[#f1f5f9]"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeCustomField(field.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Remover campo"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Botão de Salvar */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="submit"
                      disabled={savingForm}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-500 px-4 text-xs font-bold text-white shadow-xs transition hover:bg-amber-600 disabled:opacity-60"
                    >
                      {savingForm ? (
                        <>
                          <LoaderCircle className="size-3.5 animate-spin" />
                          Salvando alterações...
                        </>
                      ) : (
                        <>
                          <Save className="size-3.5" />
                          Salvar personalização do formulário
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('embed')}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-1"
                    >
                      Ver código de embed <Code2 className="size-3.5" />
                    </button>
                  </div>
                </form>

                {/* COLUNA DIREITA: PREVIEW AO VIVO DA PERSONALIZAÇÃO */}
                <div
                  data-tour-id="forms-live-preview"
                  className="flex flex-col rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-4 shadow-2xs sticky top-4"
                >
                  <div className="mb-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs">
                    <span className="text-[11px] font-medium text-[#475569]">
                      Quer incorporar este formulário no seu site?
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('embed')}
                      className="inline-flex items-center gap-1 font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                    >
                      Ver código de incorporação <span aria-hidden="true">→</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                    <div className="flex items-center gap-1.5">
                      <Eye className="size-3.5 text-amber-600" />
                      <span className="text-xs font-extrabold text-[#1c1c1e]">
                        Prévia em tempo real
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-[#cbd5e1] rounded p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setPreviewTab('form')}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          previewTab === 'form'
                            ? 'bg-amber-500 text-white'
                            : 'text-[#64748b] hover:text-[#1c1c1e]'
                        }`}
                      >
                        Formulário
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab('success')}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          previewTab === 'success'
                            ? 'bg-amber-500 text-white'
                            : 'text-[#64748b] hover:text-[#1c1c1e]'
                        }`}
                      >
                        Pós-envio
                      </button>
                    </div>
                  </div>

                  {/* Live Preview Container */}
                  <div className="mt-3 flex-1 overflow-y-auto max-h-[640px] rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-xs">
                    {/* Brand & Header */}
                    <div className="text-center mb-4">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {currentLogoUrl ? (
                          <img
                            src={currentLogoUrl}
                            alt="Logo"
                            className="max-h-8 max-w-[140px] object-contain rounded"
                          />
                        ) : (
                          <>
                            <div
                              className="size-6 rounded grid place-items-center font-black text-xs"
                              style={{
                                backgroundColor: `${formAccentColor}1A`,
                                borderColor: `${formAccentColor}33`,
                                borderWidth: 1,
                                color: formAccentColor,
                              }}
                            >
                              <Sparkles className="size-3" style={{ color: formAccentColor }} />
                            </div>
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#1c1c1e]">
                              CRM Adapta
                            </span>
                          </>
                        )}
                      </div>
                      <h4 className="text-sm font-extrabold text-[#1c1c1e] leading-snug">
                        {formTitle || 'Título do Formulário'}
                      </h4>
                      {formSubtitle && (
                        <p className="mt-1 text-[10px] text-[#64748b] leading-relaxed">
                          {formSubtitle}
                        </p>
                      )}
                    </div>

                    {previewTab === 'form' ? (
                      <div className="space-y-3 pointer-events-none opacity-90 select-none">
                        {/* Nome */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                            Seu nome completo <span style={{ color: formAccentColor }}>*</span>
                          </label>
                          <div className="relative">
                            <User className="absolute left-2.5 top-2 size-3 text-[#94a3b8]" />
                            <input
                              readOnly
                              value="Carlos Eduardo"
                              className="w-full rounded border border-[#cbd5e1] py-1.5 pl-8 pr-2 text-[11px] bg-white"
                            />
                          </div>
                        </div>

                        {/* Email */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                            E-mail profissional <span style={{ color: formAccentColor }}>*</span>
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-2 size-3 text-[#94a3b8]" />
                            <input
                              readOnly
                              value="carlos@empresa.com.br"
                              className="w-full rounded border border-[#cbd5e1] py-1.5 pl-8 pr-2 text-[11px] bg-white"
                            />
                          </div>
                        </div>

                        {/* Telefone */}
                        {showPhone && (
                          <div>
                            <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                              Telefone / WhatsApp{' '}
                              {requirePhone ? (
                                <span style={{ color: formAccentColor }}>*</span>
                              ) : (
                                <span className="text-[9px] font-normal text-[#94a3b8]">
                                  (opcional)
                                </span>
                              )}
                            </label>
                            <div className="relative">
                              <Phone className="absolute left-2.5 top-2 size-3 text-[#94a3b8]" />
                              <input
                                readOnly
                                value="(11) 98765-4321"
                                className="w-full rounded border border-[#cbd5e1] py-1.5 pl-8 pr-2 text-[11px] bg-white"
                              />
                            </div>
                          </div>
                        )}

                        {/* Empresa & Cargo */}
                        {(showCompany || showPosition) && (
                          <div
                            className={`grid gap-2 ${
                              showCompany && showPosition ? 'grid-cols-2' : 'grid-cols-1'
                            }`}
                          >
                            {showCompany && (
                              <div>
                                <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                                  Empresa{' '}
                                  {requireCompany ? (
                                    <span style={{ color: formAccentColor }}>*</span>
                                  ) : (
                                    <span className="text-[9px] font-normal text-[#94a3b8]">
                                      (opc)
                                    </span>
                                  )}
                                </label>
                                <div className="relative">
                                  <Building2 className="absolute left-2.5 top-2 size-3 text-[#94a3b8]" />
                                  <input
                                    readOnly
                                    value="Acme Inc"
                                    className="w-full rounded border border-[#cbd5e1] py-1.5 pl-8 pr-2 text-[11px] bg-white"
                                  />
                                </div>
                              </div>
                            )}
                            {showPosition && (
                              <div>
                                <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                                  Cargo{' '}
                                  {requirePosition ? (
                                    <span style={{ color: formAccentColor }}>*</span>
                                  ) : (
                                    <span className="text-[9px] font-normal text-[#94a3b8]">
                                      (opc)
                                    </span>
                                  )}
                                </label>
                                <input
                                  readOnly
                                  value="Diretor Comercial"
                                  className="w-full rounded border border-[#cbd5e1] py-1.5 px-2 text-[11px] bg-white"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Mensagem */}
                        {showMessage && (
                          <div>
                            <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                              Necessidade / Desafio{' '}
                              {requireMessage ? (
                                <span style={{ color: formAccentColor }}>*</span>
                              ) : (
                                <span className="text-[9px] font-normal text-[#94a3b8]">
                                  (opcional)
                                </span>
                              )}
                            </label>
                            <div className="relative">
                              <MessageSquare className="absolute left-2.5 top-2 size-3 text-[#94a3b8]" />
                              <div className="w-full rounded border border-[#cbd5e1] py-1.5 pl-8 pr-2 text-[10px] text-[#64748b] bg-white h-12">
                                Gostaria de integrar a captação de leads com o CRM...
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Campos Personalizados Preview */}
                        {customFields.map((cf) => (
                          <div key={cf.id}>
                            {cf.type === 'checkbox' ? (
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="checkbox"
                                  readOnly
                                  checked={false}
                                  className="rounded border-[#cbd5e1]"
                                />
                                <label className="text-[10px] font-semibold text-[#475569]">
                                  {cf.label}{' '}
                                  {cf.required ? (
                                    <span style={{ color: formAccentColor }}>*</span>
                                  ) : (
                                    <span className="text-[9px] font-normal text-[#94a3b8]">
                                      (opcional)
                                    </span>
                                  )}
                                </label>
                              </div>
                            ) : cf.type === 'select' ? (
                              <div>
                                <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                                  {cf.label}{' '}
                                  {cf.required ? (
                                    <span style={{ color: formAccentColor }}>*</span>
                                  ) : (
                                    <span className="text-[9px] font-normal text-[#94a3b8]">
                                      (opcional)
                                    </span>
                                  )}
                                </label>
                                <select
                                  disabled
                                  className="w-full rounded border border-[#cbd5e1] py-1.5 px-2 text-[11px] bg-white text-[#64748b]"
                                >
                                  <option value="">
                                    {cf.placeholder || 'Selecione uma opção...'}
                                  </option>
                                  {cf.options?.map((opt, i) => (
                                    <option key={i} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : cf.type === 'textarea' ? (
                              <div>
                                <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                                  {cf.label}{' '}
                                  {cf.required ? (
                                    <span style={{ color: formAccentColor }}>*</span>
                                  ) : (
                                    <span className="text-[9px] font-normal text-[#94a3b8]">
                                      (opcional)
                                    </span>
                                  )}
                                </label>
                                <div className="w-full rounded border border-[#cbd5e1] py-1.5 px-2 text-[10px] text-[#94a3b8] bg-white h-10 italic">
                                  {cf.placeholder || 'Texto detalhado...'}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                                  {cf.label}{' '}
                                  {cf.required ? (
                                    <span style={{ color: formAccentColor }}>*</span>
                                  ) : (
                                    <span className="text-[9px] font-normal text-[#94a3b8]">
                                      (opcional)
                                    </span>
                                  )}
                                </label>
                                <input
                                  readOnly
                                  placeholder={cf.placeholder || `Ex: ${cf.label}`}
                                  className="w-full rounded border border-[#cbd5e1] py-1.5 px-2 text-[11px] bg-white placeholder:text-[#94a3b8]"
                                />
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Botão de Envio Preview */}
                        <div
                          className="w-full py-2 px-3 rounded text-center text-xs font-bold text-white shadow-2xs flex items-center justify-center gap-1.5"
                          style={{ backgroundColor: formAccentColor }}
                        >
                          <Send className="size-3" />
                          {formSubmitText || 'Enviar solicitação'}
                        </div>

                        <p className="text-[9px] text-center text-[#94a3b8]">
                          🔒 Seus dados são protegidos e nunca compartilhados.
                        </p>
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                          <Check className="size-5 text-emerald-600" />
                        </div>
                        <h5 className="mt-3 text-xs font-bold text-[#1c1c1e]">
                          Recebemos sua mensagem!
                        </h5>
                        <p className="mt-1 text-[11px] text-[#64748b] leading-relaxed max-w-xs mx-auto">
                          {formSuccessMessage}
                        </p>
                        <span className="font-mono text-[10px] font-semibold text-[#1c1c1e] block mt-2">
                          Protocolo: NEG-1042
                        </span>
                        <button
                          type="button"
                          className="mt-4 text-[11px] font-semibold"
                          style={{ color: formAccentColor }}
                        >
                          Enviar outro contato
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CONTEÚDO DA ABA 2: EMBED, CÓDIGOS, GUIAS & PREVIEW DO IFRAME */}
            {activeTab === 'embed' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Coluna Esquerda: URL direta + Códigos de Incorporação */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Card 1: Link Público Direto */}
                  <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="size-4 text-amber-600" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#1c1c1e]">
                        URL Pública do Formulário
                      </h2>
                    </div>
                    <p className="text-[11px] text-[#64748b] mb-3">
                      Página autônoma pronta para envio direto em redes sociais, mensagens de
                      WhatsApp ou e-mails comerciais.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2">
                      <input
                        type="text"
                        readOnly
                        value={dedicatedUrl}
                        className="flex-1 bg-transparent px-2 font-mono text-[11px] text-[#1c1c1e] select-all focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={copyUrl}
                          className="inline-flex h-8 items-center gap-1.5 rounded bg-white border border-[#cbd5e1] px-2.5 text-[11px] font-semibold text-[#1c1c1e] hover:bg-[#f1f5f9] transition shadow-2xs"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="size-3 text-emerald-600" />
                              <span className="text-emerald-700">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3 text-[#64748b]" />
                              <span>Copiar URL</span>
                            </>
                          )}
                        </button>
                        <a
                          href={dedicatedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded bg-white border border-[#cbd5e1] px-2.5 text-[11px] font-semibold text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition shadow-2xs"
                          title="Abrir em nova aba"
                        >
                          <ExternalLink className="size-3" />
                          <span>Abrir</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Códigos de Incorporação */}
                  <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e5e7eb]">
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#1c1c1e] flex items-center gap-2">
                          <Code2 className="size-4 text-amber-600" />
                          Código de Incorporação
                        </h2>
                        <p className="mt-0.5 text-[11px] text-[#64748b]">
                          Escolha o formato ideal para injetar o formulário no seu site.
                        </p>
                      </div>

                      <div className="inline-flex rounded-md border border-[#cbd5e1] p-0.5 bg-white text-[11px] self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setEmbedType('iframe')}
                          className={`px-2.5 py-1 rounded font-semibold transition ${
                            embedType === 'iframe'
                              ? 'bg-[#0f172a] text-white shadow-xs'
                              : 'text-[#64748b] hover:text-[#1c1c1e]'
                          }`}
                        >
                          <Code2 className="size-3 inline mr-1" /> iframe
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmbedType('script')}
                          className={`px-2.5 py-1 rounded font-semibold transition ${
                            embedType === 'script'
                              ? 'bg-[#0f172a] text-white shadow-xs'
                              : 'text-[#64748b] hover:text-[#1c1c1e]'
                          }`}
                        >
                          <FileCode className="size-3 inline mr-1" /> Script responsivo
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
                          {embedType === 'iframe'
                            ? 'HTML / IFRAME SNIPPET'
                            : 'JAVASCRIPT AUTO-INJETÁVEL'}
                        </span>
                        <button
                          type="button"
                          onClick={copySnippet}
                          className="inline-flex items-center gap-1.5 rounded bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                        >
                          {copiedEmbed ? (
                            <>
                              <Check className="size-3 text-emerald-600" />
                              <span>Copiado para a área de transferência!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              <span>Copiar código</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="p-3.5 bg-[#0f172a] text-[#e2e8f0] rounded-md font-mono text-[11px] overflow-x-auto select-all leading-relaxed shadow-inner">
                        {currentSnippet}
                      </pre>
                    </div>

                    {/* Guia Rápido de Instalação */}
                    <div className="mt-4 pt-4 border-t border-[#f1f5f9] grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                      <div className="rounded border border-[#e2e8f0] bg-[#fafafa] p-2.5">
                        <span className="font-mono text-[10px] font-bold text-amber-700">
                          01. WordPress / Elementor
                        </span>
                        <p className="mt-1 text-[10px] text-[#64748b] leading-tight">
                          Adicione um bloco de "HTML Personalizado" na página e cole o código acima.
                        </p>
                      </div>
                      <div className="rounded border border-[#e2e8f0] bg-[#fafafa] p-2.5">
                        <span className="font-mono text-[10px] font-bold text-amber-700">
                          02. Webflow / Framer
                        </span>
                        <p className="mt-1 text-[10px] text-[#64748b] leading-tight">
                          Use o componente "Embed" na seção desejada e publique o projeto.
                        </p>
                      </div>
                      <div className="rounded border border-[#e2e8f0] bg-[#fafafa] p-2.5">
                        <span className="font-mono text-[10px] font-bold text-amber-700">
                          03. HTML Puro
                        </span>
                        <p className="mt-1 text-[10px] text-[#64748b] leading-tight">
                          Cole diretamente na tag &lt;body&gt; ou dentro do container da sua landing
                          page.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Banner com atalho de volta para personalizar */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-md bg-amber-100 border border-amber-200 grid place-items-center shrink-0">
                        <Sliders className="size-4 text-amber-700" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#1c1c1e]">
                          Ajustar logotipo, cores ou campos?
                        </h3>
                        <p className="text-[11px] text-[#64748b]">
                          Você pode editar o formulário na mesma tela sem sair desta página.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('customize')}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition shadow-2xs"
                    >
                      Personalizar <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>

                {/* Coluna Direita: Pré-visualização do Embed com alternador Desktop/Mobile */}
                <div className="lg:col-span-5">
                  <div className="rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-3 shadow-xs sticky top-4">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#e2e8f0] mb-3">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-600" />
                        <span className="text-xs font-extrabold text-[#1c1c1e]">
                          Prévia do Embed
                        </span>
                      </div>

                      <div className="flex items-center gap-1 bg-white border border-[#cbd5e1] rounded p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('desktop')}
                          className={`px-2 py-0.5 rounded font-semibold ${
                            previewDevice === 'desktop'
                              ? 'bg-[#0f172a] text-white'
                              : 'text-[#64748b] hover:text-[#1c1c1e]'
                          }`}
                        >
                          Desktop
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('mobile')}
                          className={`px-2 py-0.5 rounded font-semibold ${
                            previewDevice === 'mobile'
                              ? 'bg-[#0f172a] text-white'
                              : 'text-[#64748b] hover:text-[#1c1c1e]'
                          }`}
                        >
                          Mobile (380px)
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-[#64748b] mb-2 flex items-center justify-between">
                      <span>
                        Visualizando:{' '}
                        <strong>{selectedForm?.name || 'Formulário Principal'}</strong>
                      </span>
                      <a
                        href={dedicatedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-600 hover:underline flex items-center gap-0.5"
                      >
                        Abrir original <ExternalLink className="size-2.5" />
                      </a>
                    </div>

                    {/* Container do iframe com moldura */}
                    <div className="flex justify-center bg-white p-2 rounded border border-[#e2e8f0] shadow-inner overflow-hidden">
                      <div
                        className="transition-all duration-300 w-full"
                        style={{
                          maxWidth: previewDevice === 'mobile' ? '380px' : '100%',
                        }}
                      >
                        <iframe
                          key={iframeKey}
                          src={dedicatedUrl}
                          title="Pré-visualização do Formulário"
                          className="w-full h-[640px] rounded-md border border-[#e2e8f0] bg-white shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL DE NOVO FORMULÁRIO */}
        {creatingNewFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-lg border border-[#e2e8f0] bg-white p-5 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                <h3 className="text-sm font-bold text-[#1c1c1e]">Novo Formulário de Captação</h3>
                <button
                  type="button"
                  onClick={() => setCreatingNewFormModal(false)}
                  className="text-[#64748b] hover:text-[#1c1c1e] text-xs font-semibold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateNewForm} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                    Nome do formulário <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newFormName}
                    onChange={(e) => setNewFormName(e.target.value)}
                    placeholder="Ex: LP Black Friday, Formulário Parcerias, Demo..."
                    className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <p className="mt-1 text-[10px] text-[#64748b]">
                    Você poderá personalizar o visual, logo e campos logo em seguida.
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8f0]">
                  <button
                    type="button"
                    onClick={() => setCreatingNewFormModal(false)}
                    className="rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creatingForm || !newFormName.trim()}
                    className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition disabled:opacity-50"
                  >
                    {creatingForm ? 'Criando...' : 'Criar formulário'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE EDIÇÃO DE CAMPO PERSONALIZADO */}
        {editingFieldId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg border border-[#e2e8f0] bg-white p-5 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                <h3 className="text-sm font-bold text-[#1c1c1e]">
                  {editingFieldId === '__new__'
                    ? 'Adicionar Campo Personalizado'
                    : 'Editar Campo Personalizado'}
                </h3>
                <button
                  type="button"
                  onClick={closeCustomFieldModal}
                  className="text-[#64748b] hover:text-[#1c1c1e] text-xs font-semibold"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                    Rótulo do campo (Label) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fieldLabel}
                    onChange={(e) => setFieldLabel(e.target.value)}
                    placeholder="Ex: Segmento da empresa, Orçamento estimado..."
                    className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Tipo do campo
                    </label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
                      className="w-full rounded-md border border-[#cbd5e1] px-2.5 py-1.5 text-xs text-[#1c1c1e] bg-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="text">Texto curto</option>
                      <option value="textarea">Texto longo</option>
                      <option value="number">Número</option>
                      <option value="phone">Telefone</option>
                      <option value="email">E-mail</option>
                      <option value="select">Seleção única</option>
                      <option value="checkbox">Checkbox (Sim/Não)</option>
                    </select>
                  </div>

                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#1c1c1e] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fieldRequired}
                        onChange={(e) => setFieldRequired(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-amber-500"
                      />
                      Preenchimento obrigatório
                    </label>
                  </div>
                </div>

                {fieldType !== 'checkbox' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Texto de ajuda / Placeholder (opcional)
                    </label>
                    <input
                      type="text"
                      value={fieldPlaceholder}
                      onChange={(e) => setFieldPlaceholder(e.target.value)}
                      placeholder="Ex: Selecione ou digite aqui..."
                      className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}

                {fieldType === 'select' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Opções de seleção <span className="text-red-500">*</span>{' '}
                      <span className="font-normal text-[#94a3b8]">(uma por linha)</span>
                    </label>
                    <textarea
                      rows={4}
                      value={fieldOptionsText}
                      onChange={(e) => setFieldOptionsText(e.target.value)}
                      placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                      className="w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={closeCustomFieldModal}
                  className="rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveCustomField}
                  className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition"
                >
                  {editingFieldId === '__new__' ? 'Adicionar campo' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
