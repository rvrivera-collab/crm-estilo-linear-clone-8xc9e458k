import { useEffect, useMemo, useState } from 'react'
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useCrm } from '@/contexts/CrmContext'
import { useToast } from '@/hooks/use-toast'
import {
  AGENDA_TYPE_LABELS,
  createAgendaEvent,
  deleteAgendaEvent,
  updateAgendaEvent,
} from '@/services/crm'
import type { AgendaEvent, AgendaEventType } from '@/types/crm'

interface AgendaEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: AgendaEvent | null
  presetDate?: string // YYYY-MM-DD
  presetCustomerId?: string
  presetType?: AgendaEventType
  onSaved?: () => void
  onDeleted?: () => void
}

export function AgendaEventDialog({
  open,
  onOpenChange,
  event,
  presetDate,
  presetCustomerId,
  presetType,
  onSaved,
  onDeleted,
}: AgendaEventDialogProps) {
  const { contacts, refresh } = useCrm()
  const { toast } = useToast()

  const defaultDate = useMemo(() => {
    if (event?.date) {
      return event.date.slice(0, 10)
    }
    if (presetDate) return presetDate
    const now = new Date()
    return now.toISOString().slice(0, 10)
  }, [event, presetDate])

  const initial = useMemo(
    () => ({
      title: event?.title || '',
      date: defaultDate,
      time: event?.time || '',
      type: (event?.type || presetType || 'follow_up') as AgendaEventType,
      customer: event?.customer || presetCustomerId || '',
      notes: event?.notes || '',
      done: Boolean(event?.done),
    }),
    [event, defaultDate, presetCustomerId, presetType],
  )

  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial)
      setErrors({})
    }
  }, [open, initial])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!form.title.trim()) nextErrors.title = 'Informe o título do compromisso.'
    if (!form.date) nextErrors.date = 'Informe a data.'
    if (!form.type) nextErrors.type = 'Selecione o tipo de evento.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setBusy(true)
    setErrors({})
    try {
      if (event) {
        await updateAgendaEvent(event.id, {
          title: form.title.trim(),
          date: form.date,
          time: form.time.trim(),
          type: form.type,
          customer: form.customer || null,
          notes: form.notes.trim(),
          done: form.done,
        })
        toast({
          title: 'Compromisso atualizado',
          description: `"${form.title}" foi atualizado na agenda.`,
        })
      } else {
        await createAgendaEvent({
          title: form.title.trim(),
          date: form.date,
          time: form.time.trim(),
          type: form.type,
          customer: form.customer || undefined,
          notes: form.notes.trim(),
          done: form.done,
        })
        toast({
          title: '✨ Agendamento criado',
          description: `"${form.title}" foi adicionado à sua agenda.`,
        })
      }
      await refresh()
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar agendamento',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!event || deleting) return
    if (!window.confirm('Tem certeza de que deseja excluir este compromisso da agenda?')) return

    setDeleting(true)
    try {
      await deleteAgendaEvent(event.id)
      toast({
        title: 'Compromisso excluído',
        description: 'O agendamento foi removido com sucesso.',
      })
      await refresh()
      onDeleted?.()
      onOpenChange(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir agendamento',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex h-full w-full flex-col bg-white text-[#1c1c1e] sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl sm:border sm:border-[#e5e7eb] sm:shadow-[0_18px_50px_rgba(0,0,0,.15)] animate-panel-rise overflow-hidden"
      >
        {/* Header estilo Linear */}
        <div className="flex h-13 shrink-0 items-center justify-between border-b border-[#e5e7eb] px-5 bg-[#fafafa]">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-amber-100 text-amber-800">
              <CalendarIcon className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#1c1c1e]">
                {event ? 'Editar Compromisso' : 'Novo Compromisso na Agenda'}
              </h2>
              <p className="text-[10px] text-[#64748b]">
                {event ? 'Atualize horários, cliente e notas' : 'Adicione à rotina da cafeteria'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-[#64748b] hover:bg-[#e2e8f0] transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Formulário com scroll se necessário */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">
              Título do compromisso <span className="text-rose-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              placeholder="Ex.: Degustação de Cafés Filtrados com Maria"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-xs font-medium text-[#1c1c1e] outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-[#94a3b8]"
            />
            {errors.title && <p className="mt-1 text-[11px] text-rose-600">{errors.title}</p>}
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">
                Data <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-xs font-medium text-[#1c1c1e] outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              {errors.date && <p className="mt-1 text-[11px] text-rose-600">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">
                Horário (opcional)
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-xs font-medium text-[#1c1c1e] outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Tipo de Evento */}
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">
              Tipo de Evento <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as AgendaEventType })}
              className="w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-xs font-medium text-[#1c1c1e] outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
            >
              {(Object.keys(AGENDA_TYPE_LABELS) as AgendaEventType[]).map((t) => (
                <option key={t} value={t}>
                  {AGENDA_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Vínculo opcional com Cliente */}
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">
              Vincular a um Cliente (opcional)
            </label>
            <select
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
              className="w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-xs font-medium text-[#1c1c1e] outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
            >
              <option value="">Nenhum cliente associado (lembrete geral/pessoal)</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''} {c.phone ? `· ${c.phone}` : ''}
                </option>
              ))}
            </select>
            {form.customer && (
              <p className="mt-1 text-[10px] text-amber-700 flex items-center gap-1">
                <Sparkles className="size-3 text-amber-600" />
                Registrará na Linha do Tempo Disney do cliente ao salvar e ao concluir.
              </p>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">
              Notas & Detalhes
            </label>
            <textarea
              rows={3}
              placeholder="Pauta da reunião, grãos de café a separar, endereço de entrega..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-xs text-[#1c1c1e] outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-[#94a3b8] resize-none"
            />
          </div>

          {/* Status: Concluído */}
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.done}
                onChange={(e) => setForm({ ...form, done: e.target.checked })}
                className="size-4 rounded border-[#cbd5e1] text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-[#1c1c1e]">
                Marcar como compromisso concluído
              </span>
            </label>
            <p className="mt-1 text-[11px] text-[#64748b] pl-6.5">
              Eventos concluídos ficam com texto riscado na lista do dia e calendário.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[#e5e7eb] px-5 py-3 bg-[#fafafa]">
          <div>
            {event && (
              <button
                type="button"
                disabled={deleting || busy}
                onClick={handleDelete}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition disabled:opacity-60"
              >
                {deleting ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Excluir
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8.5 rounded-md border border-[#cbd5e1] px-3 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-amber-500 px-4 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              {event ? 'Salvar Alterações' : 'Agendar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
