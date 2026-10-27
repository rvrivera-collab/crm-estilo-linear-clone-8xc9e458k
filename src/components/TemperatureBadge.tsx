import { cn } from '@/lib/utils'
import type { DealTemperature } from '@/types/crm'
import { Flame, Snowflake, Sun } from 'lucide-react'

export function TemperatureBadge({
  temperature,
  className = '',
}: {
  temperature?: DealTemperature | string
  className?: string
}) {
  const temp = (temperature || 'morno').toLowerCase()

  if (temp === 'quente') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide border-red-200 bg-red-50 text-red-700',
          className,
        )}
      >
        <Flame className="size-2.5 text-red-600 fill-red-500" />
        Quente
      </span>
    )
  }

  if (temp === 'frio') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide border-blue-200 bg-blue-50 text-blue-700',
          className,
        )}
      >
        <Snowflake className="size-2.5 text-blue-600" />
        Frio
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide border-amber-200 bg-amber-50 text-amber-700',
        className,
      )}
    >
      <Sun className="size-2.5 text-amber-600" />
      Morno
    </span>
  )
}
