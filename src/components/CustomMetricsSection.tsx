import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Edit2,
  Filter,
  Layers,
  MoreVertical,
  Percent,
  Plus,
  Sliders,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import type { CustomMetric, Deal, MetricAggregationType, Stage } from '@/types/crm'
import { money } from '@/types/crm'
import { cn } from '@/lib/utils'

interface CustomMetricsSectionProps {
  metrics: CustomMetric[]
  dealsInPeriod: Deal[]
  stages: Stage[]
  onAddMetric: () => void
  onEditMetric: (metric: CustomMetric) => void
  onDeleteMetric: (id: string) => void
  onMoveMetric: (id: string, direction: 'up' | 'down') => void
  loading?: boolean
}

export function computeMetricValue(
  metric: CustomMetric,
  dealsInPeriod: Deal[],
): { formatted: string; subtext: string; iconType: string } {
  // 1. Filtrar deals por estágio e/ou status se configurado na métrica
  let list = dealsInPeriod

  if (metric.stage) {
    list = list.filter((d) => d.stage === metric.stage)
  }

  if (metric.status) {
    list = list.filter((d) => d.status === metric.status)
  }

  const count = list.length
  const totalSum = list.reduce((acc, d) => acc + (d.value || 0), 0)

  switch (metric.aggregation) {
    case 'count_deals':
      return {
        formatted: String(count),
        subtext: count === 1 ? '1 negócio no período' : `${count} negócios no período`,
        iconType: 'count',
      }

    case 'sum_value':
      return {
        formatted: money.format(totalSum),
        subtext: `${count} ${count === 1 ? 'deal' : 'deals'} somados`,
        iconType: 'money',
      }

    case 'avg_value':
    case 'ticket_medio': {
      const avg = count > 0 ? totalSum / count : 0
      return {
        formatted: money.format(avg),
        subtext: `baseado em ${count} ${count === 1 ? 'negócio' : 'negócios'}`,
        iconType: 'avg',
      }
    }

    case 'win_rate': {
      // Se já filtrou por status, win rate direta ou relativa a fechados
      const won = list.filter((d) => d.status === 'ganho').length
      const lost = list.filter((d) => d.status === 'perdido').length
      const closed = won + lost
      const rate = closed > 0 ? (won / closed) * 100 : count > 0 ? (won / count) * 100 : 0
      return {
        formatted: `${rate.toFixed(1)}%`,
        subtext: `${won} ganhos de ${closed > 0 ? closed : count} considerados`,
        iconType: 'rate',
      }
    }

    case 'won_deals': {
      const wonDeals = list.filter((d) => d.status === 'ganho')
      const wonSum = wonDeals.reduce((acc, d) => acc + (d.value || 0), 0)
      return {
        formatted: String(wonDeals.length),
        subtext: money.format(wonSum),
        iconType: 'won',
      }
    }

    case 'lost_deals': {
      const lostDeals = list.filter((d) => d.status === 'perdido')
      const lostSum = lostDeals.reduce((acc, d) => acc + (d.value || 0), 0)
      return {
        formatted: String(lostDeals.length),
        subtext: money.format(lostSum),
        iconType: 'lost',
      }
    }

    default:
      return {
        formatted: String(count),
        subtext: 'no período selecionado',
        iconType: 'count',
      }
  }
}

export const AGGREGATION_LABELS: Record<MetricAggregationType, string> = {
  count_deals: 'Contagem de negócios (volume)',
  sum_value: 'Soma total de valor (R$)',
  avg_value: 'Valor médio por negócio (R$)',
  ticket_medio: 'Ticket médio de vendas (R$)',
  win_rate: 'Taxa de conversão (Win rate %)',
  won_deals: 'Negócios ganhos (qtd)',
  lost_deals: 'Negócios perdidos (qtd)',
}

export function CustomMetricsSection({
  metrics,
  dealsInPeriod,
  stages,
  onAddMetric,
  onEditMetric,
  onDeleteMetric,
  onMoveMetric,
  loading = false,
}: CustomMetricsSectionProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const sortedMetrics = [...metrics].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-amber-500/10 text-amber-600">
            <Sliders className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                Métricas Personalizadas de Vendas
              </h2>
              <span className="font-mono text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {sortedMetrics.length} configuradas
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento sob medida calculado dinamicamente com base no período da Dashboard.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddMetric}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted transition shrink-0"
        >
          <Plus className="size-3.5 text-amber-600" />
          <span>Nova Métrica</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Carregando métricas personalizadas…
        </div>
      ) : sortedMetrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3 className="size-8 text-muted-foreground/40 mb-2" />
          <p className="text-xs font-semibold text-foreground">
            Nenhuma métrica personalizada criada
          </p>
          <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
            Crie indicadores personalizados como Ticket Médio por estágio, Taxa de Propostas Aceitas
            ou contagem de deals abertos.
          </p>
          <button
            type="button"
            onClick={onAddMetric}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 transition shadow-2xs"
          >
            <Plus className="size-3.5" />
            <span>Criar primeira métrica</span>
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedMetrics.map((metric, index) => {
            const { formatted, subtext, iconType } = computeMetricValue(metric, dealsInPeriod)
            const stageObj = stages.find((s) => s.id === metric.stage)

            return (
              <div
                key={metric.id}
                className="group relative rounded-lg border border-border/80 bg-background/60 p-3.5 shadow-2xs hover:border-border hover:bg-background transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                        {metric.name}
                      </span>
                    </div>

                    {/* Botões de Ação estilo Linear: subir, descer, editar, deletar */}
                    <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0">
                      <button
                        type="button"
                        onClick={() => onMoveMetric(metric.id, 'up')}
                        disabled={index === 0}
                        title="Mover para cima"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                      >
                        <ArrowUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveMetric(metric.id, 'down')}
                        disabled={index === sortedMetrics.length - 1}
                        title="Mover para baixo"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
                      >
                        <ArrowDown className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditMetric(metric)}
                        title="Editar métrica"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Edit2 className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMetric(metric.id)}
                        title="Excluir métrica"
                        className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Valor Principal Formatado */}
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
                      {formatted}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                  <span className="font-mono text-muted-foreground truncate" title={subtext}>
                    {subtext}
                  </span>

                  {/* Badges de filtros aplicados */}
                  <div className="flex items-center gap-1 shrink-0">
                    {stageObj && (
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold"
                        style={{
                          backgroundColor: `${stageObj.color}15`,
                          color: stageObj.color,
                          border: `1px solid ${stageObj.color}40`,
                        }}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: stageObj.color }}
                        />
                        {stageObj.name}
                      </span>
                    )}

                    {metric.status && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold capitalize border',
                          metric.status === 'ganho'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : metric.status === 'perdido'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-muted text-muted-foreground border-border',
                        )}
                      >
                        {metric.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
