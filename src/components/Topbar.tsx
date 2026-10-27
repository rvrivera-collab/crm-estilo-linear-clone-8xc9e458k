import { Menu, Sparkles } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAsk } from '@/contexts/AskContext'

const sections: Record<string, [string, string]> = {
  '/': ['Agent', 'Ask CRM'],
  '/ask': ['Agent', 'Ask CRM'],
  '/dashboard': ['Vendas', 'Dashboard'],
  '/pipeline': ['Vendas', 'Pipeline'],
  '/recuperacao': ['Vendas', 'Recuperação'],
  '/negocios': ['Vendas', 'Negócios'],
  '/contatos': ['Vendas', 'Contatos'],
  '/empresas': ['Vendas', 'Empresas'],
  '/campanhas': ['Marketing & Captação', 'Campanhas'],
  '/formularios': ['Marketing & Captação', 'Formulários'],
  '/configuracoes': ['Workspace', 'Configurações'],
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const { setOpen } = useAsk()
  const current = sections[pathname] || ['CRM', 'Adapta']
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-[#e5e7eb] bg-white/90 px-3 backdrop-blur sm:px-4">
      <button
        onClick={onMenu}
        className="crm-menu-button mr-2 rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
      >
        <Menu className="size-4" />
      </button>
      <div className="min-w-0 flex-1 truncate text-[12px]">
        <span className="text-[#64748b]">{current[0]}</span>
        <span className="mx-2 text-[#cbd5e1]">/</span>
        <span className="font-semibold text-[#1c1c1e]">{current[1]}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 text-[9px] text-[#94a3b8] md:flex">
          <kbd className="rounded border border-[#e2e8f0] bg-[#f8fafc] px-1.5 py-0.5 font-mono text-[#64748b]">
            G
          </kbd>
          <span>então</span>
          <kbd className="rounded border border-[#e2e8f0] bg-[#f8fafc] px-1.5 py-0.5 font-mono text-[#64748b]">
            A/D/P/R/N/C/E
          </kbd>
        </div>
        {pathname !== '/ask' && (
          <button
            onClick={() => setOpen(true)}
            className="hidden h-7 items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2 text-[10px] text-[#64748b] shadow-xs hover:bg-[#f8fafc] hover:text-[#1c1c1e] sm:flex"
          >
            <Sparkles className="size-3 text-amber-500" /> Ask CRM{' '}
            <kbd className="ml-1 font-mono text-[#94a3b8]">⌘K</kbd>
          </button>
        )}
      </div>
    </header>
  )
}
