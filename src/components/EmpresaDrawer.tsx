import { useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  Building2,
  Clock3,
  ExternalLink,
  Globe,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  Send,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import { ContactDialog } from '@/components/forms/ContactDialog'
import { DealDialog } from '@/components/forms/DealDialog'
import { EmailComposerModal } from '@/components/forms/EmailComposerModal'
import { UserAvatar } from '@/components/UserAvatar'
import { TemperatureBadge } from '@/components/TemperatureBadge'
import { datePt, money, relativeTime, type Empresa } from '@/types/crm'

export function EmpresaDrawer({
  empresa,
  onClose,
  onEdit,
}: {
  empresa: Empresa | null
  onClose: () => void
  onEdit: (empresa: Empresa) => void
}) {
  const { contacts, deals, activities, stages, refresh } = useCrm()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'contatos' | 'negocios' | 'timeline'>('contatos')
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [newContactOpen, setNewContactOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)

  // Contatos vinculados
  const relatedContacts = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.empresa === empresa?.id ||
          (empresa?.name && c.company?.toLowerCase() === empresa.name.toLowerCase()),
      ),
    [contacts, empresa],
  )

  // Negócios vinculados
  const relatedDeals = useMemo(
    () =>
      deals.filter(
        (d) =>
          d.empresa === empresa?.id ||
          (empresa?.id && relatedContacts.some((c) => c.id === d.contact)),
      ),
    [deals, empresa, relatedContacts],
  )

  // Negócios abertos e métricas financeiras
  const openDeals = useMemo(() => relatedDeals.filter((d) => d.status === 'aberto'), [relatedDeals])
  const totalPipeline = useMemo(
    () => openDeals.reduce((sum, d) => sum + (d.value || 0), 0),
    [openDeals],
  )
  const totalWon = useMemo(
    () =>
      relatedDeals.filter((d) => d.status === 'ganho').reduce((sum, d) => sum + (d.value || 0), 0),
    [relatedDeals],
  )

  // Timeline de atividades de contatos ou deals da empresa
  const timeline = useMemo(() => {
    if (!empresa) return []
    const contactIds = new Set(relatedContacts.map((c) => c.id))
    const dealIds = new Set(relatedDeals.map((d) => d.id))
    return activities.filter((act) => {
      if (act.contact && contactIds.has(act.contact)) return true
      if (act.deal && dealIds.has(act.deal)) return true
      return false
    })
  }, [activities, empresa, relatedContacts, relatedDeals])

  if (!empresa) return null

  const sizeBadgeColors: Record<string, string> = {
    pequena: 'border-slate-300 bg-slate-50 text-slate-700',
    média: 'border-blue-300 bg-blue-50 text-blue-700',
    grande: 'border-purple-300 bg-purple-50 text-purple-700',
  }

  return (
    <>
      <button
        aria-label="Fechar detalhes"
        className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[500px] animate-drawer-in flex-col border-l border-[#e5e7eb] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.1)]">
        {/* Header */}
        <header className="flex h-12 items-center border-b border-[#e5e7eb] px-4 bg-[#f8fafc]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748b] flex items-center gap-1.5">
            <Building2 className="size-3.5 text-amber-600" />
            Conta Comercial
          </span>
          <div className="flex-1" />
          <button
            onClick={() => onEdit(empresa)}
            className="mr-1 rounded px-2 py-1 text-[10px] font-medium text-[#475569] hover:bg-[#e2e8f0] hover:text-[#1c1c1e]"
          >
            Editar
          </button>
          <button onClick={onClose} className="rounded p-1.5 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Card Principal da Empresa */}
          <section className="border-b border-[#e5e7eb] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-12 place-items-center rounded-xl bg-amber-50 border border-amber-200 text-base font-extrabold text-amber-700 shadow-2xs">
                {empresa.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="flex flex-col items-end gap-1">
                {empresa.size && (
                  <span
                    className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      sizeBadgeColors[empresa.size] || 'border-slate-200 text-slate-700'
                    }`}
                  >
                    Porte {empresa.size}
                  </span>
                )}
                {empresa.sector && (
                  <span className="text-[11px] font-medium text-[#64748b]">{empresa.sector}</span>
                )}
              </div>
            </div>

            <h2 className="mt-3 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e]">
              {empresa.name}
            </h2>

            {/* Links e contatos da empresa */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#475569]">
              {empresa.website ? (
                <a
                  href={empresa.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-amber-600 truncate"
                >
                  <Globe className="size-3.5 text-[#94a3b8] shrink-0" />
                  <span className="truncate">{empresa.website.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="size-2.5 text-[#94a3b8]" />
                </a>
              ) : (
                <span className="flex items-center gap-1.5 text-[#94a3b8]">
                  <Globe className="size-3.5" /> Sem website
                </span>
              )}

              {empresa.phone ? (
                <span className="flex items-center gap-1.5 truncate">
                  <Phone className="size-3.5 text-[#94a3b8] shrink-0" />
                  <span>{empresa.phone}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[#94a3b8]">
                  <Phone className="size-3.5" /> Sem telefone
                </span>
              )}

              {empresa.email ? (
                <a
                  href={`mailto:${empresa.email}`}
                  className="flex items-center gap-1.5 hover:text-amber-600 truncate sm:col-span-2"
                >
                  <Mail className="size-3.5 text-[#94a3b8] shrink-0" />
                  <span className="truncate">{empresa.email}</span>
                </a>
              ) : (
                <span className="flex items-center gap-1.5 text-[#94a3b8] sm:col-span-2">
                  <Mail className="size-3.5" /> Sem e-mail cadastrado
                </span>
              )}
            </div>

            {empresa.notes && (
              <p className="mt-4 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[11px] leading-relaxed text-[#475569]">
                {empresa.notes}
              </p>
            )}

            {/* KPIs da Empresa */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-2.5 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#64748b]">
                  Pipeline Aberto
                </span>
                <span className="mt-1 block font-mono text-[12px] font-extrabold text-[#1c1c1e]">
                  {money.format(totalPipeline)}
                </span>
                <span className="text-[9px] text-[#94a3b8]">
                  {openDeals.length} oportunidade(s)
                </span>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                  Total Ganho
                </span>
                <span className="mt-1 block font-mono text-[12px] font-extrabold text-emerald-700">
                  {money.format(totalWon)}
                </span>
                <span className="text-[9px] text-emerald-600">
                  {relatedDeals.filter((d) => d.status === 'ganho').length} ganho(s)
                </span>
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-2.5 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#64748b]">
                  Decisores
                </span>
                <span className="mt-1 block font-mono text-[13px] font-extrabold text-[#1c1c1e]">
                  {relatedContacts.length}
                </span>
                <span className="text-[9px] text-[#94a3b8]">contato(s)</span>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNewDealOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-500 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-600 transition"
              >
                <Plus className="size-3.5" /> Criar oportunidade
              </button>
              <button
                type="button"
                onClick={() => setNewContactOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition"
              >
                <UserPlus className="size-3.5 text-[#64748b]" /> Novo decisor
              </button>
              {relatedContacts[0]?.email && (
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                >
                  <Send className="size-3 text-amber-700" /> E-mail
                </button>
              )}
            </div>
          </section>

          {/* Abas Secundárias: Contatos / Negócios / Timeline */}
          <div className="flex border-b border-[#e5e7eb] px-4 bg-[#f8fafc]">
            <button
              onClick={() => setActiveTab('contatos')}
              className={`flex items-center gap-1.5 border-b-2 py-2.5 px-2 text-xs font-bold transition ${
                activeTab === 'contatos'
                  ? 'border-amber-500 text-[#1c1c1e]'
                  : 'border-transparent text-[#64748b] hover:text-[#1c1c1e]'
              }`}
            >
              <Users className="size-3.5" />
              Contatos ({relatedContacts.length})
            </button>
            <button
              onClick={() => setActiveTab('negocios')}
              className={`flex items-center gap-1.5 border-b-2 py-2.5 px-2 text-xs font-bold transition ${
                activeTab === 'negocios'
                  ? 'border-amber-500 text-[#1c1c1e]'
                  : 'border-transparent text-[#64748b] hover:text-[#1c1c1e]'
              }`}
            >
              <BriefcaseBusiness className="size-3.5" />
              Negócios ({relatedDeals.length})
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-1.5 border-b-2 py-2.5 px-2 text-xs font-bold transition ${
                activeTab === 'timeline'
                  ? 'border-amber-500 text-[#1c1c1e]'
                  : 'border-transparent text-[#64748b] hover:text-[#1c1c1e]'
              }`}
            >
              <Clock3 className="size-3.5" />
              Histórico ({timeline.length})
            </button>
          </div>

          {/* Conteúdo das Abas */}
          <div className="p-5">
            {activeTab === 'contatos' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-[#1c1c1e]">
                    Decisores & Pessoas de Contato
                  </span>
                  <button
                    onClick={() => setNewContactOpen(true)}
                    className="flex items-center gap-1 rounded border border-[#cbd5e1] px-2 py-1 text-[9px] font-semibold text-[#475569] hover:bg-[#f8fafc]"
                  >
                    <Plus className="size-3" /> Adicionar
                  </button>
                </div>
                {relatedContacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => navigate(`/contatos?contact=${contact.id}`)}
                    className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-white p-3 hover:border-[#cbd5e1] hover:bg-[#f8fafc] cursor-pointer transition shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-bold text-[#1c1c1e]">
                          {contact.name}
                        </span>
                        <span className="rounded bg-[#f1f5f9] px-1.5 py-0.2 text-[9px] text-[#64748b] font-medium capitalize">
                          {contact.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#64748b]">
                        {contact.position || 'Sem cargo informado'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#94a3b8]">
                        {contact.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="size-3" /> {contact.email}
                          </span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" /> {contact.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!relatedContacts.length && (
                  <div className="rounded-lg border border-dashed border-[#e2e8f0] p-6 text-center text-xs text-[#94a3b8]">
                    Nenhum contato vinculado a esta empresa ainda.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'negocios' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-[#1c1c1e]">
                    Oportunidades em Aberto & Histórico
                  </span>
                  <button
                    onClick={() => setNewDealOpen(true)}
                    className="flex items-center gap-1 rounded border border-[#cbd5e1] px-2 py-1 text-[9px] font-semibold text-[#475569] hover:bg-[#f8fafc]"
                  >
                    <Plus className="size-3" /> Criar oportunidade
                  </button>
                </div>
                {relatedDeals.map((deal) => {
                  const stageObj = stages.find((s) => s.id === deal.stage)
                  return (
                    <div
                      key={deal.id}
                      onClick={() => navigate(`/negocios?deal=${deal.id}`)}
                      className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-white p-3 hover:border-[#cbd5e1] hover:bg-[#f8fafc] cursor-pointer transition shadow-2xs"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">
                            {deal.code}
                          </span>
                          <span className="truncate text-xs font-bold text-[#1c1c1e]">
                            {deal.title}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium"
                            style={{
                              color: stageObj?.color || '#64748b',
                              backgroundColor: `${stageObj?.color || '#64748b'}16`,
                              border: `1px solid ${stageObj?.color || '#64748b'}40`,
                            }}
                          >
                            {stageObj?.name || 'Estágio'}
                          </span>
                          <TemperatureBadge temperature={deal.temperature} />
                          <span className="text-[10px] text-[#94a3b8]">
                            Fechamento: {datePt(deal.expected_close)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-extrabold text-[#1c1c1e]">
                          {money.format(deal.value)}
                        </span>
                        <span
                          className={`block text-[9px] font-bold capitalize mt-0.5 ${
                            deal.status === 'ganho'
                              ? 'text-emerald-600'
                              : deal.status === 'perdido'
                                ? 'text-red-600'
                                : 'text-blue-600'
                          }`}
                        >
                          {deal.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {!relatedDeals.length && (
                  <div className="rounded-lg border border-dashed border-[#e2e8f0] p-6 text-center text-xs text-[#94a3b8]">
                    Nenhum negócio associado a esta empresa ainda.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-[#1c1c1e]">
                    Linha do Tempo das Interações
                  </span>
                </div>
                {timeline.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
                      <MessageSquareText className="size-3 text-[#64748b]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] leading-relaxed text-[#334155] whitespace-pre-wrap">
                        {activity.content}
                      </p>
                      <p className="mt-1 text-[9px] text-[#94a3b8]">
                        {activity.expand?.author?.name || 'Sistema'} ·{' '}
                        {relativeTime(activity.created)}
                      </p>
                    </div>
                  </div>
                ))}
                {!timeline.length && (
                  <p className="text-xs text-[#94a3b8] text-center py-6">
                    Nenhuma atividade registrada para os contatos ou negócios desta empresa.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Modais de criação rápida vinculados à empresa */}
      <DealDialog
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        presetContact={relatedContacts[0]?.id}
        presetEmpresa={empresa.id}
      />
      <ContactDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        presetEmpresa={empresa.id}
        presetCompanyName={empresa.name}
      />
      {relatedContacts[0] && (
        <EmailComposerModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          contact={relatedContacts[0]}
          deal={relatedDeals[0] || null}
          onSent={async () => {
            await refresh()
          }}
        />
      )}
    </>
  )
}
