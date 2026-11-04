import { useEffect, useState } from 'react'
import { Edit3, Megaphone, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  createMarketingCampaign,
  deleteMarketingCampaign,
  listMarketingCampaigns,
  updateMarketingCampaign,
} from '@/services/crm'
import {
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPES,
  type MarketingCampaign,
  type MarketingCampaignType,
} from '@/types/crm'

interface CampaignForm {
  name: string
  type: MarketingCampaignType
  message: string
  active: boolean
}

const EMPTY_FORM: CampaignForm = {
  name: '',
  type: 'aniversario',
  message: '',
  active: true,
}

export default function GestaoCampanhas() {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MarketingCampaign | null>(null)
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      setCampaigns(await listMarketingCampaigns())
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar campanhas',
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

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(campaign: MarketingCampaign) {
    setEditing(campaign)
    setForm({
      name: campaign.name,
      type: campaign.type,
      message: campaign.message || '',
      active: campaign.active,
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome da campanha' })
      return
    }
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        message: form.message.trim(),
        active: form.active,
      }
      if (editing) {
        await updateMarketingCampaign(editing.id, payload)
        toast({ title: 'Campanha atualizada' })
      } else {
        await createMarketingCampaign(payload)
        toast({ title: 'Campanha criada' })
      }
      setDialogOpen(false)
      await load()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar campanha',
        description: getErrorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(campaign: MarketingCampaign) {
    if (!window.confirm(`Excluir a campanha "${campaign.name}"?`)) return
    try {
      await deleteMarketingCampaign(campaign.id)
      toast({ title: 'Campanha excluída' })
      await load()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir campanha',
        description: getErrorMessage(error),
      })
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">Campanhas</h1>
          <p className="text-sm text-stone-500">
            Cadastro e gestão das campanhas de relacionamento.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Nova campanha
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Carregando campanhas...</p>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 p-12 text-center dark:border-stone-700">
          <Megaphone className="mb-3 h-10 w-10 text-amber-600" />
          <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100">
            Nenhuma campanha ainda
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Crie sua primeira campanha para organizar os envios de relacionamento.
          </p>
          <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Nova campanha
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-stone-900 dark:text-stone-100">
                    {campaign.name}
                  </h3>
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    {CAMPAIGN_TYPE_LABELS[campaign.type]}
                  </span>
                </div>
                <span
                  className={
                    campaign.active
                      ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800'
                      : 'rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-700'
                  }
                >
                  {campaign.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              {campaign.message && (
                <p className="mb-3 line-clamp-3 whitespace-pre-line text-sm text-stone-600 dark:text-stone-400">
                  {campaign.message}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(campaign)}>
                  <Edit3 className="mr-1 h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(campaign)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-stone-900"
          >
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              {editing ? 'Editar campanha' : 'Nova campanha'}
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="camp-name">Nome</Label>
              <Input
                id="camp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-type">Tipo</Label>
              <select
                id="camp-type"
                className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as MarketingCampaignType })
                }
              >
                {CAMPAIGN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CAMPAIGN_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-message">Mensagem</Label>
              <Textarea
                id="camp-message"
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="camp-active">Campanha ativa</Label>
              <Switch
                id="camp-active"
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {busy ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
