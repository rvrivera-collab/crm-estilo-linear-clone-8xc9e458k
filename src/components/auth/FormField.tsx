import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function FormField({
  label,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[#334155]">{label}</span>
      <input
        {...props}
        className={cn(
          'h-10 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#1c1c1e] outline-none transition placeholder:text-[#94a3b8] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15',
          error && 'border-red-500 focus:border-red-500',
          className,
        )}
      />
      {error && <span className="mt-1.5 block text-[11px] text-red-600">{error}</span>}
    </label>
  )
}
