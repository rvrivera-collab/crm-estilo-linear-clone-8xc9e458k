import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  CheckCircle2,
  Compass,
  Info,
  KeyRound,
  LayoutTemplate,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Sliders,
  Sparkles,
  MessageCircle,
  UserRound,
} from 'lucide-react'
import { ConnectorButton } from '@/components/skip/ConnectorButton'
import { UserAvatar } from '@/components/UserAvatar'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { useTour } from '@/contexts/TourContext'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { getWhatsAppSettings, saveWhatsAppSettings } from '@/services/crm'
import pb from '@/lib/pocketbase/client'

export default function Settings() {
  const { user, refresh } = useAuth()
  const { toast } = useToast()
  const { tourDisabled, setTourDisabled, resetAllTours } = useTour()
  const [updatingTour, setUpdatingTour] = useState(false)

  // Profile form state
  const [name, setName] = useState(user?.name || '')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [passwords, setPasswords] = useState({ old: '', next: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  // WABA ID manual (conta WhatsApp Business) usado pelos envios via API oficial
  const [wabaId, setWabaId] = useState('')
  const [savingWaba, setSavingWaba] = useState(false)
  const [wabaJustSaved, setWabaJustSaved] = useState(false)

  // Mensagem automática de progresso de fidelidade (padrão: LIGADA)
  const [loyaltyProgressEnabled, setLoyaltyProgressEnabled] = useState(true)
  const [savingLoyaltyProgress, setSavingLoyaltyProgress] = useState(false)

  useEffect(() => {
    let alive = true
    getWhatsAppSettings()
      .then((rec) => {
        if (!alive || !rec) return
        if (rec.waba_id) setWabaId(rec.waba_id)
        if (typeof rec.loyalty_progress_disabled === 'boolean')
          setLoyaltyProgressEnabled(!rec.loyalty_progress_disabled)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const avatarPreview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : ''), [avatar])

  if (!user) return null

  async function handleToggleTourDisabled(checked: boolean) {
    try {
      setUpdatingTour(true)
      await setTourDisabled(checked)
      await refresh()
      toast({
        title: checked ? 'Tour guiado desativado' : 'Tour guiado reativado',
        description: checked
          ? 'O tour guiado não será mais exibido automaticamente nas páginas.'
          : 'O tour guiado poderá ser exibido em páginas novas ou através do menu.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar preferência',
        description: 'Não foi possível atualizar a configuração do tour.',
      })
    } finally {
      setUpdatingTour(false)
    }
  }

  async function saveWabaId() {
    const clean = wabaId.replace(/\D/g, '')
    if (clean && clean.length < 6) {
      setErrors({ waba_id: 'Um WABA ID válido tem 6 dígitos ou mais.' })
      return
    }
    setSavingWaba(true)
    setErrors({})
    try {
      await saveWhatsAppSettings(clean)
      setWabaId(clean)
      setWabaJustSaved(true)
      setTimeout(() => setWabaJustSaved(false), 4000)
      toast({
        title: clean ? 'WABA ID salvo' : 'WABA ID removido',
        description: clean
          ? 'Os próximos envios pela API oficial vão usar este WABA ID.'
          : 'O CRM volta a descobrir a conta WhatsApp Business automaticamente pela conexão.',
      })
    } catch (error) {
      setErrors({ waba_id: getErrorMessage(error) })
    } finally {
      setSavingWaba(false)
    }
  }

  async function handleToggleLoyaltyProgress(enabled: boolean) {
    const previous = loyaltyProgressEnabled
    setLoyaltyProgressEnabled(enabled)
    setSavingLoyaltyProgress(true)
    try {
      await saveWhatsAppSettings(wabaId.replace(/\D/g, ''), {
        loyaltyProgressDisabled: !enabled,
      })
      toast({
        title: enabled ? 'Mensagem de progresso ativada' : 'Mensagem de progresso desativada',
        description: enabled
          ? 'A cada compra registrada, o cliente recebe a mensagem de progresso no Clube de Fidelidade.'
          : 'As próximas compras não disparam a mensagem automática de progresso.',
      })
    } catch (error) {
      setLoyaltyProgressEnabled(previous)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar preferência',
        description: getErrorMessage(error),
      })
    } finally {
      setSavingLoyaltyProgress(false)
    }
  }

  function handleResetTours() {
    resetAllTours()
    toast({
      title: 'Histórico de tours limpo',
      description: 'As marcações de páginas já vistas foram redefinidas.',
    })
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErrors({ name: 'Informe seu nome.' })
    setBusy('profile')
    setErrors({})
    try {
      const data = new FormData()
      data.set('name', name.trim())
      if (avatar) data.set('avatar', avatar)
      await pb.collection('users').update(user.id, data)
      await refresh()
      setAvatar(null)
      toast({ title: 'Perfil atualizado' })
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(Object.keys(fields).length ? fields : { profile: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(newEmail))
      return setErrors({ newEmail: 'Informe um e-mail válido.' })
    setBusy('email')
    setErrors({})
    try {
      await pb.collection('users').requestEmailChange(newEmail)
      toast({
        title: 'Link de confirmação enviado',
        description: `Confira a caixa de entrada de ${newEmail}.`,
      })
      setNewEmail('')
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(Object.keys(fields).length ? fields : { newEmail: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!passwords.old) next.oldPassword = 'Informe a senha atual.'
    if (passwords.next.length < 8) next.password = 'Use pelo menos 8 caracteres.'
    if (passwords.next !== passwords.confirm) next.passwordConfirm = 'As senhas não coincidem.'
    if (Object.keys(next).length) return setErrors(next)
    setBusy('password')
    setErrors({})
    try {
      await pb.collection('users').update(user.id, {
        oldPassword: passwords.old,
        password: passwords.next,
        passwordConfirm: passwords.confirm,
      })
      setPasswords({ old: '', next: '', confirm: '' })
      toast({ title: 'Senha atualizada' })
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(Object.keys(fields).length ? fields : { password: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#faf7f2]">
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#8c531b] font-bold">
          Workspace · Cafés Especiais
        </p>
        <h1 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#2b1c13]">
          Configurações
        </h1>
        <p className="mt-1 text-xs text-[#705e4d]">
          Gerencie sua identidade de usuário, segurança e canais do CRM.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[190px_1fr]">
          <nav className="space-y-1 rounded-lg border border-[#ded2c3] bg-[#f5ede2] p-2 shadow-2xs">
            <a
              href="#perfil"
              className="flex h-8 items-center gap-2 rounded-md bg-white border border-[#ded2c3] px-2.5 text-[11px] font-bold text-[#2b1c13] shadow-2xs"
            >
              <UserRound className="size-3.5 text-amber-600" /> Perfil
            </a>
            <a
              href="#email"
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[11px] font-medium text-[#5c4735] hover:bg-[#ede3d4] hover:text-[#2b1c13]"
            >
              <Mail className="size-3.5" /> E-mail
            </a>
            <a
              href="#seguranca"
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[11px] font-medium text-[#5c4735] hover:bg-[#ede3d4] hover:text-[#2b1c13]"
            >
              <ShieldCheck className="size-3.5" /> Segurança
            </a>
            <a
              href="#tour"
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[11px] font-medium text-[#5c4735] hover:bg-[#ede3d4] hover:text-[#2b1c13]"
            >
              <Compass className="size-3.5" /> Tour guiado
            </a>
            <a
              href="#whatsapp"
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[11px] font-medium text-[#5c4735] hover:bg-[#ede3d4] hover:text-[#2b1c13]"
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
            <Link
              to="/formularios"
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[11px] font-medium text-[#5c4735] hover:bg-[#ede3d4] hover:text-[#2b1c13]"
            >
              <LayoutTemplate className="size-3.5" /> Formulário de Captação
            </Link>
          </nav>

          <div className="space-y-6">
            {/* BANNER / ATALHO LIMPO PARA O FORMULÁRIO DE CAPTAÇÃO UNIFICADO */}
            <div className="rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-md bg-amber-50 border border-amber-200 grid place-items-center shrink-0">
                  <Sliders className="size-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#1c1c1e]">
                    Formulário de Captação & Embed
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    A personalização visual, campos personalizados e os códigos de embed agora estão
                    reunidos em uma página dedicada.
                  </p>
                </div>
              </div>
              <Link
                to="/formularios"
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition shadow-2xs shrink-0 self-start sm:self-auto"
              >
                <LayoutTemplate className="size-3.5" />
                Abrir editor do formulário
              </Link>
            </div>

            {/* DEMAIS CONFIGURAÇÕES DA CONTA */}
            <SettingsCard
              id="perfil"
              title="Perfil"
              description="Estas informações identificam você no CRM."
            >
              <form onSubmit={saveProfile}>
                <div className="flex items-center gap-4">
                  <label className="group relative cursor-pointer">
                    <span className="block">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Prévia"
                          className="size-14 rounded-full object-cover border border-[#e2e8f0]"
                        />
                      ) : (
                        <UserAvatar user={user} className="size-14 text-sm" />
                      )}
                    </span>
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                      <Camera className="size-4" />
                    </span>
                    <input
                      className="hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setAvatar(e.target.files?.[0] || null)}
                    />
                  </label>
                  <div>
                    <p className="text-xs font-bold text-[#1c1c1e]">Imagem do perfil</p>
                    <p className="mt-1 text-[10px] text-[#64748b]">PNG, JPG ou WebP, até 5 MB.</p>
                  </div>
                </div>
                <Field label="Nome completo" error={errors.name}>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                {errors.avatar && <p className="mt-2 text-[10px] text-red-600">{errors.avatar}</p>}
                <Submit busy={busy === 'profile'}>Salvar perfil</Submit>
              </form>
            </SettingsCard>

            <SettingsCard
              id="email"
              title="Alterar e-mail"
              description={`E-mail atual: ${user.email}`}
            >
              <form onSubmit={changeEmail}>
                <Field label="Novo e-mail" error={errors.newEmail || errors.email}>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                  />
                </Field>
                <p className="mt-2 text-[10px] leading-4 text-[#64748b]">
                  Enviaremos um link para o novo endereço. Depois da confirmação, sua sessão será
                  encerrada.
                </p>
                <Submit busy={busy === 'email'}>Enviar confirmação</Submit>
              </form>
            </SettingsCard>

            <SettingsCard
              id="seguranca"
              title="Trocar senha"
              description="Use uma senha exclusiva com pelo menos 8 caracteres."
            >
              <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-2">
                <Field label="Senha atual" error={errors.oldPassword} className="sm:col-span-2">
                  <input
                    type="password"
                    value={passwords.old}
                    onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                  />
                </Field>
                <Field label="Nova senha" error={errors.password}>
                  <input
                    type="password"
                    value={passwords.next}
                    onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                  />
                </Field>
                <Field label="Confirmar senha" error={errors.passwordConfirm}>
                  <input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Submit busy={busy === 'password'} icon={KeyRound}>
                    Atualizar senha
                  </Submit>
                </div>
              </form>
            </SettingsCard>

            {/* SEÇÃO CONEXÃO WHATSAPP */}
            <SettingsCard
              id="whatsapp"
              title="Conexão do WhatsApp"
              description="Vincule sua conta de WhatsApp diretamente dentro do CRM para automações e disparos da jornada Disney."
            >
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-emerald-100 border border-emerald-200 grid place-items-center text-emerald-700">
                        <MessageCircle className="size-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#1c1c1e]">
                          Vincular WhatsApp ao CRM
                        </span>
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          Conector Oficial Meta / Cloud API
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#64748b] max-w-xl leading-relaxed">
                      Conecte seu WhatsApp com um clique. Ao conectar, o CRM dispara as mensagens de
                      aniversário, avisos de recompra em 30 dias e mensagens da base automaticamente
                      pela sua conta.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <ConnectorButton toolkit="whatsapp" name="WhatsApp" />
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-[#475569] space-y-1">
                  <p className="font-bold text-[#1c1c1e]">Como funciona a conexão dentro do CRM:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[#64748b]">
                    <li>
                      <strong>Conectado:</strong> Disparos são enviados via WhatsApp Cloud API
                      diretamente.
                    </li>
                    <li>
                      <strong>Desconectado:</strong> O CRM não fica bloqueado; ele ativa o envio com
                      1 clique pelo link seguro wa.me (WhatsApp Web/App).
                    </li>
                  </ul>
                </div>

                {/* WABA ID manual — escape-hatch quando a conexão aponta para um Business Manager */}
                <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="size-3.5 shrink-0 mt-0.5 text-amber-700" />
                    <div className="flex-1 space-y-1">
                      <p className="text-[11px] font-bold text-amber-950">
                        WABA ID (conta WhatsApp Business)
                      </p>
                      <p className="text-[10px] leading-4 text-amber-900/90">
                        Cole aqui o ID da sua conta WhatsApp Business (WABA). Copie em{' '}
                        <span className="font-mono">developers.facebook.com</span> → seu app →{' '}
                        <span className="font-mono">WhatsApp</span> →{' '}
                        <span className="font-mono">API Setup</span>, seção{' '}
                        <strong>Business Account</strong>. Quando preenchido, ele tem precedência
                        sobre a conta detectada automaticamente pela conexão.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      placeholder="Ex.: 123456789012345"
                      inputMode="numeric"
                      className="w-full sm:max-w-xs rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-mono text-[#1c1c1e] outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={saveWabaId}
                      disabled={savingWaba}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition disabled:opacity-60 shrink-0"
                    >
                      {savingWaba ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : wabaJustSaved ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : null}
                      {wabaId.trim() ? 'Salvar WABA ID' : 'Limpar e voltar ao automático'}
                    </button>
                  </div>
                  {errors.waba_id && (
                    <p className="text-[10px] font-semibold text-red-600">{errors.waba_id}</p>
                  )}
                  <p className="text-[10px] text-[#64748b]">
                    Deixando vazio e salvando, o CRM volta a tentar descobrir a conta
                    automaticamente pela conexão.
                  </p>
                </div>

                {/* Mensagem automática de progresso de fidelidade (liga/desliga) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-amber-950">
                      Mensagem automática de progresso de fidelidade
                    </p>
                    <p className="text-[10px] leading-4 text-amber-900/90 max-w-xl">
                      A cada compra registrada, o cliente recebe no WhatsApp uma mensagem no tom
                      Disney com o número da compra, o nível atual do Clube de Fidelidade e quantas
                      compras faltam para o próximo nível (com bônus especial). Ao subir de nível,
                      ele recebe um parabéns no lugar da mensagem comum.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {savingLoyaltyProgress ? (
                      <LoaderCircle className="size-3.5 animate-spin text-amber-700" />
                    ) : null}
                    <Switch
                      checked={loyaltyProgressEnabled}
                      disabled={savingLoyaltyProgress}
                      onCheckedChange={handleToggleLoyaltyProgress}
                    />
                  </div>
                </div>
              </div>
            </SettingsCard>

            {/* SEÇÃO TOUR GUIADO */}
            <SettingsCard
              id="tour"
              title="Tour guiado"
              description="Controle a exibição dos passos interativos de introdução aos recursos do CRM."
            >
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-[#e2e8f0] bg-[#fafafa] p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Compass className="size-4 text-amber-600" />
                      <span className="text-xs font-bold text-[#1c1c1e]">
                        Desativar tour guiado
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b] max-w-xl">
                      Se habilitado, o tour guiado não será mais exibido automaticamente em nenhuma
                      página.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {updatingTour && (
                      <LoaderCircle className="size-3.5 animate-spin text-amber-600" />
                    )}
                    <Switch
                      id="toggle-tour-disabled"
                      checked={tourDisabled}
                      disabled={updatingTour}
                      onCheckedChange={handleToggleTourDisabled}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] text-[#64748b]">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-amber-600" />
                    <span>
                      O botão <strong>Tour guiado</strong> na barra lateral continua disponível para
                      reabrir o passo a passo manualmente quando você quiser.
                    </span>
                  </div>
                  {!tourDisabled && (
                    <button
                      type="button"
                      onClick={handleResetTours}
                      className="shrink-0 text-amber-600 hover:text-amber-700 font-medium underline underline-offset-2 self-start sm:self-auto"
                    >
                      Redefinir páginas vistas
                    </button>
                  )}
                </div>
              </div>
            </SettingsCard>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 rounded-lg border border-[#ded2c3] bg-white shadow-2xs"
    >
      <div className="border-b border-[#ded2c3] bg-[#fbf9f5] px-4 py-3 rounded-t-lg">
        <h2 className="text-xs font-extrabold text-[#2b1c13]">{title}</h2>
        <p className="mt-1 text-[10px] text-[#705e4d]">{description}</p>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  error,
  children,
  className = '',
}: {
  label: string
  error?: string
  children: React.ReactElement
  className?: string
}) {
  return (
    <label className={`mt-4 block ${className}`}>
      <span className="mb-1.5 block text-[10px] font-semibold text-[#475569]">{label}</span>
      <span className="crm-field-control block max-w-md">{children}</span>
      {error && <span className="mt-1 block text-[10px] text-red-600">{error}</span>}
    </label>
  )
}

function Submit({
  busy,
  children,
  icon: Icon,
}: {
  busy: boolean
  children: React.ReactNode
  icon?: typeof KeyRound
}) {
  return (
    <button
      disabled={busy}
      className="mt-4 flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-[10px] font-bold text-white shadow-xs transition hover:bg-amber-600 disabled:opacity-60"
    >
      {busy ? (
        <LoaderCircle className="size-3 animate-spin" />
      ) : Icon ? (
        <Icon className="size-3" />
      ) : null}
      {children}
    </button>
  )
}
