import { useState } from 'react'
import { JourneyKanbanBoard } from '@/components/JourneyKanbanBoard'
import { ContactDrawer } from '@/components/ContactDrawer'
import { ContactDialog } from '@/components/forms/ContactDialog'
import { SendWhatsAppModal } from '@/components/SendWhatsAppModal'
import { PageSkeleton } from '@/components/PageSkeleton'
import { useCrm } from '@/contexts/CrmContext'
import type { Contact } from '@/types/crm'

export default function CustomerJourney() {
  const { contacts, loading, refresh } = useCrm()
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Modal WhatsApp rápido
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)
  const [whatsAppContact, setWhatsAppContact] = useState<Contact | null>(null)
  const [whatsAppMoment, setWhatsAppMoment] = useState<
    'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado'
  >('personalizado')

  if (loading) return <PageSkeleton />

  const handleQuickWhatsApp = (
    contact: Contact,
    moment: 'aniversario' | 'recorrencia' | 'nivel_fidelidade' | 'personalizado',
  ) => {
    setWhatsAppContact(contact)
    setWhatsAppMoment(moment)
    setWhatsAppModalOpen(true)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex-1 min-h-0">
        <JourneyKanbanBoard
          contacts={contacts}
          onSelectContact={(contact) => setSelectedContact(contact)}
          onQuickWhatsApp={handleQuickWhatsApp}
        />
      </div>

      {/* Drawer de Detalhes e Linha do Tempo do Cliente */}
      <ContactDrawer
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        onEdit={(c) => {
          setEditingContact(c)
          setDialogOpen(true)
        }}
      />

      {/* Diálogo de Edição de Contato */}
      <ContactDialog open={dialogOpen} onOpenChange={setDialogOpen} contact={editingContact} />

      {/* Modal de Disparo WhatsApp caloroso Disney */}
      <SendWhatsAppModal
        open={whatsAppModalOpen}
        onClose={() => {
          setWhatsAppModalOpen(false)
          setWhatsAppContact(null)
        }}
        contact={whatsAppContact}
        initialMoment={whatsAppMoment}
        onSent={async () => {
          await refresh()
        }}
      />
    </div>
  )
}
