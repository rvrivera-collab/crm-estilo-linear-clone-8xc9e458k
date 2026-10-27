import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomMetric, MetricAggregationType, Stage } from '@/types/crm'
import { AGGREGATION_LABELS } from './CustomMetricsSection'

interface MetricModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metricToEdit?: CustomMetric | null
  stages: Stage[]
  onSave: (data: {
    name: string
    aggregation: MetricAggregationType
    stage?: string
    status?: CustomMetric['status']
  }) => Promise<void>
}

export function MetricModal({
  open,
  onOpenChange,
  metricToEdit,
  stages,
  onSave,
}: MetricModalProps) {
  const [name, setName] = useState('')
  const [aggregation, setAggregation] = useState<MetricAggregationType>('ticket_medio')
  const [stage, setStage] = useState<string>('')
  const [status, setStatus] = useState<'' | 'aberto' | 'ganho' | 'perdido'>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (metricToEdit) {
      setName(metricToEdit.name)
      setAggregation(metricToEdit.aggregation)
      setStage(metricToEdit.stage || '')
      setStatus(metricToEdit.status || '')
    } else {
      setName('')
      setAggregation('ticket_medio')
      setStage('')
      setStatus('')
    }
    setError(null)
  }, [metricToEdit, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('O nome da métrica é obrigatório.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        aggregation,
        stage: stage || undefined,
        status: status ? status : undefined,
      })
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao salvar métrica:', err)
      setError('Erro ao salvar a métrica. Verifique os dados e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {metricToEdit ? 'Editar Métrica Personalizada' : 'Nova Métrica Personalizada'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure as regras de cálculo e filtros para acompanhar indicadores sob medida de
              vendas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-3">
            {error && (
              <div className="rounded bg-rose-50 p-2 text-xs text-rose-700 border border-rose-200">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="metric-name" className="text-xs font-semibold">
                Nome da métrica <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="metric-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Ticket Médio em Proposta, Taxa de Fechamento"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metric-agg" className="text-xs font-semibold">
                Tipo de cálculo / agregação
              </Label>
              <select
                id="metric-agg"
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as MetricAggregationType)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-2xs focus:border-ring focus:outline-none"
              >
                {Object.entries(AGGREGATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                A agregação será calculada dinamicamente sobre todos os negócios envolvidos na
                janela de período da Dashboard.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="metric-stage" className="text-xs font-semibold">
                  Filtrar por estágio (opcional)
                </Label>
                <select
                  id="metric-stage"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-2xs focus:border-ring focus:outline-none"
                >
                  <option value="">Todos os estágios</option>
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="metric-status" className="text-xs font-semibold">
                  Filtrar por status (opcional)
                </Label>
                <select
                  id="metric-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as '' | 'aberto' | 'ganho' | 'perdido')}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-2xs focus:border-ring focus:outline-none"
                >
                  <option value="">Todos os status</option>
                  <option value="aberto">Somente aberto</option>
                  <option value="ganho">Somente ganho</option>
                  <option value="perdido">Somente perdido</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="text-xs bg-foreground text-background hover:opacity-90"
            >
              {saving ? 'Salvando…' : metricToEdit ? 'Atualizar Métrica' : 'Criar Métrica'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
