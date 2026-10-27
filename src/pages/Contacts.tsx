import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  Cake,
  ChevronDown,
  Coffee,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Loader2,
  Mail,
  Phone,
  Search,
  ShoppingBag,
  UserPlus,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ContactDrawer } from '@/components/ContactDrawer'
import { ContactDialog } from '@/components/forms/ContactDialog'
import { BatchWhatsAppModal } from '@/components/BatchWhatsAppModal'
import { PageSkeleton } from '@/components/PageSkeleton'
import { UserAvatar } from '@/components/UserAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCrm } from '@/contexts/CrmContext'
import { toast } from '@/hooks/use-toast'
import { exportContactsSpreadsheet } from '@/lib/export-excel'
import { cn } from '@/lib/utils'
import {
  datePt,
  getBirthdayInfo,
  getDaysSinceLastPurchase,
  getLoyaltyLevel,
  initials,
  money,
  type Contact,
} from '@/types/crm'

export default function Contacts() {
  const { contacts, loading } = useCrm()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'todos' | Contact['status']>('todos')
  const [loyaltyFilter, setLoyaltyFilter] = useState<'todos' | '1' | '2' | '3' | '4' | '5'>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const detail = contacts.find((contact) => contact.id === params.get('contact')) || null
  useEffect(() => {
    const handler = () => {
      setEditing(null)
      setDialogOpen(true)
    }
    window.addEventListener('crm:new-contact', handler)
    return () => window.removeEventListener('crm:new-contact', handler)
  }, [])
  const filtered = useMemo(
    () =>
      contacts.filter((contact) => {
        const matchesQuery =
          `${contact.name} ${contact.email} ${contact.phone} ${contact.favorite_coffee || ''}`
            .toLowerCase()
            .includes(query.toLowerCase())
        const matchesStatus = status === 'todos' || contact.status === status
        const loyaltyLevel = getLoyaltyLevel(contact.purchase_count || 0).level
        const matchesLoyalty = loyaltyFilter === 'todos' || String(loyaltyLevel) === loyaltyFilter
        return matchesQuery && matchesStatus && matchesLoyalty
      }),
    [contacts, query, status, loyaltyFilter],
  )
  const isFiltered = query.trim() !== '' || status !== 'todos' || loyaltyFilter !== 'todos'

  const handleExport = async (scope: 'filtered' | 'all', format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      setIsExporting(true)
      const res = await exportContactsSpreadsheet({
        contacts: filtered,
        allContacts: contacts,
        format,
        scope,
        includePurchases: format === 'xlsx', // CSV exporta a tabela de clientes
      })

      toast({
        title: 'Planilha exportada com sucesso!',
        description: `${res.count} cliente(s) exportado(s) em ${res.fileName}${
          res.purchasesCount > 0 ? ` com ${res.purchasesCount} compras na aba 'Compras'.` : '.'
        }`,
      })
    } catch (err) {
      console.error('Erro ao exportar planilha:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar planilha',
        description: 'Ocorreu uma falha ao gerar o arquivo. Tente novamente.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  if (loading) return <PageSkeleton />
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-[#e5e7eb] px-4 pb-3 pt-4 sm:px-5">
        <div data-tour-id="contacts-header-actions" className="flex items-start">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-600">
              Base de Clientes · Cafés Especiais
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e]">
              Clientes & Fidelidade
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Gerenciamento de clientes, histórico de compras, aniversários e níveis de fidelidade.
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            {/* Botão de Campanha em lote */}
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === 0) {
                  toast({
                    variant: 'destructive',
                    title: 'Nenhum cliente selecionado',
                    description:
                      'Marque as caixas de seleção na lista para enviar uma mensagem em lote.',
                  })
                  return
                }
                setBatchModalOpen(true)
              }}
              className="flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[11px] font-bold text-white shadow-xs transition hover:bg-emerald-700"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Campanha WhatsApp ({selectedIds.length})</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={isExporting}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2.5 text-[11px] font-medium text-[#475569] shadow-2xs transition hover:bg-[#f8fafc] hover:text-[#1c1c1e] disabled:opacity-50"
                  title="Exportar base em planilha"
                >
                  {isExporting ? (
                    <Loader2 className="size-3.5 animate-spin text-amber-600" />
                  ) : (
                    <Download className="size-3.5 text-[#64748b]" />
                  )}
                  <span>Exportar planilha</span>
                  <ChevronDown className="size-3 text-[#94a3b8]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 text-[11px]">
                <DropdownMenuLabel className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8]">
                  Exportar em Excel (.xlsx)
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleExport('filtered', 'xlsx')}
                  className="flex cursor-pointer items-center gap-2 py-1.5"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-600" />
                  <div className="flex flex-col">
                    <span className="font-medium text-[#1c1c1e]">Lista atual visível (.xlsx)</span>
                    <span className="text-[10px] text-[#64748b]">
                      {filtered.length} cliente(s) {isFiltered ? '(filtros ativos)' : ''} + aba
                      Compras
                    </span>
                  </div>
                </DropdownMenuItem>

                {isFiltered && (
                  <DropdownMenuItem
                    onClick={() => handleExport('all', 'xlsx')}
                    className="flex cursor-pointer items-center gap-2 py-1.5"
                  >
                    <FileSpreadsheet className="size-3.5 text-emerald-700" />
                    <div className="flex flex-col">
                      <span className="font-medium text-[#1c1c1e]">
                        Toda a base completa (.xlsx)
                      </span>
                      <span className="text-[10px] text-[#64748b]">
                        Todos os {contacts.length} clientes sem filtros + aba Compras
                      </span>
                    </div>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8]">
                  Opção alternativa (.csv)
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleExport('filtered', 'csv')}
                  className="flex cursor-pointer items-center gap-2 py-1.5"
                >
                  <FileText className="size-3.5 text-blue-600" />
                  <div className="flex flex-col">
                    <span className="font-medium text-[#1c1c1e]">Exportar como CSV (.csv)</span>
                    <span className="text-[10px] text-[#64748b]">
                      {filtered.length} cliente(s) formatados em UTF-8
                    </span>
                  </div>
                </DropdownMenuItem>
                {isFiltered && (
                  <DropdownMenuItem
                    onClick={() => handleExport('all', 'csv')}
                    className="flex cursor-pointer items-center gap-2 py-1.5"
                  >
                    <FileText className="size-3.5 text-blue-700" />
                    <div className="flex flex-col">
                      <span className="font-medium text-[#1c1c1e]">
                        Toda a base como CSV (.csv)
                      </span>
                      <span className="text-[10px] text-[#64748b]">
                        Todos os {contacts.length} clientes em UTF-8
                      </span>
                    </div>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
              className="flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-[11px] font-bold text-white shadow-xs transition hover:bg-amber-600"
            >
              <UserPlus className="size-3.5" /> Novo cliente
            </button>
          </div>
        </div>

        <div data-tour-id="contacts-search-bar" className="mt-4 flex flex-wrap gap-2">
          <label className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs sm:max-w-sm">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail, telefone ou café..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
            />
          </label>

          <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2 text-[#64748b] shadow-2xs">
            <Coffee className="mr-1.5 size-3 text-amber-600" />
            <select
              value={loyaltyFilter}
              onChange={(e) => setLoyaltyFilter(e.target.value as typeof loyaltyFilter)}
              className="bg-transparent text-[10px] text-[#1c1c1e] outline-none"
            >
              <option value="todos">Todos os níveis</option>
              <option value="1">Nível 1 - Grão (0–9)</option>
              <option value="2">Nível 2 - Torra (10–19)</option>
              <option value="3">Nível 3 - Blend (20–29)</option>
              <option value="4">Nível 4 - Barista (30–39)</option>
              <option value="5">Nível 5 - Mestre (40+)</option>
            </select>
          </label>

          <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2 text-[#64748b] shadow-2xs">
            <Filter className="mr-1.5 size-3" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="bg-transparent text-[10px] text-[#1c1c1e] outline-none"
            >
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="lead">Lead</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
        </div>
      </div>

      <div data-tour-id="contacts-table-list" className="min-h-0 flex-1 overflow-auto">
        <div className="hidden min-w-[1100px] sm:block">
          <div className="grid h-8 grid-cols-[36px_minmax(190px,1.2fr)_130px_110px_minmax(170px,1fr)_120px_130px_110px_90px_40px] items-center border-b border-[#e5e7eb] bg-[#fafafa] px-3 text-[9px] font-semibold text-[#64748b]">
            <span className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every((c) => selectedIds.includes(c.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    const allF = filtered.map((c) => c.id)
                    setSelectedIds((prev) => Array.from(new Set([...prev, ...allF])))
                  } else {
                    const allF = filtered.map((c) => c.id)
                    setSelectedIds((prev) => prev.filter((id) => !allF.includes(id)))
                  }
                }}
                className="size-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
            </span>
            <span>Cliente</span>
            <span>Nível Fidelidade</span>
            <span>Compras</span>
            <span>E-mail</span>
            <span>Telefone</span>
            <span>Última Compra</span>
            <span>Aniversário</span>
            <span>Status</span>
            <span />
          </div>
          {filtered.map((contact, index) => {
            const loyalty = getLoyaltyLevel(contact.purchase_count || 0)
            const bday = getBirthdayInfo(contact.birthday)
            const daysSince = getDaysSinceLastPurchase(contact.last_purchase_date)

            const isSelected = selectedIds.includes(contact.id)

            return (
              <div
                key={contact.id}
                className={cn(
                  'group grid min-h-11 w-full animate-row-fade grid-cols-[36px_minmax(190px,1.2fr)_130px_110px_minmax(170px,1fr)_120px_130px_110px_90px_40px] items-center border-b border-[#f1f5f9] px-3 text-left text-[10px] transition hover:bg-[#f8fafc]',
                  isSelected && 'bg-amber-50/40',
                )}
                style={{ animationDelay: `${Math.min(index * 18, 150)}ms` }}
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds((prev) => [...prev, contact.id])
                      } else {
                        setSelectedIds((prev) => prev.filter((id) => id !== contact.id))
                      }
                    }}
                    className="size-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/contatos?contact=${contact.id}`)}
                  className="flex min-w-0 items-center gap-2 pr-2 text-left"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-50 border border-amber-200 text-[8px] font-bold text-amber-800">
                    {initials(contact.name)}
                  </span>
                  <span className="truncate font-semibold text-[#1c1c1e]">
                    {contact.name}
                    {contact.favorite_coffee && (
                      <span className="block truncate text-[9px] font-normal text-[#94a3b8]">
                        ☕ {contact.favorite_coffee}
                      </span>
                    )}
                  </span>
                </button>

                <span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                      loyalty.badgeColor,
                    )}
                  >
                    <span>
                      Nv.{loyalty.level} {loyalty.name}
                    </span>
                  </span>
                </span>

                <span className="font-mono text-[10px] text-[#475569]">
                  <strong>{contact.purchase_count || 0}x</strong>
                  <span className="text-[#94a3b8] ml-1">
                    ({money.format(contact.total_spent || 0)})
                  </span>
                </span>

                <span className="truncate pr-3 text-[#64748b]">{contact.email || '—'}</span>
                <span className="font-mono text-[9px] text-[#64748b]">{contact.phone || '—'}</span>

                <span className="font-mono text-[9px]">
                  {contact.last_purchase_date ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        daysSince !== null && daysSince >= 30
                          ? 'text-orange-700 font-bold'
                          : 'text-[#475569]',
                      )}
                    >
                      {datePt(contact.last_purchase_date)}
                      {daysSince !== null && daysSince >= 30 && (
                        <span className="rounded bg-orange-100 px-1 py-0.2 text-[8px] text-orange-800">
                          {daysSince}d atrás
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[#94a3b8]">Nunca</span>
                  )}
                </span>

                <span className="font-mono text-[9px]">
                  {contact.birthday ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        bday.isToday
                          ? 'font-bold text-rose-700'
                          : bday.isNext7Days
                            ? 'font-semibold text-amber-800'
                            : 'text-[#64748b]',
                      )}
                    >
                      <Cake className="size-2.5 shrink-0" />
                      {bday.formattedDate}
                      {bday.isToday && (
                        <span className="rounded bg-rose-100 px-1 text-[8px] text-rose-700 font-bold">
                          Hoje!
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[#cbd5e1]">—</span>
                  )}
                </span>

                <span>
                  <ContactStatus status={contact.status} />
                </span>

                <span>
                  <Edit3 className="size-3 opacity-0 text-[#94a3b8] group-hover:opacity-100" />
                </span>
              </div>
            )
          })}
        </div>
        <div className="grid gap-2 p-3 sm:hidden">
          {filtered.map((contact) => {
            const loyalty = getLoyaltyLevel(contact.purchase_count || 0)
            const bday = getBirthdayInfo(contact.birthday)
            return (
              <button
                key={contact.id}
                onClick={() => navigate(`/contatos?contact=${contact.id}`)}
                className="rounded-md border border-[#e5e7eb] bg-white p-3 text-left shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-800">
                      {initials(contact.name)}
                    </span>
                    <div>
                      <p className="truncate text-xs font-bold text-[#1c1c1e]">{contact.name}</p>
                      <p className="truncate text-[10px] text-[#64748b]">
                        {contact.purchase_count || 0} compras ·{' '}
                        {money.format(contact.total_spent || 0)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                      loyalty.badgeColor,
                    )}
                  >
                    Nv.{loyalty.level} {loyalty.name}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#f1f5f9] pt-2 text-[9px] text-[#64748b]">
                  {contact.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" />
                      {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      {contact.phone}
                    </span>
                  )}
                  {contact.birthday && (
                    <span className="flex items-center gap-1 text-rose-700">
                      <Cake className="size-3" />
                      {bday.formattedDate}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {!filtered.length && (
          <div className="grid h-48 place-items-center text-xs text-[#94a3b8]">
            Nenhum contato encontrado.
          </div>
        )}
      </div>
      <ContactDrawer
        contact={detail}
        onClose={() => navigate('/contatos')}
        onEdit={(contact) => {
          setEditing(contact)
          setDialogOpen(true)
        }}
      />
      <ContactDialog open={dialogOpen} onOpenChange={setDialogOpen} contact={editing} />

      {/* Modal de Disparo de Campanha em Lote via WhatsApp */}
      <BatchWhatsAppModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        contacts={contacts.filter((c) => selectedIds.includes(c.id))}
      />
    </div>
  )
}
function ContactStatus({ status }: { status: Contact['status'] }) {
  const style =
    status === 'ativo'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : status === 'lead'
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-slate-300 bg-slate-100 text-slate-700'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium capitalize',
        style,
      )}
    >
      <span className="size-1 rounded-full bg-current" />
      {status}
    </span>
  )
}
