import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  Code2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileCode,
  Globe,
  Layers,
  LoaderCircle,
  Megaphone,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  listCaptureForms,
  updateCampaign,
} from '@/services/crm'
import { useCrm } from '@/contexts/CrmContext'
import type { Campaign, CaptureForm } from '@/types/crm'
import { datePt } from '@/types/crm'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function Campaigns() {
  const { deals } = useCrm()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [forms, setForms] = useState<CaptureForm[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | Campaign['status']>('todos')

  // Selected campaign for viewing embed / details
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  // Dialog state (criar / editar)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formId, setFormId] = useState('')
  const [status, setStatus] = useState<Campaign['status']>('ativa')
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Delete modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Embed format inside preview drawer
  const [embedFormat, setEmbedFormat] = useState<'iframe' | 'script'>('iframe')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  // Load campaigns and forms
  useEffect(() => {
    let active = true
    async function loadData() {
      try {
        setLoading(true)
        const [campsData, formsData] = await Promise.all([listCampaigns(), listCaptureForms()])
        if (active) {
          setCampaigns(campsData)
          setForms(formsData)
          if (campsData.length > 0 && !selectedCampaignId) {
            setSelectedCampaignId(campsData[0].id)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar campanhas:', err)
        toast({
          title: 'Erro ao carregar campanhas',
          description: getErrorMessage(err),
          variant: 'destructive',
        })
      } finally {
        if (active) setLoading(false)
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [])

  // Map campaign ID to leads count
  const leadsPerCampaign = useMemo(() => {
    const counts: Record<string, number> = {}
    deals.forEach((deal) => {
      // 1. Direct campaign link
      if (deal.campaign) {
        counts[deal.campaign] = (counts[deal.campaign] || 0) + 1
      }
    })
    return counts
  }, [deals])

  // Filtered campaigns
  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesQuery =
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(query.toLowerCase())
      const matchesStatus = statusFilter === 'todos' || c.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [campaigns, query, statusFilter])

  // Currently inspected campaign
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null,
    [campaigns, selectedCampaignId],
  )

  // Linked form for selected campaign
  const linkedForm = useMemo(() => {
    if (!selectedCampaign?.form) return null
    return (
      forms.find((f) => f.id === selectedCampaign.form) || selectedCampaign.expand?.form || null
    )
  }, [selectedCampaign, forms])

  // Public Form URL for selected campaign (com tracking da campanha via querystring)
  const publicFormUrl = useMemo(() => {
    const base = linkedForm?.id
      ? `${window.location.origin}/form/${linkedForm.id}`
      : `${window.location.origin}/captura`
    if (selectedCampaign?.id) {
      return `${base}?campaign=${selectedCampaign.id}`
    }
    return base
  }, [linkedForm, selectedCampaign])

  const iframeSnippet = `<iframe\n  src="${publicFormUrl}"\n  width="100%"\n  height="720"\n  frameborder="0"\n  style="border:none; border-radius:12px; max-width:600px; width:100%; display:block; margin:0 auto;"\n></iframe>`

  const scriptSnippet = `<!-- Embed Campanha: ${selectedCampaign?.name || 'CRM'} -->\n<div id="crm-campaign-form-${selectedCampaign?.id || 'lead'}" style="max-width:600px; margin:0 auto;"></div>\n<script>\n  (function() {\n    var ifr = document.createElement("iframe");\n    ifr.src = "${publicFormUrl}";\n    ifr.style.width = "100%";\n    ifr.style.height = "720px";\n    ifr.style.border = "none";\n    ifr.style.borderRadius = "12px";\n    var container = document.getElementById("crm-campaign-form-${selectedCampaign?.id || 'lead'}");\n    if (container) container.appendChild(ifr);\n  })();\n</script>`

  const activeSnippet = embedFormat === 'iframe' ? iframeSnippet : scriptSnippet

  function handleOpenCreate() {
    setEditingCampaign(null)
    setName('')
    setDescription('')
    setFormId(forms[0]?.id || '')
    setStatus('ativa')
    setFormErrors({})
    setDialogOpen(true)
  }

  function handleOpenEdit(camp: Campaign, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setEditingCampaign(camp)
    setName(camp.name)
    setDescription(camp.description || '')
    setFormId(camp.form || '')
    setStatus(camp.status)
    setFormErrors({})
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) {
      errs.name = 'O nome da campanha é obrigatório.'
    }
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs)
      return
    }

    setSaving(true)
    try {
      if (editingCampaign) {
        const updated = await updateCampaign(editingCampaign.id, {
          name: name.trim(),
          description: description.trim(),
          form: formId || undefined,
          status,
        })
        setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        toast({
          title: 'Campanha atualizada!',
          description: `A campanha "${updated.name}" foi salva com sucesso.`,
        })
      } else {
        const created = await createCampaign({
          name: name.trim(),
          description: description.trim(),
          form: formId || undefined,
          status,
        })
        setCampaigns((prev) => [created, ...prev])
        setSelectedCampaignId(created.id)
        toast({
          title: 'Campanha criada com sucesso!',
          description: `A campanha "${created.name}" já está pronta com embed dedicado.`,
        })
      }
      setDialogOpen(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar campanha',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await deleteCampaign(id)
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      if (selectedCampaignId === id) {
        const remaining = campaigns.filter((c) => c.id !== id)
        setSelectedCampaignId(remaining[0]?.id || null)
      }
      toast({ title: 'Campanha excluída com sucesso' })
      setDeleteConfirmId(null)
    } catch (err) {
      toast({
        title: 'Erro ao excluir campanha',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(publicFormUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
    toast({
      title: 'Link copiado!',
      description: 'URL do formulário da campanha pronta para divulgação.',
    })
  }

  function copyEmbed() {
    navigator.clipboard.writeText(activeSnippet)
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 2000)
    toast({
      title: 'Embed copiado!',
      description: 'Código pronto para colar em landing pages ou sites.',
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header Linear Style */}
      <div className="shrink-0 border-b border-[#e5e7eb] px-4 pb-3 pt-4 sm:px-6">
        <div
          data-tour-id="campaigns-header-actions"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-600">
                Marketing & Aquisição
              </p>
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-700">
                CAMPANHAS
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e] flex items-center gap-2">
              <Megaphone className="size-5 text-amber-600" />
              Campanhas de Captação
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Gerencie suas campanhas de captação, vincule formulários específicos e obtenha códigos
              de embed prontos para conversão.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/formularios"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition shadow-2xs"
            >
              <Layers className="size-3.5 text-amber-600" /> Formulários de Captação
            </Link>
            <button
              onClick={handleOpenCreate}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-amber-600"
            >
              <Plus className="size-3.5" /> Nova Campanha
            </button>
          </div>
        </div>

        {/* Filters and search */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs sm:max-w-xs">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou descrição…"
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
            />
          </label>

          <div className="inline-flex rounded-md border border-[#cbd5e1] p-0.5 bg-white text-[11px]">
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                statusFilter === 'todos'
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#1c1c1e]',
              )}
            >
              Todos ({campaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ativa')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                statusFilter === 'ativa'
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#1c1c1e]',
              )}
            >
              Ativas ({campaigns.filter((c) => c.status === 'ativa').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pausada')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                statusFilter === 'pausada'
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#1c1c1e]',
              )}
            >
              Pausadas ({campaigns.filter((c) => c.status === 'pausada').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('encerrada')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                statusFilter === 'encerrada'
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#1c1c1e]',
              )}
            >
              Encerradas ({campaigns.filter((c) => c.status === 'encerrada').length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Split Table + Live Embed Drawer/Inspector */}
      <div className="min-h-0 flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Table Column */}
        <div
          data-tour-id="campaigns-table"
          className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 border-r border-[#e5e7eb] overflow-y-auto"
        >
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-xs text-[#64748b]">
              <LoaderCircle className="size-6 animate-spin text-amber-500" />
              <span>Carregando campanhas...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center px-4">
              <Megaphone className="mx-auto size-8 text-[#94a3b8] mb-2" />
              <p className="text-xs font-semibold text-[#1c1c1e]">Nenhuma campanha encontrada</p>
              <p className="text-[11px] text-[#64748b] mt-1 max-w-sm mx-auto">
                {query
                  ? 'Nenhum resultado para a busca. Tente outros termos.'
                  : 'Crie sua primeira campanha para gerar links de embed dedicados e rastrear captação de leads.'}
              </p>
              {!query && (
                <button
                  onClick={handleOpenCreate}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition shadow-xs"
                >
                  <Plus className="size-3.5" /> Criar primeira campanha
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Table Header Linear Light */}
              <div className="grid h-8 grid-cols-[minmax(180px,1.4fr)_100px_minmax(150px,1fr)_90px_100px_70px] items-center border-b border-[#e5e7eb] bg-[#fafafa] px-4 text-[9px] font-semibold text-[#64748b] sticky top-0 z-10">
                <span>Campanha</span>
                <span>Status</span>
                <span>Formulário Vinculado</span>
                <span className="text-right">Leads Gerados</span>
                <span className="text-right">Criada em</span>
                <span className="text-right">Ações</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#f1f5f9]">
                {filtered.map((camp) => {
                  const isSelected = selectedCampaign?.id === camp.id
                  const campForm =
                    forms.find((f) => f.id === camp.form) || camp.expand?.form || null
                  const leadCount = leadsPerCampaign[camp.id] || 0

                  return (
                    <div
                      key={camp.id}
                      onClick={() => setSelectedCampaignId(camp.id)}
                      className={cn(
                        'group grid min-h-12 grid-cols-[minmax(180px,1.4fr)_100px_minmax(150px,1fr)_90px_100px_70px] items-center px-4 text-[11px] transition cursor-pointer',
                        isSelected ? 'bg-amber-50/50 hover:bg-amber-50/70' : 'hover:bg-[#f8fafc]',
                      )}
                    >
                      {/* Name & Description */}
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'font-bold truncate text-[#1c1c1e]',
                              isSelected && 'text-amber-900',
                            )}
                          >
                            {camp.name}
                          </span>
                        </div>
                        {camp.description ? (
                          <p className="truncate text-[10px] text-[#64748b] mt-0.5">
                            {camp.description}
                          </p>
                        ) : (
                          <p className="text-[10px] text-[#94a3b8] italic">Sem descrição</p>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        <CampaignStatusBadge status={camp.status} />
                      </div>

                      {/* Form */}
                      <div className="min-w-0 pr-3">
                        {campForm ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: campForm.accent_color || '#f59e0b' }}
                            />
                            <span className="truncate text-[#334155] font-medium text-[11px]">
                              {campForm.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#94a3b8] italic">
                            Formulário padrão
                          </span>
                        )}
                      </div>

                      {/* Leads Count */}
                      <div className="text-right font-mono font-bold text-[#1c1c1e] text-[11px] pr-2">
                        {leadCount}
                      </div>

                      {/* Created date */}
                      <div className="text-right font-mono text-[10px] text-[#64748b]">
                        {datePt(camp.created)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(camp, e)}
                          title="Editar campanha"
                          className="p-1 rounded text-[#64748b] hover:bg-white hover:text-[#1c1c1e] border border-transparent hover:border-[#cbd5e1] transition"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(camp.id)
                          }}
                          title="Excluir campanha"
                          className="p-1 rounded text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Embed & Campaign Details Inspector Column */}
        <div
          data-tour-id="campaigns-embed-preview"
          className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-0 bg-[#f8fafc] overflow-y-auto p-4 space-y-4"
        >
          {selectedCampaign ? (
            <>
              {/* Card da Campanha Selecionada */}
              <div className="rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-amber-700 font-bold">
                      Detalhes da Campanha
                    </span>
                    <h2 className="text-base font-extrabold text-[#1c1c1e] mt-0.5">
                      {selectedCampaign.name}
                    </h2>
                  </div>
                  <CampaignStatusBadge status={selectedCampaign.status} />
                </div>

                {selectedCampaign.description && (
                  <p className="mt-2 text-xs text-[#64748b] leading-relaxed">
                    {selectedCampaign.description}
                  </p>
                )}

                {/* Info Formulário Vinculado */}
                <div className="mt-3 pt-3 border-t border-[#f1f5f9]">
                  <span className="text-[10px] uppercase font-bold text-[#94a3b8] block mb-1">
                    Formulário Vinculado
                  </span>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-[#e2e8f0] bg-[#fafafa] p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: linkedForm?.accent_color || '#f59e0b',
                        }}
                      />
                      <span className="font-semibold text-xs text-[#1c1c1e] truncate">
                        {linkedForm ? linkedForm.name : 'Formulário Principal (Padrão)'}
                      </span>
                    </div>

                    <Link
                      to="/formularios"
                      className="shrink-0 text-[10px] font-semibold text-amber-600 hover:underline flex items-center gap-1"
                    >
                      Personalizar <ArrowRight className="size-2.5" />
                    </Link>
                  </div>
                </div>

                {/* Métricas rápidas */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded border border-[#e2e8f0] bg-[#fafafa] p-2">
                    <span className="block text-[10px] text-[#64748b]">Leads Registrados</span>
                    <span className="font-mono text-base font-extrabold text-[#1c1c1e]">
                      {leadsPerCampaign[selectedCampaign.id] || 0}
                    </span>
                  </div>
                  <div className="rounded border border-[#e2e8f0] bg-[#fafafa] p-2">
                    <span className="block text-[10px] text-[#64748b]">Criada</span>
                    <span className="font-mono text-xs font-semibold text-[#1c1c1e] mt-1 block">
                      {datePt(selectedCampaign.created)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card de Embed & Instalação da Campanha */}
              <div className="rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Code2 className="size-4 text-amber-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#1c1c1e]">
                      Embed Desta Campanha
                    </h3>
                  </div>

                  {/* Switch iframe / script */}
                  <div className="inline-flex rounded-md border border-[#cbd5e1] p-0.5 bg-white text-[10px]">
                    <button
                      type="button"
                      onClick={() => setEmbedFormat('iframe')}
                      className={cn(
                        'px-2 py-0.5 rounded font-semibold transition',
                        embedFormat === 'iframe'
                          ? 'bg-[#0f172a] text-white shadow-xs'
                          : 'text-[#64748b] hover:text-[#1c1c1e]',
                      )}
                    >
                      iframe
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbedFormat('script')}
                      className={cn(
                        'px-2 py-0.5 rounded font-semibold transition',
                        embedFormat === 'script'
                          ? 'bg-[#0f172a] text-white shadow-xs'
                          : 'text-[#64748b] hover:text-[#1c1c1e]',
                      )}
                    >
                      script
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[#64748b]">
                  Cada lead captado através deste embed fica registrado automaticamente com o
                  vínculo à campanha <strong>{selectedCampaign.name}</strong>.
                </p>

                {/* URL Pública Direta */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[#475569] uppercase">
                      URL Pública Direta
                    </span>
                    <a
                      href={publicFormUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-amber-600 hover:underline inline-flex items-center gap-0.5 font-semibold"
                    >
                      Abrir página <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-[#f8fafc] p-1.5">
                    <input
                      type="text"
                      readOnly
                      value={publicFormUrl}
                      className="flex-1 bg-transparent px-1 font-mono text-[10px] text-[#1c1c1e] select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={copyUrl}
                      className="shrink-0 inline-flex items-center gap-1 rounded bg-white border border-[#cbd5e1] px-2 py-1 text-[10px] font-semibold text-[#1c1c1e] hover:bg-[#f1f5f9] transition shadow-2xs"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          <span className="text-emerald-700">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3 text-[#64748b]" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Código de Embed */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[#475569] uppercase">
                      Snippet para site / landing page
                    </span>
                    <button
                      type="button"
                      onClick={copyEmbed}
                      className="text-[10px] text-amber-700 hover:text-amber-800 font-bold inline-flex items-center gap-1"
                    >
                      {copiedSnippet ? (
                        <>
                          <Check className="size-3 text-emerald-600" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" /> Copiar código
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-[#0f172a] text-[#e2e8f0] rounded-md font-mono text-[10px] overflow-x-auto select-all leading-relaxed shadow-inner">
                    {activeSnippet}
                  </pre>
                </div>
              </div>

              {/* Pré-visualização do Formulário da Campanha */}
              <div className="rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Eye className="size-3.5 text-amber-600" />
                    <span className="text-xs font-bold text-[#1c1c1e]">
                      Prévia do Formulário da Campanha
                    </span>
                  </div>
                  <span className="text-[10px] text-[#64748b]">
                    {linkedForm?.name || 'Formulário Principal'}
                  </span>
                </div>

                <div className="overflow-hidden rounded-md border border-[#e2e8f0] bg-[#fafafa]">
                  <iframe
                    src={publicFormUrl}
                    title={`Prévia do formulário da campanha ${selectedCampaign.name}`}
                    className="w-full h-[400px] border-none bg-white"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-xs text-[#94a3b8]">
              Selecione uma campanha para ver o código de embed e métricas.
            </div>
          )}
        </div>
      </div>

      {/* DIALOG DE CRIAR / EDITAR CAMPANHA */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#e2e8f0] bg-white p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <h3 className="text-sm font-bold text-[#1c1c1e] flex items-center gap-1.5">
                <Megaphone className="size-4 text-amber-600" />
                {editingCampaign ? 'Editar Campanha' : 'Nova Campanha de Captação'}
              </h3>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="text-[#64748b] hover:text-[#1c1c1e] text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  Nome da campanha <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Lançamento Q4, Google Ads - Demo, Outbound SDR"
                  className={cn(
                    'w-full rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500',
                    formErrors.name && 'border-red-500',
                  )}
                />
                {formErrors.name && (
                  <p className="mt-1 text-[10px] text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  Descrição / Objetivo (opcional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Captação de leads qualificados provenientes da campanha de anúncios..."
                  className="w-full resize-none rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#1c1c1e] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-[#475569]">
                    Formulário de captação vinculado
                  </label>
                  <Link
                    to="/formularios"
                    className="text-[10px] text-amber-600 hover:underline font-semibold"
                  >
                    Gerenciar formulários
                  </Link>
                </div>
                <select
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full rounded-md border border-[#cbd5e1] px-2.5 py-1.5 text-xs text-[#1c1c1e] bg-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Selecione um formulário...</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}{' '}
                </select>
                <p className="mt-1 text-[10px] text-[#64748b]">
                  O formulário escolhido determina os campos, cores e código de embed gerado para
                  esta campanha.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                  Status da campanha
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ativa', 'pausada', 'encerrada'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={cn(
                        'rounded-md border py-1.5 text-center text-xs font-semibold capitalize transition',
                        status === st
                          ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-2xs'
                          : 'border-[#cbd5e1] text-[#64748b] hover:bg-[#f8fafc]',
                      )}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <LoaderCircle className="size-3 animate-spin" /> Salvando...
                    </>
                  ) : editingCampaign ? (
                    'Salvar alterações'
                  ) : (
                    'Criar campanha'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#e2e8f0] bg-white p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertCircle className="size-5" />
              <h3 className="text-sm font-bold text-[#1c1c1e]">Excluir Campanha</h3>
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Tem certeza de que deseja remover esta campanha? Os leads já captados continuarão
              salvos no CRM, mas o código de embed deixará de apontar para ela.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteConfirmId)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <LoaderCircle className="size-3 animate-spin" /> Excluindo...
                  </>
                ) : (
                  'Confirmar exclusão'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CampaignStatusBadge({ status }: { status: Campaign['status'] }) {
  const styles: Record<Campaign['status'], string> = {
    ativa: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    pausada: 'border-amber-300 bg-amber-50 text-amber-800',
    encerrada: 'border-slate-300 bg-slate-100 text-slate-700',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium capitalize',
        styles[status] || styles.ativa,
      )}
    >
      <span className="size-1 rounded-full bg-current" />
      {status}
    </span>
  )
}
