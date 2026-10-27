import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import {
  listActivities,
  listContacts,
  listDeals,
  listEmpresas,
  listOrders,
  listReferrals,
  listStages,
  listUsers,
} from '@/services/crm'
import type {
  Activity,
  Contact,
  CrmData,
  Deal,
  Empresa,
  Order,
  Referral,
  Stage,
  UserRecord,
} from '@/types/crm'

const CrmContext = createContext<CrmData | null>(null)

export function CrmProvider({ children }: PropsWithChildren) {
  const [stages, setStages] = useState<Stage[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [
      nextStages,
      nextContacts,
      nextEmpresas,
      nextDeals,
      nextOrders,
      nextReferrals,
      nextActivities,
      nextUsers,
    ] = await Promise.all([
      listStages(),
      listContacts(),
      listEmpresas(),
      listDeals(),
      listOrders(),
      listReferrals(),
      listActivities(),
      listUsers(),
    ])
    setStages(nextStages)
    setContacts(nextContacts)
    setEmpresas(nextEmpresas)
    setDeals(nextDeals)
    setOrders(nextOrders)
    setReferrals(nextReferrals)
    setActivities(nextActivities)
    setUsers(nextUsers)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh().catch(() => setLoading(false))
  }, [refresh])

  useRealtime<Deal>('deals', () => {
    listDeals()
      .then(setDeals)
      .catch(() => {})
  })
  useRealtime<Activity>('activities', () => {
    listActivities()
      .then(setActivities)
      .catch(() => {})
  })
  useRealtime<Contact>('contacts', () => {
    listContacts()
      .then(setContacts)
      .catch(() => {})
  })
  useRealtime<Empresa>('empresas', () => {
    listEmpresas()
      .then(setEmpresas)
      .catch(() => {})
  })
  useRealtime<Order>('orders', () => {
    listOrders()
      .then(setOrders)
      .catch(() => {})
  })
  useRealtime<Referral>('referrals', () => {
    listReferrals()
      .then(setReferrals)
      .catch(() => {})
  })

  const value = useMemo(
    () => ({
      stages,
      contacts,
      empresas,
      deals,
      orders,
      referrals,
      activities,
      users,
      loading,
      refresh,
    }),
    [stages, contacts, empresas, deals, orders, referrals, activities, users, loading, refresh],
  )
  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>
}

export function useCrm() {
  const value = useContext(CrmContext)
  if (!value) throw new Error('useCrm deve ser usado dentro de CrmProvider')
  return value
}
