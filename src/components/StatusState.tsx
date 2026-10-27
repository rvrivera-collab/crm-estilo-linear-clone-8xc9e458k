import type { ReactNode } from 'react'
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react'

export function StatusState({
  status,
  title,
  children,
}: {
  status: 'loading' | 'success' | 'error'
  title: string
  children: ReactNode
}) {
  const Icon =
    status === 'loading' ? LoaderCircle : status === 'success' ? CheckCircle2 : CircleAlert
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#ffffff] p-5 shadow-sm">
      <Icon
        className={`mb-4 size-6 ${status === 'loading' ? 'animate-spin text-amber-500' : status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}
      />
      <h2 className="text-sm font-bold text-[#1c1c1e]">{title}</h2>
      <div className="mt-2 text-xs leading-5 text-[#64748b]">{children}</div>
    </div>
  )
}
