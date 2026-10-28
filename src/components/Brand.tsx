import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="grid size-7 shrink-0 place-items-center rounded-md border border-amber-400/40 bg-amber-500/15 text-amber-400 shadow-2xs">
        <Sparkles className="size-3.5" />
      </div>
      {!compact && (
        <span className="text-[13px] font-extrabold tracking-[-0.02em] text-[#f6efe6]">
          Café Especial <span className="text-amber-400 font-mono text-[10px] font-bold">CRM</span>
        </span>
      )}
    </div>
  )
}
