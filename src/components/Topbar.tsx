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
  '/mensagens': ['Comunicação', 'Mensagens (WhatsApp)'],
  '/configuracoes': ['Workspace', 'Configurações'],
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const { setOpen } = useAsk()
  const current = sections[pathname] || ['CRM', 'Adapta']
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-[#dfd5c6] bg-[#fbf9f5]/95 px-3 backdrop-blur sm:px-4 shadow-2xs">
      <button
        onClick={onMenu}
        className="crm-menu-button mr-2 rounded p-1.5 text-[#7c6a58] hover:bg-[#ede3d4]"
      >
        <Menu className="size-4" />
      </button>
      <div className="min-w-0 flex-1 truncate text-[12px]">
        <span className="text-[#7c6a58] font-medium">{current[0]}</span>
        <span className="mx-2 text-[#bfaea0]">/</span>
        <span className="font-bold text-[#2b1c13]">{current[1]}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 text-[9px] text-[#8c7865] lg:flex">
          <kbd className="rounded border border-[#d6c7b6] bg-[#f3ece0] px-1.5 py-0.5 font-mono text-[#5c4735]">
            G
          </kbd>
          <span>então</span>
          <kbd className="rounded border border-[#d6c7b6] bg-[#f3ece0] px-1.5 py-0.5 font-mono text-[#5c4735]">
            A/D/P/R/N/C/E
          </kbd>
        </div>
        {pathname !== '/ask' && (
          <button
            onClick={() => setOpen(true)}
            className="hidden h-7 items-center gap-1.5 rounded-md border border-[#d6c7b6] bg-[#fffdf9] px-2.5 text-[10px] font-semibold text-[#5c4735] shadow-2xs hover:bg-[#f3ece0] hover:text-[#2b1c13] hover:border-[#bfaea0] sm:flex transition"
          >
            <Sparkles className="size-3 text-amber-600" /> Ask CRM{' '}
            <kbd className="ml-1 font-mono text-[#8c7865]">⌘K</kbd>
          </button>
        )}
      </div>
    </header>
  )
}
