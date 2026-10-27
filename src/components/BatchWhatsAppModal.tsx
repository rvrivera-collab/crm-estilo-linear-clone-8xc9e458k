import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Flame,
  History,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import {
  DISNEY_MESSAGE_TEMPLATES,
  formatTemplateText,
  type MessageTemplate,
} from '@/data/messageTemplates'
import { sendDisneyWhatsApp } from '@/services/crm'
import type { Contact } from '@/types/crm'
import { getLoyaltyLevel } from '@/types/crm'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface BatchSendResult {
  contactId: string
  contactName: string
  phone?: string
  status: 'pending' | 'sending' | 'sent' | 'fallback_link' | 'error'
  message?: string
  waUrl?: string
  errorText?: string
}

interface BatchWhatsAppModalProps {
  open: boolean
  onClose: () => void
  contacts: Contact[]
  onCompleted?: () => void
}

export function BatchWhatsAppModal({
  open,
  onClose,
  contacts,
  onCompleted,
}: BatchWhatsAppModalProps) {
  const { toast } = useToast()

  // Template selecionado
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate>(
    DISNEY_MESSAGE_TEMPLATES[0], // Padrão: Recompra 30 dias (Aroma & Saudade)
  )
  const [templateText, setTemplateText] = useState<string>(DISNEY_MESSAGE_TEMPLATES[0].text)
  const [customCoupon, setCustomCoupon] = useState('CAFE-ESPECIAL')

  // Estado de envio
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, BatchSendResult>>({})
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [finished, setFinished] = useState(false)

  if (!open) return null

  // Atualizar quando selecionar outro modelo
  const handleSelectTemplate = (tmpl: MessageTemplate) => {
    setSelectedTemplate(tmpl)
    setTemplateText(tmpl.text)
  }

  // Preview de um contato aleatório ou primeiro da lista
  const previewContact = contacts[0]
  const previewMessage = previewContact
    ? formatTemplateText(templateText, previewContact, {
        couponCode: customCoupon,
      })
    : ''

  // Disparo sequencial dos clientes selecionados
  const handleStartBatch = async () => {
    if (contacts.length === 0) return
    setRunning(true)
    setFinished(false)

    // Inicializar mapa de status
    const initialStatus: Record<string, BatchSendResult> = {}
    contacts.forEach((c) => {
      initialStatus[c.id] = {
        contactId: c.id,
        contactName: c.name,
        phone: c.phone,
        status: 'pending',
      }
    })
    setResults(initialStatus)

    let successCount = 0
    let fallbackCount = 0
    let failCount = 0

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      setCurrentIndex(i + 1)

      // Atualiza para 'sending'
      setResults((prev) => ({
        ...prev,
        [contact.id]: {
          ...prev[contact.id],
          status: 'sending',
        },
      }))

      if (!contact.phone) {
        setResults((prev) => ({
          ...prev,
          [contact.id]: {
            ...prev[contact.id],
            status: 'error',
            errorText: 'Sem telefone cadastrado',
          },
        }))
        failCount++
        continue
      }

      // Gerar a mensagem personalizada única deste cliente com as variáveis
      const personalizedMsg = formatTemplateText(templateText, contact, {
        couponCode: customCoupon || contact.last_coupon_code,
      })

      try {
        const res = await sendDisneyWhatsApp({
          contactId: contact.id,
          phone: contact.phone,
          message: personalizedMsg,
          momentType:
            selectedTemplate.category === 'recorrencia_30d'
              ? 'recorrencia'
              : selectedTemplate.category === 'aniversario'
                ? 'aniversario'
                : 'personalizado',
        })

        if (res.whatsappSent) {
          successCount++
          setResults((prev) => ({
            ...prev,
            [contact.id]: {
              ...prev[contact.id],
              status: 'sent',
              message: personalizedMsg,
            },
          }))
        } else {
          fallbackCount++
          setResults((prev) => ({
            ...prev,
            [contact.id]: {
              ...prev[contact.id],
              status: 'fallback_link',
              waUrl: res.waFallbackUrl || undefined,
              message: personalizedMsg,
              errorText: res.warning || 'Disponível via link direto wa.me',
            },
          }))
        }
      } catch (err) {
        failCount++
        setResults((prev) => ({
          ...prev,
          [contact.id]: {
            ...prev[contact.id],
            status: 'error',
            errorText: err instanceof Error ? err.message : 'Falha no disparo',
          },
        }))
      }

      // Pequena pausa (600ms) entre envios para evitar rate limit de requisições
      if (i < contacts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600))
      }
    }

    setRunning(false)
    setFinished(true)
    toast({
      title: '🎉 Disparo da Campanha Concluído!',
      description: `${successCount} enviados diretamente, ${fallbackCount} com links prontos, ${failCount} falhas.`,
    })
    if (onCompleted) onCompleted()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-3 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) onClose()
      }}
    >
      <div className="w-full max-w-2xl animate-panel-rise rounded-xl border border-[#e5e7eb] bg-white text-[#1c1c1e] shadow-[0_20px_50px_rgba(0,0,0,.15)] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex h-13 items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">
              <Users className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#1c1c1e] flex items-center gap-2">
                Campanha WhatsApp Disney · Envio em Lote
              </h2>
              <p className="text-[10px] text-[#64748b]">
                Disparar mensagens personalizadas para <strong>{contacts.length}</strong> clientes
                selecionados
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={running}
            onClick={onClose}
            className="rounded p-1.5 text-[#64748b] hover:bg-[#f1f5f9] disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* SELEÇÃO DO TEMPLATE DISNEY */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[#475569] flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-600" />
                Escolha o Modelo de Mensagem Pré-Pronta
              </label>
              <span className="text-[10px] text-amber-700 font-mono">
                {DISNEY_MESSAGE_TEMPLATES.length} modelos Disney
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DISNEY_MESSAGE_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate.id === tmpl.id
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    disabled={running}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={cn(
                      'rounded-lg border p-2.5 text-left transition flex flex-col gap-1',
                      isSelected
                        ? 'border-amber-500 bg-amber-50/70 shadow-2xs ring-1 ring-amber-400'
                        : 'border-[#cbd5e1] bg-white hover:bg-[#f8fafc]',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-[#1c1c1e] truncate">
                        {tmpl.title}
                      </span>
                      {tmpl.tags?.[0] && (
                        <span className="text-[9px] font-mono px-1 rounded bg-[#e2e8f0] text-[#475569]">
                          {tmpl.tags[0]}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#64748b] line-clamp-2 leading-tight">
                      {tmpl.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* CUPOM DE DESCONTO OPCIONAL */}
          <div className="flex items-center gap-3 bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-lg">
            <div className="flex-1">
              <span className="block text-[10px] font-bold text-[#475569]">
                Cupom Padrão {'{cupom}'}
              </span>
              <p className="text-[9px] text-[#64748b]">
                Substitui a variável caso o cliente não tenha cupom exclusivo
              </p>
            </div>
            <input
              type="text"
              disabled={running}
              value={customCoupon}
              onChange={(e) => setCustomCoupon(e.target.value.toUpperCase())}
              placeholder="CAFE-ESPECIAL"
              className="w-36 rounded border border-[#cbd5e1] bg-white px-2.5 py-1 text-xs font-mono font-bold text-amber-950 uppercase outline-none focus:border-amber-500"
            />
          </div>

          {/* EDITOR DO TEXTO BASE */}
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">
              Texto Base do Template (Variáveis dinâmicas:{' '}
              <span className="font-mono text-amber-700">
                {'{apelido}'}, {'{cafe_favorito}'}, {'{metodo}'}, {'{cupom}'}
              </span>
              )
            </label>
            <textarea
              rows={5}
              disabled={running}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              className="w-full rounded-lg border border-[#cbd5e1] p-3 text-xs leading-relaxed outline-none focus:border-amber-500"
            />
          </div>

          {/* PREVIEW DO PRIMEIRO CLIENTE */}
          {previewContact && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-amber-950">
                <span>
                  Exemplo Personalizado para: <strong>{previewContact.name}</strong>
                </span>
                <span className="text-[9px] text-amber-800 font-mono">
                  Café: {previewContact.favorite_coffee || 'Padrão'}
                </span>
              </div>
              <div className="rounded bg-white p-2.5 text-[11px] text-[#1c1c1e] whitespace-pre-line border border-amber-200/80 shadow-2xs max-h-36 overflow-y-auto font-sans">
                {previewMessage}
              </div>
            </div>
          )}

          {/* PROGRESSO E RESULTADOS DOS ENVIOS */}
          {(running || finished || Object.keys(results).length > 0) && (
            <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#1c1c1e] flex items-center gap-1.5">
                  {running && <LoaderCircle className="size-3.5 animate-spin text-emerald-600" />}
                  Progresso do Disparo ({currentIndex} de {contacts.length})
                </span>
                {finished && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Finalizado
                  </span>
                )}
              </div>

              {/* Barra de Progresso */}
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.round((currentIndex / (contacts.length || 1)) * 100)}%`,
                  }}
                />
              </div>

              {/* Lista dos clientes e status */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                {contacts.map((contact) => {
                  const res = results[contact.id]
                  const status = res?.status || 'pending'

                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between rounded border border-[#f1f5f9] bg-[#fafbfc] px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="font-semibold text-[#1c1c1e] truncate">
                          {contact.name}
                        </span>
                        <span className="text-[10px] text-[#64748b] font-mono truncate">
                          {contact.phone || 'Sem fone'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {status === 'pending' && (
                          <span className="text-[10px] text-[#94a3b8]">Aguardando...</span>
                        )}
                        {status === 'sending' && (
                          <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                            <LoaderCircle className="size-3 animate-spin" /> Enviando...
                          </span>
                        )}
                        {status === 'sent' && (
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Enviado
                          </span>
                        )}
                        {status === 'fallback_link' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-blue-700 font-semibold">
                              Link gerado
                            </span>
                            {res?.waUrl && (
                              <a
                                href={res.waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-emerald-700"
                              >
                                Abrir <ExternalLink className="size-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                        {status === 'error' && (
                          <span
                            className="text-[10px] text-red-600 font-semibold"
                            title={res?.errorText}
                          >
                            Falha ({res?.errorText || 'Erro'})
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e5e7eb] px-5 py-3 bg-[#f8fafc] rounded-b-xl">
          <button
            type="button"
            disabled={running}
            onClick={onClose}
            className="rounded-md border border-[#cbd5e1] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-white disabled:opacity-50"
          >
            {finished ? 'Fechar' : 'Cancelar'}
          </button>

          {!finished ? (
            <button
              type="button"
              disabled={running || contacts.length === 0}
              onClick={handleStartBatch}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {running ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" /> Enviando lote...
                </>
              ) : (
                <>
                  <Send className="size-3.5" /> Iniciar Disparo ({contacts.length})
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              Concluído
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
