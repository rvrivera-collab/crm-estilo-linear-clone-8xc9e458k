import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthShell } from '@/components/auth/AuthShell'
import { StatusState } from '@/components/StatusState'
import pb from '@/lib/pocketbase/client'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error')
  useEffect(() => {
    if (!token) return
    pb.collection('users')
      .confirmVerification(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])
  return (
    <AuthShell
      title="Verificação de e-mail"
      description="Confirmando a identidade da sua conta."
      footer={
        <Link className="text-amber-600 hover:text-amber-700 font-semibold" to="/ask">
          Acessar CRM Agent
        </Link>
      }
    >
      <StatusState
        status={status}
        title={
          status === 'loading'
            ? 'Confirmando…'
            : status === 'success'
              ? 'E-mail verificado'
              : 'Link inválido ou expirado'
        }
      >
        {status === 'loading'
          ? 'Aguarde enquanto validamos seu link.'
          : status === 'success'
            ? 'Sua conta foi confirmada e está pronta para uso no Agent.'
            : 'Solicite um novo e-mail de verificação ou confira se o link está completo.'}
      </StatusState>
    </AuthShell>
  )
}
