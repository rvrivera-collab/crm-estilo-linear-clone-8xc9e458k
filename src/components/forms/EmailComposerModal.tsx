import { useEffect, useState } from 'react'
import { FileText, LoaderCircle, Mail, Send, Sparkles, User, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { leadAiAction, listEmailTemplates, sendCrmEmail } from '@/services/crm'
import type { Contact, Deal, EmailTemplate } from '@/types/crm'

export interface EmailComposerModalProps {
  open: boolean
  onClose: () => void
  deal?: Deal | null
  contact?: Contact | null
  initialSubject?: string
  initialBody?: string
  onSent?: () => void
}

export function EmailComposerModal({
  open,
  onClose,
  deal,
  contact,
  initialSubject = '',
  initialBody = '',
  onSent,
}: EmailComposerModalProps) {
  const { toast } = useToast()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [sending, setSending] = useState(false)

  // Target contact info
  const targetContact = contact || deal?.expand?.contact
  const contactName = targetContact?.name || ''
  const companyName = targetContact?.company || ''
  const stageName = deal?.expand?.stage?.name || 'Prospecção'

  useEffect(() => {
    if (open) {
      const email = targetContact?.email || ''
      setTo(email)
      setSubject(initialSubject)
      setBody(initialBody)
      setSelectedTemplate('')
      listEmailTemplates()
        .then(setTemplates)
        .catch(() => {})
    }
  }, [open, targetContact, initialSubject, initialBody])

  if (!open) return null

  function applyTemplate(templateId: string) {
    setSelectedTemplate(templateId)
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return

    const replacePlaceholders = (text: string) => {
      return text
        .replace(/\{\{nome\}\}/gi, contactName || 'cliente')
        .replace(/\{\{empresa\}\}/gi, companyName || 'sua empresa')
        .replace(/\{\{estagio\}\}/gi, stageName)
    }

    setSubject(replacePlaceholders(tpl.subject))
    setBody(replacePlaceholders(tpl.body))
  }

  async function generateAiFollowup() {
    if (!deal) {
      toast({
        variant: 'destructive',
        title: 'Selecione um negócio para contexto da IA',
      })
      return
    }

    setLoadingAi(true)
    try {
      const res = await leadAiAction({
        dealId: deal.id,
        action: 'draft_followup',
      })
      if (res.subject) setSubject(res.subject)
      if (res.body) setBody(res.body)
      toast({
        title: 'Follow-up redigido com IA!',
        description: 'Mensagem personalizada criada a partir do histórico do lead.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar com IA',
        description: 'Não foi possível redigir o e-mail no momento.',
      })
    } finally {
      setLoadingAi(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!to.trim() || !to.includes('@')) {
      toast({ variant: 'destructive', title: 'Informe um e-mail destinatário válido' })
      return
    }
    if (!subject.trim()) {
      toast({ variant: 'destructive', title: 'O assunto é obrigatório' })
      return
    }
    if (!body.trim()) {
      toast({ variant: 'destructive', title: 'O corpo do e-mail não pode ficar vazio' })
      return
    }

    setSending(true)
    try {
      await sendCrmEmail({
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        dealId: deal?.id,
        contactId: targetContact?.id,
      })
      toast({
        title: 'E-mail enviado com sucesso!',
        description: `Registrado na timeline de ${contactName || to}.`,
      })
      onSent?.()
      onClose()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Falha ao enviar e-mail',
        description: 'Verifique a conexão ou os dados preenchidos.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px] animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="pointer-events-auto flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-xl border border-[#e2e8f0] shadow-xl overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3.5 bg-[#f8fafc]">
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Mail className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#1c1c1e]">
                  Enviar e-mail para {contactName || 'Lead'}
                </h3>
                {deal && (
                  <p className="font-mono text-[9px] text-[#64748b]">
                    {deal.code} · {deal.title}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1c1c1e]"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSend}
            className="flex flex-col flex-1 min-h-0 overflow-y-auto p-5 space-y-4"
          >
            {/* Top Toolbar: Templates and AI */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
              <div className="flex items-center gap-2">
                <FileText className="size-3.5 text-[#64748b]" />
                <span className="text-[10px] font-semibold text-[#475569]">Template:</span>
                <select
                  value={selectedTemplate}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="rounded border border-[#cbd5e1] bg-white px-2 py-1 text-[11px] text-[#1c1c1e] outline-none focus:border-amber-500"
                >
                  <option value="">Personalizado / Nenhum</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              {deal && (
                <button
                  type="button"
                  onClick={generateAiFollowup}
                  disabled={loadingAi}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100/80 transition disabled:opacity-50"
                >
                  {loadingAi ? (
                    <>
                      <LoaderCircle className="size-3 animate-spin text-amber-600" />
                      Redigindo com IA...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3 text-amber-600" />
                      Redigir follow-up com IA
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Recipient */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
                Destinatário
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#94a3b8]">
                  <User className="size-3.5" />
                </div>
                <input
                  type="email"
                  required
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="destinatario@empresa.com"
                  className="block w-full rounded-md border border-[#cbd5e1] py-1.5 pl-9 pr-3 text-xs text-[#1c1c1e] placeholder:text-[#94a3b8] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
                Assunto
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto da mensagem..."
                className="block w-full rounded-md border border-[#cbd5e1] py-1.5 px-3 text-xs font-semibold text-[#1c1c1e] placeholder:text-[#94a3b8] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col min-h-[160px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
                Mensagem
              </label>
              <textarea
                required
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Olá, escreva sua mensagem ou clique em 'Redigir follow-up com IA'..."
                className="block w-full flex-1 rounded-md border border-[#cbd5e1] p-3 text-xs leading-relaxed text-[#1c1c1e] placeholder:text-[#94a3b8] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-[#e5e7eb]">
              <span className="text-[10px] text-[#94a3b8]">
                O envio será registrado automaticamente na timeline do lead.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md px-3 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1c1c1e]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Enviar e-mail
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
