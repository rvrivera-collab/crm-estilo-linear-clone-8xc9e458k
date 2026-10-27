import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getTourForPath } from '@/data/tours'
import type { PageTourDefinition, TourStep } from '@/types/tour'

interface TourContextValue {
  isOpen: boolean
  tourDisabled: boolean
  currentTour: PageTourDefinition | null
  currentStepIndex: number
  totalSteps: number
  currentStep: TourStep | null
  nextStep: () => void
  prevStep: () => void
  closeTour: () => void
  startTourForCurrentPage: (force?: boolean) => void
  hasSeenTourForPage: (pagePath: string) => boolean
  markTourSeenForPage: (pagePath: string) => void
  resetAllTours: () => void
  setTourDisabled: (disabled: boolean) => Promise<void>
}

const TourContext = createContext<TourContextValue | null>(null)

function getStorageKey(userId: string | undefined): string {
  return `crm_tour_seen_${userId || 'anonymous'}`
}

function getTourDisabledStorageKey(userId: string | undefined): string {
  return `crm_tour_disabled_${userId || 'anonymous'}`
}

export function TourProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentTour, setCurrentTour] = useState<PageTourDefinition | null>(null)

  // Estado de desativação do tour
  const [tourDisabled, setTourDisabledState] = useState<boolean>(() => {
    try {
      const local = localStorage.getItem(getTourDisabledStorageKey(user?.id))
      if (local !== null) {
        return local === 'true'
      }
      return Boolean(user?.tour_disabled)
    } catch {
      return Boolean(user?.tour_disabled)
    }
  })

  // Cache em memória dos tours já visualizados pelo usuário logado
  const [seenPages, setSeenPages] = useState<Set<string>>(() => {
    try {
      const local = localStorage.getItem(getStorageKey(user?.id))
      const fromLocal = local ? (JSON.parse(local) as string[]) : []
      const fromUser = (user?.tour_seen_pages as string[]) || []
      return new Set([...fromLocal, ...fromUser])
    } catch {
      return new Set()
    }
  })

  // Sincronizar quando o usuário mudar ou carregar do PocketBase
  useEffect(() => {
    try {
      const local = localStorage.getItem(getStorageKey(user?.id))
      const fromLocal = local ? (JSON.parse(local) as string[]) : []
      const fromUser = (user?.tour_seen_pages as string[]) || []
      setSeenPages(new Set([...fromLocal, ...fromUser]))
    } catch {
      setSeenPages(new Set())
    }

    try {
      const localDisabled = localStorage.getItem(getTourDisabledStorageKey(user?.id))
      if (localDisabled !== null) {
        setTourDisabledState(localDisabled === 'true')
      } else if (user?.tour_disabled !== undefined) {
        setTourDisabledState(Boolean(user.tour_disabled))
      }
    } catch {
      if (user?.tour_disabled !== undefined) {
        setTourDisabledState(Boolean(user.tour_disabled))
      }
    }
  }, [user?.id, user?.tour_seen_pages, user?.tour_disabled])

  const setTourDisabled = useCallback(
    async (disabled: boolean) => {
      setTourDisabledState(disabled)
      if (disabled) {
        // Se estava aberto, fechar imediatamente
        setIsOpen(false)
      }
      try {
        localStorage.setItem(getTourDisabledStorageKey(user?.id), String(disabled))
      } catch {
        /* intentionally ignored */
      }

      if (user?.id) {
        const mod = await import('@/lib/pocketbase/client')
        const pb = mod.default
        await pb.collection('users').update(user.id, { tour_disabled: disabled })
      }
    },
    [user?.id],
  )

  const hasSeenTourForPage = useCallback(
    (pagePath: string): boolean => {
      const norm = pagePath.replace(/\/+$/, '') || '/ask'
      return seenPages.has(norm)
    },
    [seenPages],
  )

  const markTourSeenForPage = useCallback(
    (pagePath: string) => {
      const norm = pagePath.replace(/\/+$/, '') || '/ask'
      setSeenPages((prev) => {
        const next = new Set(prev)
        next.add(norm)
        const arr = Array.from(next)
        try {
          localStorage.setItem(getStorageKey(user?.id), JSON.stringify(arr))
        } catch {
          /* intentionally ignored */
        }

        // Se o usuário estiver logado, persistir também de forma assíncrona no perfil do PocketBase
        if (user?.id) {
          import('@/lib/pocketbase/client').then((mod) => {
            const pb = mod.default
            pb.collection('users')
              .update(user.id, { tour_seen_pages: arr })
              .catch(() => {
                // Silently fallback to localStorage if network or rule fails
              })
          })
        }

        return next
      })
    },
    [user?.id],
  )
  const resetAllTours = useCallback(() => {
    setSeenPages(new Set())
    try {
      localStorage.removeItem(getStorageKey(user?.id))
    } catch {
      /* intentionally ignored */
    }
  }, [user?.id])

  const closeTour = useCallback(() => {
    if (currentTour) {
      markTourSeenForPage(currentTour.pagePath)
    }
    setIsOpen(false)
    setCurrentStepIndex(0)
  }, [currentTour, markTourSeenForPage])

  const startTourForCurrentPage = useCallback(
    (force = false) => {
      const tour = getTourForPath(location.pathname)
      if (!tour || tour.steps.length === 0) return

      // Se não for forçado (auto-start), não abrir se estiver desativado ou já visto
      if (!force) {
        if (tourDisabled) return
        if (hasSeenTourForPage(tour.pagePath)) return
      }

      setCurrentTour(tour)
      setCurrentStepIndex(0)
      setIsOpen(true)
    },
    [location.pathname, hasSeenTourForPage, tourDisabled],
  )

  // Auto-disparo no primeiro acesso de cada página
  useEffect(() => {
    // Se o tour estiver desabilitado pelo usuário, abortar qualquer auto-disparo
    if (tourDisabled) {
      setIsOpen(false)
      return
    }

    // Não disparar em rotas públicas ou login/signup
    const publicPaths = [
      '/login',
      '/signup',
      '/captura',
      '/form',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
      '/confirm-email-change',
    ]
    const isPublic = publicPaths.some((p) => location.pathname.startsWith(p))
    if (isPublic) {
      setIsOpen(false)
      return
    }

    // Normalizar a rota
    const tour = getTourForPath(location.pathname)
    if (!tour) return

    // Se o usuário ainda não viu o tour desta página, disparar automaticamente após um pequeno delay para a DOM montar
    if (!hasSeenTourForPage(tour.pagePath)) {
      const timer = window.setTimeout(() => {
        // Checar novamente para evitar race condition
        if (!tourDisabled) {
          setCurrentTour(tour)
          setCurrentStepIndex(0)
          setIsOpen(true)
        }
      }, 700)
      return () => window.clearTimeout(timer)
    } else {
      // Se trocou de página e o tour estava aberto para a página anterior, fechar
      setIsOpen(false)
    }
  }, [location.pathname, hasSeenTourForPage, tourDisabled])

  const currentStep = useMemo(() => {
    if (!currentTour || !currentTour.steps[currentStepIndex]) return null
    return currentTour.steps[currentStepIndex]
  }, [currentTour, currentStepIndex])

  const totalSteps = currentTour?.steps.length || 0

  const nextStep = useCallback(() => {
    if (currentStepIndex + 1 < totalSteps) {
      setCurrentStepIndex((prev) => prev + 1)
    } else {
      closeTour()
    }
  }, [currentStepIndex, totalSteps, closeTour])

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }, [currentStepIndex])

  const value = useMemo(
    () => ({
      isOpen,
      tourDisabled,
      currentTour,
      currentStepIndex,
      totalSteps,
      currentStep,
      nextStep,
      prevStep,
      closeTour,
      startTourForCurrentPage,
      hasSeenTourForPage,
      markTourSeenForPage,
      resetAllTours,
      setTourDisabled,
    }),
    [
      isOpen,
      tourDisabled,
      currentTour,
      currentStepIndex,
      totalSteps,
      currentStep,
      nextStep,
      prevStep,
      closeTour,
      startTourForCurrentPage,
      hasSeenTourForPage,
      markTourSeenForPage,
      resetAllTours,
      setTourDisabled,
    ],
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour deve ser usado dentro de um TourProvider')
  }
  return context
}
