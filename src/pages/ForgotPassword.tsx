import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormField } from '@/components/auth/FormField'
import pb from '@/lib/pocketbase/client'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErrors({ email: 'Informe um e-mail válido.' })
    setBusy(true)
    setErrors({})
    try {
      await pb.collection('users').requestPasswordReset(email)
      setSent(true)
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(Object.keys(fields).length ? fields : { email: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthShell
      title="Redefinir senha"
      description="Enviaremos um link seguro para seu e-mail."
      footer={
        <Link to="/login" className="text-amber-600 hover:text-amber-700 font-semibold">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <MailCheck className="mb-4 size-6 text-emerald-600" />
          <h2 className="text-sm font-bold text-[#1c1c1e]">Link enviado</h2>
          <p className="mt-2 text-xs leading-5 text-[#64748b]">
            Se existir uma conta para {email}, as instruções chegarão em instantes.
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <FormField
            label="E-mail da conta"
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <button
            disabled={busy}
            className="flex h-10 w-full items-center justify-center rounded-md bg-amber-500 text-[13px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : 'Enviar link'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
