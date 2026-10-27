import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormField } from '@/components/auth/FormField'
import { StatusState } from '@/components/StatusState'
import pb from '@/lib/pocketbase/client'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

export default function ConfirmEmailChange() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return setError('Confirme sua senha atual.')
    setBusy(true)
    setError('')
    try {
      await pb.collection('users').confirmEmailChange(token, password)
      pb.authStore.clear()
      setDone(true)
    } catch (err) {
      const fields = extractFieldErrors(err)
      setError(fields.password || getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthShell
      title="Confirmar novo e-mail"
      description="Uma última validação protege sua conta."
      footer={
        <Link className="text-amber-600 hover:text-amber-700 font-semibold" to="/login">
          Voltar para o login
        </Link>
      }
    >
      {!token ? (
        <StatusState status="error" title="Link inválido">
          O token não foi encontrado na URL.
        </StatusState>
      ) : done ? (
        <StatusState status="success" title="E-mail alterado">
          A sessão foi encerrada por segurança. Entre com seu novo e-mail.
        </StatusState>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <FormField
            label="Senha atual"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
          />
          <button
            disabled={busy}
            className="flex h-10 w-full items-center justify-center rounded-md bg-amber-500 text-[13px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : 'Confirmar alteração'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
