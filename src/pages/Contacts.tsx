import { useEffect, useMemo, useState } from 'react'
import { Check, Edit3, Filter, Mail, Phone, Search, UserPlus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ContactDrawer } from '@/components/ContactDrawer'
import { ContactDialog } from '@/components/forms/ContactDialog'
import { PageSkeleton } from '@/components/PageSkeleton'
import { UserAvatar } from '@/components/UserAvatar'
import { useCrm } from '@/contexts/CrmContext'
import { cn } from '@/lib/utils'
import { initials, type Contact } from '@/types/crm'

export default function Contacts() {
  const { contacts, loading } = useCrm()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'todos' | Contact['status']>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
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
      contacts.filter(
        (contact) =>
          `${contact.name} ${contact.email} ${contact.company} ${contact.position}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (status === 'todos' || contact.status === status),
      ),
    [contacts, query, status],
  )
  if (loading) return <PageSkeleton />
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-[#e5e7eb] px-4 pb-3 pt-4 sm:px-5">
        <div data-tour-id="contacts-header-actions" className="flex items-start">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-amber-600">
              Relacionamentos
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e]">
              Contatos
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">Pessoas e contas do ciclo comercial.</p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
            className="flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-2.5 text-[10px] font-bold text-white shadow-xs transition hover:bg-amber-600"
          >
            <UserPlus className="size-3.5" /> Novo contato
          </button>
        </div>
        <div data-tour-id="contacts-search-bar" className="mt-4 flex gap-2">
          <label className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 shadow-2xs sm:max-w-sm">
            <Search className="mr-2 size-3.5 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, empresa ou e-mail…"
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#1c1c1e] outline-none placeholder:text-[#94a3b8]"
            />
          </label>
          <label className="flex h-8 items-center rounded-md border border-[#e2e8f0] bg-white px-2 text-[#64748b] shadow-2xs">
            <Filter className="mr-1.5 size-3" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="bg-transparent text-[10px] text-[#1c1c1e] outline-none"
            >
              <option value="todos">Todos os status</option>
              <option value="lead">Lead</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
        </div>
      </div>
      <div data-tour-id="contacts-table-list" className="min-h-0 flex-1 overflow-auto">
        <div className="hidden min-w-[900px] sm:block">
          <div className="grid h-8 grid-cols-[minmax(170px,1.2fr)_160px_140px_minmax(180px,1fr)_140px_90px_125px_40px] items-center border-b border-[#e5e7eb] bg-[#fafafa] px-3 text-[9px] font-semibold text-[#64748b]">
            <span>Nome</span>
            <span>Empresa</span>
            <span>Cargo</span>
            <span>E-mail</span>
            <span>Telefone</span>
            <span>Status</span>
            <span>Responsável</span>
            <span />
          </div>
          {filtered.map((contact, index) => (
            <button
              key={contact.id}
              onClick={() => navigate(`/contatos?contact=${contact.id}`)}
              className="group grid min-h-10 w-full animate-row-fade grid-cols-[minmax(170px,1.2fr)_160px_140px_minmax(180px,1fr)_140px_90px_125px_40px] items-center border-b border-[#f1f5f9] px-3 text-left text-[10px] transition hover:bg-[#f8fafc]"
              style={{ animationDelay: `${Math.min(index * 18, 150)}ms` }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-[8px] font-bold text-[#475569]">
                  {initials(contact.name)}
                </span>
                <span className="truncate font-semibold text-[#1c1c1e]">{contact.name}</span>
              </span>
              <span className="truncate pr-3 text-[#475569]">
                {contact.expand?.empresa?.name || contact.company || '—'}
              </span>
              <span className="truncate pr-3 text-[#64748b]">{contact.position || '—'}</span>
              <span className="truncate pr-3 text-[#64748b]">{contact.email || '—'}</span>
              <span className="font-mono text-[9px] text-[#64748b]">{contact.phone || '—'}</span>
              <span>
                <ContactStatus status={contact.status} />
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <UserAvatar user={contact.expand?.owner} className="size-4" />
                <span className="truncate text-[#64748b]">{contact.expand?.owner?.name}</span>
              </span>
              <span>
                <Edit3 className="size-3 opacity-0 text-[#94a3b8] group-hover:opacity-100" />
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-2 p-3 sm:hidden">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => navigate(`/contatos?contact=${contact.id}`)}
              className="rounded-md border border-[#e5e7eb] bg-white p-3 text-left shadow-2xs"
            >
              <div className="flex items-center">
                <span className="grid size-8 place-items-center rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-[9px] font-bold text-[#475569]">
                  {initials(contact.name)}
                </span>
                <div className="ml-2 min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#1c1c1e]">{contact.name}</p>
                  <p className="truncate text-[10px] text-[#64748b]">
                    {contact.position} · {contact.expand?.empresa?.name || contact.company}
                  </p>
                </div>
                <ContactStatus status={contact.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#f1f5f9] pt-2 text-[9px] text-[#64748b]">
                <span className="flex items-center gap-1">
                  <Mail className="size-3" />
                  {contact.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="size-3" />
                  {contact.phone}
                </span>
              </div>
            </button>
          ))}
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
