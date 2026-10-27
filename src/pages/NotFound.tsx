import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '@/components/Brand'

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#ffffff] p-6 text-[#1c1c1e]">
      <div className="text-center">
        <Brand className="mb-10 justify-center" />
        <p className="font-mono text-[52px] font-bold leading-none text-[#e2e8f0]">404</p>
        <h1 className="mt-5 text-lg font-extrabold text-[#1c1c1e]">Página não encontrada</h1>
        <p className="mt-2 text-xs text-[#64748b]">O endereço pode ter mudado ou não existe.</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-[10px] font-bold text-white transition hover:bg-amber-600 shadow-xs"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao dashboard
        </Link>
      </div>
    </main>
  )
}
