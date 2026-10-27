import { useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  Send,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '@/contexts/CrmContext'
import { datePt, money, relativeTime, type Contact } from '@/types/crm'
import { DealDialog } from '@/components/forms/DealDialog'
import { EmailComposerModal } from '@/components/forms/EmailComposerModal'

export function ContactDrawer({
  contact,
  onClose,
  onEdit,
}: {
  contact: Contact | null
  onClose: () => void
  onEdit: (contact: Contact) => void
}) {
  const { deals, activities, empresas, refresh } = useCrm()
  const navigate = useNavigate()
  const [newDeal, setNewDeal] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)

  const relatedEmpresa = useMemo(() => {
    if (!contact) return null
    if (contact.empresa) {
      return empresas.find((e) => e.id === contact.empresa) || contact.expand?.empresa || null
    }
    if (contact.company) {
      return empresas.find((e) => e.name.toLowerCase() === contact.company.toLowerCase()) || null
    }
    return null
  }, [contact, empresas])

  const relatedDeals = useMemo(
    () => deals.filter((d) => d.contact === contact?.id),
    [deals, contact],
  )
  const timeline = useMemo(
    () => activities.filter((item) => item.contact === contact?.id),
    [activities, contact],
  )
  if (!contact) return null
  return (
    <>
      <button
        aria-label="Fechar detalhes"
        className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[440px] animate-drawer-in flex-col border-l border-[#e5e7eb] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.1)]">
        <header className="flex h-12 items-center border-b border-[#e5e7eb] px-4">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[#64748b]">
            Contato
          </span>
          <div className="flex-1" />
          <button
            onClick={() => onEdit(contact)}
            className="mr-1 rounded px-2 py-1 text-[10px] font-medium text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1c1c1e]"
          >
            Editar
          </button>
          <button onClick={onClose} className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9]">
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="border-b border-[#e5e7eb] p-5">
            <div className="grid size-10 place-items-center rounded-full bg-amber-50 border border-amber-200 text-sm font-bold text-amber-700">
              {contact.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </div>
            <h2 className="mt-3 text-xl font-extrabold tracking-[-.035em] text-[#1c1c1e]">
              {contact.name}
            </h2>
            <p className="mt-1 text-xs text-[#64748b]">
              {contact.position} · {contact.company}
            </p>
            <div className="mt-5 space-y-2 text-[11px] text-[#475569]">
              <p className="flex items-center gap-2">
                <Mail className="size-3.5 text-[#94a3b8]" /> {contact.email || 'Sem e-mail'}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-3.5 text-[#94a3b8]" /> {contact.phone || 'Sem telefone'}
              </p>
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-amber-600 shrink-0" />
                {relatedEmpresa ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/empresas?empresa=${relatedEmpresa.id}`)}
                    className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 border border-amber-200 hover:bg-amber-100 transition"
                  >
                    <span>{relatedEmpresa.name}</span>
                    <ExternalLink className="size-2.5 text-amber-600" />
                  </button>
                ) : (
                  <span>{contact.company || 'Sem empresa vinculada'}</span>
                )}
              </div>
            </div>
            {contact.notes && (
              <p className="mt-4 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[11px] leading-5 text-[#475569]">
                {contact.notes}
              </p>
            )}
            {contact.custom_fields && Object.entries(contact.custom_fields).length > 0 && (
              <div className="mt-3 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[11px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">
                  Campos Personalizados
                </p>
                <div className="space-y-1.5">
                  {Object.entries(contact.custom_fields).map(([key, val]) => (
                    <div key={key} className="flex items-start justify-between gap-2">
                      <span className="text-[#64748b] text-[10px]">{key}:</span>
                      <span className="font-semibold text-[#1c1c1e] text-[11px] text-right break-words max-w-[200px]">
                        {typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEmailModalOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-500 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-600 transition"
              >
                <Send className="size-3 text-white" /> Enviar e-mail
              </button>
            </div>
          </section>
          <section className="border-b border-[#e5e7eb] p-5">
            <div className="mb-3 flex items-center">
              <h3 className="flex-1 text-xs font-extrabold text-[#1c1c1e]">
                Negócios ({relatedDeals.length})
              </h3>
              <button
                onClick={() => setNewDeal(true)}
                className="flex items-center gap-1 rounded border border-[#cbd5e1] px-2 py-1 text-[9px] font-medium text-[#475569] hover:bg-[#f8fafc]"
              >
                <Plus className="size-3" /> Criar
              </button>
            </div>
            <div className="space-y-1.5">
              {relatedDeals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => navigate(`/negocios?deal=${deal.id}`)}
                  className="flex w-full items-center rounded-md border border-[#e2e8f0] bg-white px-2.5 py-2 text-left hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition"
                >
                  <BriefcaseBusiness className="mr-2 size-3.5 text-[#64748b]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-medium text-[#1c1c1e]">
                      {deal.title}
                    </span>
                    <span className="font-mono text-[9px] text-[#64748b]">
                      {deal.code} · {datePt(deal.expected_close)}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-[#1c1c1e]">
                    {money.format(deal.value)}
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="p-5">
            <h3 className="mb-4 text-xs font-extrabold text-[#1c1c1e]">Histórico</h3>
            <div className="space-y-4">
              {timeline.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
                    <MessageSquareText className="size-3 text-[#64748b]" />
                  </span>
                  <div>
                    <p className="text-[11px] leading-5 text-[#334155]">{activity.content}</p>
                    <p className="mt-1 text-[9px] text-[#94a3b8]">
                      {relativeTime(activity.created)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
      <DealDialog
        open={newDeal}
        onOpenChange={setNewDeal}
        presetContact={contact.id}
        presetEmpresa={contact.empresa || relatedEmpresa?.id}
      />
      <EmailComposerModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        contact={contact}
        deal={relatedDeals[0] || null}
        onSent={async () => {
          await refresh()
        }}
      />
    </>
  )
}
