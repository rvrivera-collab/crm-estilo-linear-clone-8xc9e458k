import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="grid size-7 shrink-0 place-items-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600">
        <Sparkles className="size-3.5" />
      </div>
      {!compact && (
        <span className="text-[13px] font-extrabold tracking-[-0.02em] text-[#1c1c1e]">
          CRM Adapta
        </span>
      )}
    </div>
  )
}
