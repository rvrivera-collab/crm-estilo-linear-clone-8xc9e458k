import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormField } from '@/components/auth/FormField'
import { useAuth } from '@/contexts/AuthContext'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

export default function Signup() {
  const { signup } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Informe seu nome.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Informe um e-mail válido.'
    if (form.password.length < 8) next.password = 'Use pelo menos 8 caracteres.'
    if (Object.keys(next).length) return setErrors(next)
    setBusy(true)
    setErrors({})
    setGeneral('')
    try {
      await signup(form.name.trim(), form.email.trim(), form.password)
      setSent(true)
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(fields)
      setGeneral(Object.keys(fields).length ? '' : getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Criar conta"
      description="Entre no workspace da CRM Adapta."
      footer={
        <>
          Já tem uma conta?{' '}
          <Link className="font-semibold text-amber-600 hover:text-amber-700" to="/login">
            Entrar
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="mb-4 size-6 text-emerald-600" />
          <h2 className="text-sm font-bold text-[#1c1c1e]">Verifique seu e-mail</h2>
          <p className="mt-2 text-xs leading-5 text-[#64748b]">
            Enviamos um link de confirmação para{' '}
            <strong className="text-[#1c1c1e]">{form.email}</strong>.
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <FormField
            label="Nome completo"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />
          <FormField
            label="E-mail"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
          />
          <FormField
            label="Senha"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
          />
          {general && <p className="text-xs text-red-600">{general}</p>}
          <button
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-500 text-[13px] font-bold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <>
                Criar conta <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
