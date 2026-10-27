import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { RecordAuthResponse } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/types/crm'

interface AuthContextValue {
  user: UserRecord | null
  loading: boolean
  login: (email: string, password: string) => Promise<RecordAuthResponse<UserRecord>>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserRecord | null>(pb.authStore.record as UserRecord | null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(record as UserRecord | null)
    }, true)
    const bootstrap = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection<UserRecord>('users').authRefresh()
        } catch {
          pb.authStore.clear()
        }
      }
      setLoading(false)
    }
    bootstrap()
    return unsubscribe
  }, [])

  const login = useCallback(
    (email: string, password: string) =>
      pb.collection<UserRecord>('users').authWithPassword(email, password),
    [],
  )

  const signup = useCallback(async (name: string, email: string, password: string) => {
    await pb.collection<UserRecord>('users').create({
      name,
      email,
      password,
      passwordConfirm: password,
    })
    await pb.collection('users').requestVerification(email)
  }, [])

  const logout = useCallback(() => pb.authStore.clear(), [])
  const refresh = useCallback(async () => {
    await pb.collection<UserRecord>('users').authRefresh()
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refresh }),
    [user, loading, login, signup, logout, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
