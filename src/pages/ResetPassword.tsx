import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormField } from '@/components/auth/FormField'
import { StatusState } from '@/components/StatusState'
import pb from '@/lib/pocketbase/client'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (form.password.length < 8) next.password = 'Use pelo menos 8 caracteres.'
    if (form.confirm !== form.password) next.passwordConfirm = 'As senhas não coincidem.'
    if (Object.keys(next).length) return setErrors(next)
    setBusy(true)
    setErrors({})
    try {
      await pb.collection('users').confirmPasswordReset(token, form.password, form.confirm)
      setDone(true)
    } catch (error) {
      const fields = extractFieldErrors(error)
      setErrors(Object.keys(fields).length ? fields : { password: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthShell
      title="Nova senha"
      description="Defina uma senha nova para sua conta."
      footer={
        <Link className="text-amber-600 hover:text-amber-700 font-semibold" to="/login">
          Voltar para o login
        </Link>
      }
    >
      {!token ? (
        <StatusState status="error" title="Link inválido">
          O token não foi encontrado. Solicite um novo link de redefinição.
        </StatusState>
      ) : done ? (
        <StatusState status="success" title="Senha atualizada">
          Sua senha foi alterada. Você já pode entrar novamente.
        </StatusState>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <FormField
            label="Nova senha"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
          />
          <FormField
            label="Confirmar nova senha"
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            error={errors.passwordConfirm}
          />
          <button
            disabled={busy}
            className="flex h-10 w-full items-center justify-center rounded-md bg-amber-500 text-[13px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
