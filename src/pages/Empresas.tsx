import { useEffect, useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  Building2,
  Edit3,
  ExternalLink,
  Filter,
  Globe,
  Mail,
  Phone,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmpresaDrawer } from '@/components/EmpresaDrawer'
import { EmpresaDialog } from '@/components/forms/EmpresaDialog'
import { PageSkeleton } from '@/components/PageSkeleton'
import { UserAvatar } from '@/components/UserAvatar'
import { useCrm } from '@/contexts/CrmContext'
import { cn } from '@/lib/utils'
import { datePt, money, type Empresa, type EmpresaSize } from '@/types/crm'

export default function Empresas() {
  const { empresas, contacts, deals, loading } = useCrm()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [sizeFilter, setSizeFilter] = useState<'todos' | EmpresaSize>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Empresa | null>(null)

  const detail = empresas.find((e) => e.id === params.get('empresa')) || null

  useEffect(() => {
    const handler = () => {
      setEditing(null)
      setDialogOpen(true)
    }
    window.addEventListener('crm:new-empresa', handler)
    return () => window.removeEventListener('crm:new-empresa', handler)
  }, [])

  // Mapa de contagem de contatos por empresa
  const contactCountByEmpresa = useMemo(() => {
    const map = new Map<string, number>()
    contacts.forEach((c) => {
      if (c.empresa) {
        map.set(c.empresa, (map.get(c.empresa) || 0) + 1)
      } else if (c.company) {
        // Fallback por nome caso a relation esteja sendo sincronizada
        const found = empresas.find((emp) => emp.name.toLowerCase() === c.company.toLowerCase())
        if (found) {
          map.set(found.id, (map.get(found.id) || 0) + 1)
        }
      }
    })
    return map
  }, [contacts, empresas])

  // Mapa de negócios por empresa
  const dealsDataByEmpresa = useMemo(() => {
    const map = new Map<string, { count: number; pipeline: number }>()
    deals.forEach((d) => {
      let targetEmpresaId = d.empresa
      if (!targetEmpresaId && d.contact) {
        const c = contacts.find((item) => item.id === d.contact)
        if (c?.empresa) targetEmpresaId = c.empresa
      }

      if (targetEmpresaId) {
        const current = map.get(targetEmpresaId) || { count: 0, pipeline: 0 }
        current.count += 1
        if (d.status === 'aberto') {
          current.pipeline += d.value || 0
        }
        map.set(targetEmpresaId, current)
      }
    })
    return map
  }, [deals, contacts])

  const filtered = useMemo(
    () =>
      empresas.filter((emp) => {
        const text =
          `${emp.name} ${emp.sector || ''} ${emp.website || ''} ${emp.email || ''}`.toLowerCase()
        const matchesQuery = text.includes(query.toLowerCase())
        const matchesSize = sizeFilter === 'todos' || emp.size === sizeFilter
        return matchesQuery && matchesSize
      }),
    [empresas, query, sizeFilter],
  )

  if (loading) return <PageSkeleton />

  const sizeBadgeClasses: Record<string, string> = {
    pequena: 'border-slate-300 bg-slate-50 text-slate-700',
    média: 'border-blue-300 bg-blue-50 text-blue-700',
    grande: 'border-purple-300 bg-purple-50 text-purple-700',
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header Linear */}
      <div className="shrink-0 border-b border-[#e5e7eb] px-4 pb-3 pt-4 sm:px-5">
        <div data-tour-id="empresas-header-actions" className="flex items-start">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-600">
              Contas & Organizações
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e] flex items-center gap-2">
              <Building2 className="size-5 text-amber-600" />
              Empresas
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Visão consolidada de empresas, decisores e pipeline negociado (contato → empresa →
              negócio).
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
            className="flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-2.5 text-[10px] font-bold text-white shadow-xs transition hover:bg-amber-600"
          >
            <Plus className="size-3.5" /> Nova empresa
          </button>
        </div>

        {/* Barra de Busca e Filtro */}
        <div data-tour-id="empresas-search-bar" className="mt-4 flex gap-2">
          <label className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs sm:max-w-sm">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, setor ou site…"
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
            />
          </label>
          <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2 text-[#64748b] shadow-2xs">
            <Filter className="mr-1.5 size-3" />
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value as typeof sizeFilter)}
              className="bg-transparent text-[10px] text-[#1c1c1e] outline-none"
            >
              <option value="todos">Todos os portes</option>
              <option value="pequena">Pequena</option>
              <option value="média">Média</option>
              <option value="grande">Grande</option>
            </select>
          </label>
        </div>
      </div>

      {/* Tabela Linear de Empresas */}
      <div data-tour-id="empresas-table-list" className="min-h-0 flex-1 overflow-auto">
        <div className="hidden min-w-[960px] sm:block">
          <div className="grid h-8 grid-cols-[minmax(200px,1.4fr)_140px_100px_90px_90px_130px_100px_110px_35px] items-center border-b border-[#e5e7eb] bg-[#fafafa] px-3 text-[9px] font-semibold text-[#64748b]">
            <span>Empresa</span>
            <span>Setor</span>
            <span>Porte</span>
            <span>Contatos</span>
            <span>Negócios</span>
            <span>Em Pipeline</span>
            <span>Criada em</span>
            <span>Responsável</span>
            <span />
          </div>

          {filtered.map((emp, index) => {
            const numContacts = contactCountByEmpresa.get(emp.id) || 0
            const dealsInfo = dealsDataByEmpresa.get(emp.id) || { count: 0, pipeline: 0 }

            return (
              <button
                key={emp.id}
                onClick={() => navigate(`/empresas?empresa=${emp.id}`)}
                className="group grid min-h-10 w-full animate-row-fade grid-cols-[minmax(200px,1.4fr)_140px_100px_90px_90px_130px_100px_110px_35px] items-center border-b border-[#f1f5f9] px-3 text-left text-[10px] transition hover:bg-[#f8fafc]"
                style={{ animationDelay: `${Math.min(index * 18, 150)}ms` }}
              >
                {/* Nome + Avatar Inicial */}
                <span className="flex min-w-0 items-center gap-2 pr-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded bg-amber-50 border border-amber-200 text-[8px] font-extrabold text-amber-700">
                    {emp.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 truncate">
                    <span className="block truncate font-semibold text-[#1c1c1e]">{emp.name}</span>
                    {emp.website && (
                      <span className="block truncate font-mono text-[9px] text-[#94a3b8]">
                        {emp.website.replace(/^https?:\/\//, '')}
                      </span>
                    )}
                  </div>
                </span>

                {/* Setor */}
                <span className="truncate pr-3 text-[#475569]">{emp.sector || '—'}</span>

                {/* Porte */}
                <span>
                  {emp.size ? (
                    <span
                      className={cn(
                        'inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold capitalize',
                        sizeBadgeClasses[emp.size] || 'border-slate-200 text-slate-700',
                      )}
                    >
                      {emp.size}
                    </span>
                  ) : (
                    <span className="text-[#94a3b8]">—</span>
                  )}
                </span>

                {/* Número de contatos */}
                <span className="flex items-center gap-1 font-mono text-[10px] text-[#475569]">
                  <Users className="size-3 text-[#94a3b8]" />
                  <span>{numContacts}</span>
                </span>

                {/* Número de negócios */}
                <span className="flex items-center gap-1 font-mono text-[10px] text-[#475569]">
                  <BriefcaseBusiness className="size-3 text-[#94a3b8]" />
                  <span>{dealsInfo.count}</span>
                </span>

                {/* Em Pipeline */}
                <span className="font-mono text-[10px] font-bold text-[#1c1c1e]">
                  {dealsInfo.pipeline > 0 ? money.format(dealsInfo.pipeline) : 'R$ 0'}
                </span>

                {/* Criada em */}
                <span className="font-mono text-[9px] text-[#64748b]">{datePt(emp.created)}</span>

                {/* Responsável */}
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserAvatar user={emp.expand?.owner} className="size-4" />
                  <span className="truncate text-[#64748b]">
                    {emp.expand?.owner?.name || 'CRM'}
                  </span>
                </span>

                {/* Ação */}
                <span>
                  <Edit3 className="size-3 opacity-0 text-[#94a3b8] group-hover:opacity-100" />
                </span>
              </button>
            )
          })}
        </div>

        {/* Modo Mobile Cards */}
        <div className="grid gap-2 p-3 sm:hidden">
          {filtered.map((emp) => {
            const numContacts = contactCountByEmpresa.get(emp.id) || 0
            const dealsInfo = dealsDataByEmpresa.get(emp.id) || { count: 0, pipeline: 0 }

            return (
              <button
                key={emp.id}
                onClick={() => navigate(`/empresas?empresa=${emp.id}`)}
                className="rounded-md border border-[#e5e7eb] bg-white p-3 text-left shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="grid size-8 place-items-center rounded bg-amber-50 border border-amber-200 text-[10px] font-extrabold text-amber-700">
                      {emp.name
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#1c1c1e]">{emp.name}</p>
                      <p className="truncate text-[10px] text-[#64748b]">{emp.sector || 'Geral'}</p>
                    </div>
                  </div>
                  {emp.size && (
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.2 text-[9px] font-semibold capitalize',
                        sizeBadgeClasses[emp.size] || 'border-slate-200 text-slate-700',
                      )}
                    >
                      {emp.size}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#f1f5f9] pt-2 text-[10px]">
                  <span className="text-[#64748b]">
                    {numContacts} contato(s) · {dealsInfo.count} negócio(s)
                  </span>
                  <span className="font-mono font-bold text-[#1c1c1e]">
                    {money.format(dealsInfo.pipeline)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {!filtered.length && (
          <div className="grid h-48 place-items-center text-xs text-[#94a3b8]">
            Nenhuma empresa encontrada com os filtros aplicados.
          </div>
        )}
      </div>

      {/* Drawer de Detalhes da Empresa */}
      <EmpresaDrawer
        empresa={detail}
        onClose={() => navigate('/empresas')}
        onEdit={(emp) => {
          setEditing(emp)
          setDialogOpen(true)
        }}
      />

      {/* Dialog de Criação/Edição */}
      <EmpresaDialog open={dialogOpen} onOpenChange={setDialogOpen} empresa={editing} />
    </div>
  )
}
