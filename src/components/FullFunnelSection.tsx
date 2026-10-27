import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Clock3,
  HelpCircle,
  Hourglass,
  Layers,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Deal, Stage } from '@/types/crm'
import { money } from '@/types/crm'
import type { StageIdleStats } from '@/lib/dashboard-filters'
import { cn } from '@/lib/utils'

interface FullFunnelSectionProps {
  stages: Stage[]
  stageDealsInPeriod: Map<string, Deal[]>
  stageIdleStats: Map<string, StageIdleStats>
  maxStageCount: number
  winRateInPeriod: number
  wonCount: number
  lostCount: number
  onSelectStageTab?: (stageId: string) => void
}

export function FullFunnelSection({
  stages,
  stageDealsInPeriod,
  stageIdleStats,
  maxStageCount,
  winRateInPeriod,
  wonCount,
  lostCount,
  onSelectStageTab,
}: FullFunnelSectionProps) {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'visual' | 'detalhado'>('visual')

  return (
    <section className="rounded-lg border border-border bg-card shadow-2xs flex flex-col">
      {/* Header do Funil Completo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border px-4 py-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-amber-500/10 text-amber-600">
            <Layers className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                Funil Completo de Vendas · Visão de Estágios & Dias Parado
              </h2>
              <span className="font-mono text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {stages.length} estágios
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento de volume, conversão e tempo de estagnação por etapa para evitar que
              leads esfriem.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                viewMode === 'visual'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Visual
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detalhado')}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition',
                viewMode === 'detalhado'
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Tabela de Estágios
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo: Modo Visual */}
      {viewMode === 'visual' ? (
        <div className="space-y-4 p-4 flex-1">
          {stages.map((stage) => {
            const stageDeals = stageDealsInPeriod.get(stage.id) || []
            const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)
            const count = stageDeals.length
            const ratio = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0
            const idle = stageIdleStats.get(stage.id)

            const isStalled = idle?.isStalled || false
            const avgDays = idle?.avgDaysIdle ?? 0
            const maxDays = idle?.maxDaysIdle ?? 0
            const oldest = idle?.oldestDeal

            return (
              <div
                key={stage.id}
                onClick={() => onSelectStageTab?.(stage.id)}
                className={cn(
                  'group rounded-lg p-3 transition border cursor-pointer',
                  isStalled
                    ? 'border-amber-300/80 bg-amber-50/20 hover:border-amber-400'
                    : 'border-border/60 hover:border-border hover:bg-muted/20',
                )}
              >
                {/* Linha superior: Nome, contagem, valor e badge de dias parado */}
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-xs shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-bold text-foreground">{stage.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      · {count} {count === 1 ? 'deal entrou' : 'deals entraram'}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      ({idle?.activeDealsCount || 0} ativos)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Alerta / Métrica de Dias Parado */}
                    {idle && idle.activeDealsCount > 0 && (
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition',
                          isStalled
                            ? 'bg-amber-100/90 text-amber-900 border border-amber-300'
                            : avgDays >= 7
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-muted text-muted-foreground border border-border',
                        )}
                        title={`Média de ${avgDays} dias parado neste estágio`}
                      >
                        {isStalled ? (
                          <AlertTriangle className="size-3 text-amber-600 shrink-0" />
                        ) : (
                          <Clock3 className="size-3 shrink-0" />
                        )}
                        <span>{avgDays}d parado em média</span>
                        {maxDays > 0 && <span className="opacity-80">· máx: {maxDays}d</span>}
                      </div>
                    )}

                    <span className="font-mono font-bold text-foreground">
                      {money.format(stageValue)}
                    </span>
                  </div>
                </div>

                {/* Barra de progresso estilizada com as cores reais do estágio */}
                <div className="h-3 overflow-hidden rounded bg-muted/60 p-0.5 border border-border">
                  <div
                    className="h-full origin-left rounded transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.max(count ? 4 : 0, ratio)}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </div>

                {/* Linha informativa de rodapé do estágio: deal mais parado */}
                {oldest && isStalled && (
                  <div className="mt-2 flex items-center justify-between text-[11px] text-amber-900/90 bg-amber-500/10 px-2 py-1 rounded">
                    <span className="truncate">
                      <strong>Atenção:</strong> Deal mais estagnado:{' '}
                      <strong>
                        {oldest.code} · {oldest.title}
                      </strong>
                    </span>
                    <span className="font-mono text-[10px] shrink-0 font-bold ml-2">
                      {maxDays} dias sem mover
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Modo Detalhado em Tabela */
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                <th className="py-2.5 px-4">Estágio</th>
                <th className="py-2.5 px-3 text-right">Deals no Período</th>
                <th className="py-2.5 px-3 text-right">Valor no Período</th>
                <th className="py-2.5 px-3 text-right">Deals Ativos Hoje</th>
                <th className="py-2.5 px-3 text-right">Média Dias Parado</th>
                <th className="py-2.5 px-4 text-left">Deal Mais Estagnado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {stages.map((stage) => {
                const stageDeals = stageDealsInPeriod.get(stage.id) || []
                const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)
                const idle = stageIdleStats.get(stage.id)
                const isStalled = idle?.isStalled || false

                return (
                  <tr
                    key={stage.id}
                    onClick={() => onSelectStageTab?.(stage.id)}
                    className={cn(
                      'hover:bg-muted/30 transition cursor-pointer',
                      isStalled && 'bg-amber-50/20',
                    )}
                  >
                    <td className="py-3 px-4 font-semibold text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                      {stageDeals.length}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                      {money.format(stageValue)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                      {idle?.activeDealsCount || 0}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {idle && idle.activeDealsCount > 0 ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] font-bold',
                            isStalled
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : idle.avgDaysIdle >= 7
                                ? 'bg-blue-50 text-blue-800'
                                : 'text-foreground',
                          )}
                        >
                          {idle.avgDaysIdle} dias
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {idle?.oldestDeal ? (
                        <div className="flex items-center justify-between gap-2 max-w-xs">
                          <span className="truncate text-foreground font-medium">
                            <span className="font-mono text-[10px] text-muted-foreground mr-1">
                              {idle.oldestDeal.code}
                            </span>
                            {idle.oldestDeal.title}
                          </span>
                          <span
                            className={cn(
                              'font-mono text-[10px] shrink-0 font-bold rounded px-1.5 py-0.5',
                              idle.maxDaysIdle >= 14
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {idle.maxDaysIdle}d
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Nenhum deal ativo</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rodapé do Funil: Conversão e Pipeline Aberto */}
      <div className="p-3.5 border-t border-border bg-muted/25 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="size-3.5 text-amber-600" />
          <span>Taxa de conversão do período:</span>
          <span className="font-mono font-bold text-foreground">{winRateInPeriod.toFixed(1)}%</span>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground flex items-center gap-3">
          <span className="text-emerald-700 font-semibold">{wonCount} fechados</span>
          <span>·</span>
          <span>{lostCount} perdidos</span>
          <button
            type="button"
            onClick={() => navigate('/pipeline')}
            className="inline-flex items-center gap-1 text-foreground hover:underline ml-2"
          >
            <span>Abrir Kanban</span>
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>
    </section>
  )
}
