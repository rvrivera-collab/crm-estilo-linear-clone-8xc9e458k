import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  LoaderCircle,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  User,
} from 'lucide-react'
import { captureLeadPublic, getCaptureForm } from '@/services/crm'
import type { CaptureForm } from '@/types/crm'
import pb from '@/lib/pocketbase/client'

export default function LeadCapture() {
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const [formConfig, setFormConfig] = useState<CaptureForm | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // Honeypot
  const [customAnswers, setCustomAnswers] = useState<Record<string, string | number | boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [leadCode, setLeadCode] = useState<string | null>(null)

  // Param pode vir do path /form/:id ou da querystring ?form=... ou ?campaign=...
  const formTarget = id || searchParams.get('form') || searchParams.get('form_id') || undefined
  const campaignTarget =
    searchParams.get('campaign') || searchParams.get('campaign_id') || undefined

  useEffect(() => {
    let active = true
    async function loadForm() {
      try {
        setLoadingConfig(true)
        const cfg = await getCaptureForm(formTarget)
        if (active && cfg) {
          setFormConfig(cfg)
        }
      } catch {
        // Fallback to default if not found
      } finally {
        if (active) setLoadingConfig(false)
      }
    }
    loadForm()
    return () => {
      active = false
    }
  }, [formTarget])

  // Computed configuration with defaults
  const title = formConfig?.title || 'Vamos transformar seu processo comercial'
  const subtitle =
    formConfig?.subtitle !== undefined
      ? formConfig.subtitle
      : 'Preencha o formulário abaixo. Nossa equipe responderá de forma personalizada em menos de 2 horas.'
  const submitText = formConfig?.submit_text || 'Enviar solicitação'
  const successMessage =
    formConfig?.success_message ||
    'Muito obrigado pelo contato. Seu atendimento já foi registrado em nossa esteira comercial. Nossa IA já preparou o contexto e nosso consultor entrará em contato.'
  const accentColor = formConfig?.accent_color || '#f59e0b'

  const showPhone = formConfig ? Boolean(formConfig.show_phone) : true
  const requirePhone = formConfig ? Boolean(formConfig.require_phone) : false
  const showCompany = formConfig ? Boolean(formConfig.show_company) : true
  const requireCompany = formConfig ? Boolean(formConfig.require_company) : false
  const showPosition = formConfig ? Boolean(formConfig.show_position) : true
  const requirePosition = formConfig ? Boolean(formConfig.require_position) : false
  const showMessage = formConfig ? Boolean(formConfig.show_message) : true
  const requireMessage = formConfig ? Boolean(formConfig.require_message) : false

  const customFieldsConfig = formConfig?.custom_fields
    ? Array.isArray(formConfig.custom_fields)
      ? formConfig.custom_fields
      : typeof formConfig.custom_fields === 'string'
        ? (() => {
            try {
              return JSON.parse(formConfig.custom_fields as unknown as string)
            } catch {
              return []
            }
          })()
        : []
    : []

  const logoUrl =
    formConfig && formConfig.logo ? pb.files.getURL(formConfig, formConfig.logo) : null

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Por favor, informe seu nome completo.'
    if (!email.trim()) {
      errs.email = 'Por favor, informe seu e-mail.'
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      errs.email = 'Informe um endereço de e-mail válido.'
    }
    if (showPhone && requirePhone && !phone.trim()) {
      errs.phone = 'Por favor, informe seu telefone / WhatsApp.'
    }
    if (showCompany && requireCompany && !company.trim()) {
      errs.company = 'Por favor, informe o nome da sua empresa.'
    }
    if (showPosition && requirePosition && !position.trim()) {
      errs.position = 'Por favor, informe seu cargo.'
    }
    if (showMessage && requireMessage && !message.trim()) {
      errs.message = 'Por favor, descreva sua necessidade.'
    }

    // Custom fields validation
    if (Array.isArray(customFieldsConfig) && customFieldsConfig.length > 0) {
      for (const field of customFieldsConfig) {
        const val = customAnswers[field.id]
        const label = field.label || 'Campo'

        if (field.type === 'checkbox') {
          if (field.required && !val) {
            errs[field.id] = `O campo "${label}" precisa ser marcado.`
          }
        } else if (field.type === 'number') {
          if (val === undefined || val === null || val === '') {
            if (field.required) {
              errs[field.id] = `Por favor, informe ${label.toLowerCase()}.`
            }
          } else if (isNaN(Number(val))) {
            errs[field.id] = `Informe um número válido para "${label}".`
          }
        } else if (field.type === 'email') {
          const strVal = typeof val === 'string' ? val.trim() : ''
          if (field.required && !strVal) {
            errs[field.id] = `Por favor, informe ${label.toLowerCase()}.`
          } else if (strVal && !strVal.includes('@')) {
            errs[field.id] = `Informe um e-mail válido para "${label}".`
          }
        } else if (field.type === 'select') {
          const strVal = typeof val === 'string' ? val.trim() : ''
          if (field.required && !strVal) {
            errs[field.id] = `Por favor, selecione uma opção para "${label}".`
          }
        } else {
          const strVal = typeof val === 'string' ? val.trim() : val ? String(val).trim() : ''
          if (field.required && !strVal) {
            errs[field.id] = `Por favor, preencha o campo "${label}".`
          }
        }
      }
    }

    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const res = await captureLeadPublic({
        name: name.trim(),
        email: email.trim(),
        phone: showPhone ? phone.trim() : '',
        company: showCompany ? company.trim() : '',
        position: showPosition ? position.trim() : '',
        message: showMessage ? message.trim() : '',
        website: website.trim(),
        form_id: formConfig?.id || (id ? id : undefined),
        campaign_id: campaignTarget,
        custom_fields: customAnswers,
      })
      if (res.deal?.code) setLeadCode(res.deal.code)
      setSubmitted(true)
    } catch (err: unknown) {
      let errMsg = 'Não foi possível enviar suas informações.'
      if (err instanceof Error) {
        errMsg = err.message
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        errMsg = String((err as { message: unknown }).message)
      }
      setErrors({ form: errMsg })
    } finally {
      setBusy(false)
    }
  }

  if (loadingConfig) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-[#64748b]">
          <LoaderCircle className="size-4 animate-spin text-amber-500" />
          <span>Carregando formulário...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logotipo"
              className="max-h-12 max-w-[180px] object-contain rounded"
            />
          ) : (
            <>
              <div
                className="size-8 rounded-lg grid place-items-center font-black text-[17px]"
                style={{
                  backgroundColor: `${accentColor}1A`,
                  borderColor: `${accentColor}33`,
                  borderWidth: 1,
                  color: accentColor,
                }}
              >
                <Sparkles className="size-4" style={{ color: accentColor }} />
              </div>
              <span className="font-mono text-[15px] font-bold uppercase tracking-wider text-[#1c1c1e]">
                CRM Adapta
              </span>
            </>
          )}
        </div>
        <h1 className="text-center text-[27px] sm:text-[33px] font-extrabold tracking-tight text-[#1c1c1e]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-center text-[15px] sm:text-[17px] text-[#64748b] max-w-md mx-auto">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-5 sm:px-8 border border-[#e2e8f0] rounded-xl shadow-xs">
          {submitted ? (
            <div className="text-center py-6 animate-scale-in">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="size-8 text-emerald-600" />
              </div>
              <h2 className="mt-4 text-[21px] font-bold text-[#1c1c1e]">Recebemos sua mensagem!</h2>
              <p className="mt-2 text-[15px] text-[#64748b] leading-relaxed">
                {successMessage}
                {leadCode && (
                  <span className="font-mono font-semibold text-[#1c1c1e] block mt-1.5">
                    Protocolo de atendimento: {leadCode}
                  </span>
                )}
              </p>
              <div className="mt-6 pt-5 border-t border-[#f1f5f9]">
                <button
                  type="button"
                  onClick={() => {
                    setName('')
                    setEmail('')
                    setPhone('')
                    setCompany('')
                    setPosition('')
                    setMessage('')
                    setCustomAnswers({})
                    setSubmitted(false)
                    setLeadCode(null)
                  }}
                  className="inline-flex items-center gap-1.5 text-[15px] font-semibold hover:opacity-80 transition"
                  style={{ color: accentColor }}
                >
                  Enviar outro contato
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.form && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[15px] text-red-700">
                  {errors.form}
                </div>
              )}

              {/* Honeypot field invisible to regular users */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                  Seu nome completo <span style={{ color: accentColor }}>*</span>
                </label>
                <div className="relative rounded-md shadow-2xs">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#94a3b8]">
                    <User className="size-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo"
                    className="block w-full rounded-md border border-[#cbd5e1] py-2 pl-9 pr-3 text-[15px] text-[#1c1c1e] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 bg-white"
                    style={{
                      borderColor: errors.name ? '#ef4444' : undefined,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = accentColor
                      e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
                {errors.name && <p className="mt-1 text-[13px] text-red-600">{errors.name}</p>}
              </div>

              <div className={`grid grid-cols-1 gap-4 ${showPhone ? 'sm:grid-cols-2' : ''}`}>
                <div>
                  <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                    E-mail profissional <span style={{ color: accentColor }}>*</span>
                  </label>
                  <div className="relative rounded-md shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#94a3b8]">
                      <Mail className="size-3.5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="carlos@empresa.com.br"
                      className="block w-full rounded-md border border-[#cbd5e1] py-2 pl-9 pr-3 text-[15px] text-[#1c1c1e] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 bg-white"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = accentColor
                        e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-[13px] text-red-600">{errors.email}</p>}
                </div>

                {showPhone && (
                  <div>
                    <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                      Telefone / WhatsApp{' '}
                      {requirePhone ? (
                        <span style={{ color: accentColor }}>*</span>
                      ) : (
                        <span className="text-[13px] font-normal text-[#94a3b8]">(opcional)</span>
                      )}
                    </label>
                    <div className="relative rounded-md shadow-2xs">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#94a3b8]">
                        <Phone className="size-3.5" />
                      </div>
                      <input
                        type="tel"
                        required={requirePhone}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="block w-full rounded-md border border-[#cbd5e1] py-2 pl-9 pr-3 text-[15px] text-[#1c1c1e] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 bg-white"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = accentColor
                          e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#cbd5e1'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      />
                    </div>
                    {errors.phone && (
                      <p className="mt-1 text-[13px] text-red-600">{errors.phone}</p>
                    )}
                  </div>
                )}
              </div>

              {(showCompany || showPosition) && (
                <div
                  className={`grid grid-cols-1 gap-4 ${
                    showCompany && showPosition ? 'sm:grid-cols-2' : ''
                  }`}
                >
                  {showCompany && (
                    <div>
                      <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                        Nome da empresa{' '}
                        {requireCompany ? (
                          <span style={{ color: accentColor }}>*</span>
                        ) : (
                          <span className="text-[13px] font-normal text-[#94a3b8]">(opcional)</span>
                        )}
                      </label>
                      <div className="relative rounded-md shadow-2xs">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#94a3b8]">
                          <Building2 className="size-3.5" />
                        </div>
                        <input
                          type="text"
                          required={requireCompany}
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Empresa Tecnologia Ltda"
                          className="block w-full rounded-md border border-[#cbd5e1] py-2 pl-9 pr-3 text-[15px] text-[#1c1c1e] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 bg-white"
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = accentColor
                            e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        />
                      </div>
                      {errors.company && (
                        <p className="mt-1 text-[13px] text-red-600">{errors.company}</p>
                      )}
                    </div>
                  )}

                  {showPosition && (
                    <div>
                      <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                        Seu cargo{' '}
                        {requirePosition ? (
                          <span style={{ color: accentColor }}>*</span>
                        ) : (
                          <span className="text-[13px] font-normal text-[#94a3b8]">(opcional)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        required={requirePosition}
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="Ex: Diretor Comercial"
                        className="block w-full rounded-md border border-[#cbd5e1] py-2 px-3 text-[15px] text-[#1c1c1e] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 bg-white shadow-2xs"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = accentColor
                          e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#cbd5e1'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      />
                      {errors.position && (
                        <p className="mt-1 text-[13px] text-red-600">{errors.position}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {showMessage && (
                <div>
                  <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                    Conte sobre sua necessidade ou desafio atual{' '}
                    {requireMessage ? (
                      <span style={{ color: accentColor }}>*</span>
                    ) : (
                      <span className="text-[13px] font-normal text-[#94a3b8]">(opcional)</span>
                    )}
                  </label>
                  <div className="relative rounded-md shadow-2xs">
                    <div className="pointer-events-none absolute top-2.5 left-0 flex items-center pl-3 text-[#94a3b8]">
                      <MessageSquare className="size-3.5" />
                    </div>
                    <textarea
                      rows={3}
                      required={requireMessage}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ex: Queremos automatizar o follow-up de propostas comerciais e evitar perda de oportunidades..."
                      className="block w-full resize-none rounded-md border border-[#cbd5e1] py-2 pl-9 pr-3 text-[15px] text-[#1c1c1e] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 bg-white"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = accentColor
                        e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                  {errors.message && (
                    <p className="mt-1 text-[13px] text-red-600">{errors.message}</p>
                  )}
                </div>
              )}

              {/* Campos personalizados adicionais */}
              {Array.isArray(customFieldsConfig) &&
                customFieldsConfig.map((field) => {
                  const fieldError = errors[field.id]
                  const val = customAnswers[field.id]

                  if (field.type === 'checkbox') {
                    return (
                      <div key={field.id} className="pt-1">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) =>
                              setCustomAnswers((prev) => ({
                                ...prev,
                                [field.id]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 rounded border-[#cbd5e1] text-amber-500 focus:ring-amber-500"
                          />
                          <span className="text-[15px] font-semibold text-[#475569]">
                            {field.label}{' '}
                            {field.required ? (
                              <span style={{ color: accentColor }}>*</span>
                            ) : (
                              <span className="text-[13px] font-normal text-[#94a3b8]">
                                (opcional)
                              </span>
                            )}
                          </span>
                        </label>
                        {fieldError && (
                          <p className="mt-1 text-[13px] text-red-600">{fieldError}</p>
                        )}
                      </div>
                    )
                  }

                  if (field.type === 'select') {
                    return (
                      <div key={field.id}>
                        <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                          {field.label}{' '}
                          {field.required ? (
                            <span style={{ color: accentColor }}>*</span>
                          ) : (
                            <span className="text-[13px] font-normal text-[#94a3b8]">
                              (opcional)
                            </span>
                          )}
                        </label>
                        <select
                          value={typeof val === 'string' ? val : ''}
                          onChange={(e) =>
                            setCustomAnswers((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          className="block w-full rounded-md border border-[#cbd5e1] py-2 px-3 text-[15px] text-[#1c1c1e] focus:outline-none focus:ring-1 bg-white shadow-2xs"
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = accentColor
                            e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          <option value="">{field.placeholder || 'Selecione uma opção...'}</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        {fieldError && (
                          <p className="mt-1 text-[13px] text-red-600">{fieldError}</p>
                        )}
                      </div>
                    )
                  }

                  if (field.type === 'textarea') {
                    return (
                      <div key={field.id}>
                        <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                          {field.label}{' '}
                          {field.required ? (
                            <span style={{ color: accentColor }}>*</span>
                          ) : (
                            <span className="text-[13px] font-normal text-[#94a3b8]">
                              (opcional)
                            </span>
                          )}
                        </label>
                        <textarea
                          rows={3}
                          value={typeof val === 'string' ? val : ''}
                          onChange={(e) =>
                            setCustomAnswers((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          placeholder={field.placeholder || 'Digite aqui...'}
                          className="block w-full resize-none rounded-md border border-[#cbd5e1] py-2 px-3 text-[15px] text-[#1c1c1e] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 bg-white shadow-2xs"
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = accentColor
                            e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        />
                        {fieldError && (
                          <p className="mt-1 text-[13px] text-red-600">{fieldError}</p>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div key={field.id}>
                      <label className="block text-[14px] font-semibold text-[#475569] mb-1">
                        {field.label}{' '}
                        {field.required ? (
                          <span style={{ color: accentColor }}>*</span>
                        ) : (
                          <span className="text-[13px] font-normal text-[#94a3b8]">(opcional)</span>
                        )}
                      </label>
                      <input
                        type={
                          field.type === 'number'
                            ? 'number'
                            : field.type === 'email'
                              ? 'email'
                              : field.type === 'phone'
                                ? 'tel'
                                : 'text'
                        }
                        value={val !== undefined && val !== null ? String(val) : ''}
                        onChange={(e) =>
                          setCustomAnswers((prev) => ({
                            ...prev,
                            [field.id]:
                              field.type === 'number'
                                ? e.target.value === ''
                                  ? ''
                                  : Number(e.target.value)
                                : e.target.value,
                          }))
                        }
                        placeholder={field.placeholder || `Informe ${field.label.toLowerCase()}`}
                        className="block w-full rounded-md border border-[#cbd5e1] py-2 px-3 text-[15px] text-[#1c1c1e] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 bg-white shadow-2xs"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = accentColor
                          e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#cbd5e1'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      />
                      {fieldError && <p className="mt-1 text-[13px] text-red-600">{fieldError}</p>}
                    </div>
                  )
                })}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-md py-2.5 px-4 text-[15px] font-bold text-white shadow-xs hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 transition disabled:opacity-60"
                style={{
                  backgroundColor: accentColor,
                }}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Enviando informações...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    {submitText}
                  </>
                )}
              </button>

              <p className="text-[13px] text-center text-[#94a3b8] pt-2">
                🔒 Seus dados são protegidos e nunca compartilhados com terceiros.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
