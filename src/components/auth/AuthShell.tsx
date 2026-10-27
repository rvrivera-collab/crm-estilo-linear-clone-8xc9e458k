import type { PropsWithChildren, ReactNode } from 'react'
import { Brand } from '@/components/Brand'

export function AuthShell({
  title,
  description,
  children,
  footer,
}: PropsWithChildren<{ title: string; description: string; footer?: ReactNode }>) {
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#ffffff] text-[#1c1c1e]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_55%_15%,rgba(245,158,11,.08),transparent_32%)]" />
      <aside className="relative hidden w-[42%] flex-col justify-between border-r border-[#e5e7eb] bg-[#f8fafc] p-10 lg:flex">
        <Brand />
        <div className="max-w-md">
          <div className="mb-7 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-amber-600">
            <span className="h-px w-7 bg-amber-600" /> Cockpit comercial
          </div>
          <h2 className="text-[38px] font-extrabold leading-[1.08] tracking-[-.04em] text-[#1c1c1e]">
            Clareza para mover cada oportunidade.
          </h2>
          <p className="mt-5 text-sm leading-6 text-[#64748b]">
            Pipeline, relacionamentos e inteligência comercial em uma interface silenciosa e rápida.
          </p>
        </div>
        <p className="text-xs text-[#94a3b8]">Seguro · colaborativo · em tempo real</p>
      </aside>
      <section className="relative flex flex-1 items-center justify-center bg-white px-5 py-10">
        <div className="w-full max-w-[390px] animate-panel-rise">
          <Brand className="mb-10 lg:hidden" />
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[.18em] text-amber-600">
            CRM Adapta
          </p>
          <h1 className="text-[24px] font-extrabold tracking-[-.035em] text-[#1c1c1e]">{title}</h1>
          <p className="mt-2 text-[13px] leading-5 text-[#64748b]">{description}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-xs text-[#64748b]">{footer}</div>}
        </div>
      </section>
    </main>
  )
}
