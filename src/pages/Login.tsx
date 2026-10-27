import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormField } from '@/components/auth/FormField'
import { useAuth } from '@/contexts/AuthContext'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('teste@direto.app')
  const [password, setPassword] = useState('Direto@2026')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/ask" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!email.trim()) next.email = 'Informe seu e-mail.'
    if (!password) next.password = 'Informe sua senha.'
    if (Object.keys(next).length) return setErrors(next)
    setBusy(true)
    setErrors({})
    setGeneral('')
    try {
      await login(email.trim(), password)
      const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      const target = !fromPath || fromPath === '/' ? '/ask' : fromPath
      navigate(target, { replace: true })
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(fields)
      setGeneral(
        Object.keys(fields).length
          ? ''
          : getErrorMessage(error) === 'Failed to authenticate.'
            ? 'E-mail ou senha inválidos.'
            : getErrorMessage(error),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      description="Entre para continuar no workspace comercial."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link className="font-semibold text-amber-600 hover:text-amber-700" to="/signup">
            Criar conta
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <FormField
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email || errors.identity}
        />
        <FormField
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <div className="flex justify-end">
          <Link className="text-[11px] text-[#64748b] hover:text-[#1c1c1e]" to="/forgot-password">
            Esqueci minha senha
          </Link>
        </div>
        {general && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {general}
          </p>
        )}
        <button
          disabled={busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-500 text-[13px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <>
              Entrar <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>
      <div className="mt-5 rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2.5 text-[11px] text-[#64748b]">
        Acesso inicial: <span className="font-mono text-[#1c1c1e]">teste@direto.app</span> ·{' '}
        <span className="font-mono text-[#1c1c1e]">Direto@2026</span>
      </div>
    </AuthShell>
  )
}
