import { useEffect, useLayoutEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react'
import { useTour } from '@/contexts/TourContext'
import { cn } from '@/lib/utils'

interface Rect {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

interface PopoverPos {
  top: number
  left: number
  maxWidth: number
  arrowPlacement: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

export function TourOverlay() {
  const {
    isOpen,
    currentTour,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    closeTour,
  } = useTour()

  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null)
  const [isCentered, setIsCentered] = useState(false)

  // Atualizar cálculo de posição do spotlight e do balão
  useEffect(() => {
    if (!isOpen || !currentStep) {
      setTargetRect(null)
      setPopoverPos(null)
      return
    }

    let isSubscribed = true

    function computePosition() {
      if (!isSubscribed) return
      const selector = currentStep?.target
      const element = selector ? (document.querySelector(selector) as HTMLElement | null) : null

      if (!element) {
        // Elemento não encontrado: modo centralizado
        setIsCentered(true)
        setTargetRect(null)
        setPopoverPos({
          top: Math.max(20, window.innerHeight / 2 - 140),
          left: Math.max(16, window.innerWidth / 2 - 190),
          maxWidth: Math.min(380, window.innerWidth - 32),
          arrowPlacement: 'center',
        })
        return
      }

      // Garantir que o elemento esteja visível na viewport (scroll suave)
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      })

      const rawRect = element.getBoundingClientRect()
      // Adicionar padding ao redor do elemento para respirar (spotlight padding)
      const padding = 8
      const top = Math.max(0, rawRect.top - padding)
      const left = Math.max(0, rawRect.left - padding)
      const width = rawRect.width + padding * 2
      const height = rawRect.height + padding * 2

      const rect: Rect = {
        top,
        left,
        width,
        height,
        bottom: top + height,
        right: left + width,
      }

      setTargetRect(rect)
      setIsCentered(false)

      // Calcular posição do balão popover
      const popoverWidth = Math.min(360, window.innerWidth - 32)
      const estimatedHeight = 220
      const gap = 14

      const placement = currentStep?.placement || 'bottom'
      let finalTop = 0
      let finalLeft = 0
      let finalPlacement: PopoverPos['arrowPlacement'] = placement

      // Lógica de fallback para não vazar a viewport
      if (placement === 'bottom') {
        finalTop = rect.bottom + gap
        finalLeft = rect.left + rect.width / 2 - popoverWidth / 2
        // Se vazar embaixo, joga pra cima
        if (finalTop + estimatedHeight > window.innerHeight - 16) {
          finalTop = rect.top - estimatedHeight - gap
          finalPlacement = 'top'
        }
      } else if (placement === 'top') {
        finalTop = rect.top - estimatedHeight - gap
        finalLeft = rect.left + rect.width / 2 - popoverWidth / 2
        // Se vazar em cima, joga pra baixo
        if (finalTop < 16) {
          finalTop = rect.bottom + gap
          finalPlacement = 'bottom'
        }
      } else if (placement === 'right') {
        finalLeft = rect.right + gap
        finalTop = rect.top + rect.height / 2 - estimatedHeight / 2
        // Se vazar na direita, joga pra esquerda ou baixo
        if (finalLeft + popoverWidth > window.innerWidth - 16) {
          if (rect.left - popoverWidth - gap > 16) {
            finalLeft = rect.left - popoverWidth - gap
            finalPlacement = 'left'
          } else {
            finalTop = rect.bottom + gap
            finalLeft = rect.left
            finalPlacement = 'bottom'
          }
        }
      } else if (placement === 'left') {
        finalLeft = rect.left - popoverWidth - gap
        finalTop = rect.top + rect.height / 2 - estimatedHeight / 2
        // Se vazar na esquerda, joga pra direita ou baixo
        if (finalLeft < 16) {
          if (rect.right + popoverWidth + gap < window.innerWidth - 16) {
            finalLeft = rect.right + gap
            finalPlacement = 'right'
          } else {
            finalTop = rect.bottom + gap
            finalLeft = rect.left
            finalPlacement = 'bottom'
          }
        }
      } else {
        // center
        finalTop = Math.max(20, window.innerHeight / 2 - estimatedHeight / 2)
        finalLeft = Math.max(16, window.innerWidth / 2 - popoverWidth / 2)
        finalPlacement = 'center'
      }

      // Clamping horizontal e vertical para garantir visibilidade total
      finalLeft = Math.max(16, Math.min(finalLeft, window.innerWidth - popoverWidth - 16))
      finalTop = Math.max(16, Math.min(finalTop, window.innerHeight - estimatedHeight - 16))

      setPopoverPos({
        top: finalTop,
        left: finalLeft,
        maxWidth: popoverWidth,
        arrowPlacement: finalPlacement,
      })
    }

    // Executar imediatamente e após um pequeno atraso para lidar com animações/scroll
    computePosition()
    const t1 = setTimeout(computePosition, 100)
    const t2 = setTimeout(computePosition, 300)

    window.addEventListener('resize', computePosition)
    window.addEventListener('scroll', computePosition, true)

    return () => {
      isSubscribed = false
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', computePosition)
      window.removeEventListener('scroll', computePosition, true)
    }
  }, [isOpen, currentStep])

  // Atalhos de teclado (Esc para fechar, setas para navegar)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeTour()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        nextStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevStep()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeTour, nextStep, prevStep])

  if (!isOpen || !currentStep || !currentTour) return null

  const isLastStep = currentStepIndex + 1 === totalSteps

  return (
    <div
      className="fixed inset-0 z-[100] select-none pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
    >
      {/* SVG Spotlight Backdrop com recorte via clipPath mask */}
      <svg className="fixed inset-0 h-full w-full pointer-events-none transition-all duration-300 ease-out">
        <defs>
          <mask id="tour-spotlight-mask">
            {/* Fundo branco = visível (máscara escurecida) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Recorte preto = transparente (área destacada) */}
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="8"
                ry="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.65)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Borda pulsante e anel de destaque ao redor do elemento alvo */}
      {targetRect && (
        <div
          className="fixed pointer-events-none rounded-lg border-2 border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.25)] transition-all duration-300 ease-out"
          style={{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
        >
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
          </span>
        </div>
      )}

      {/* Balão explicativo estilo Linear (White, clean, soft shadow, subtle borders) */}
      {popoverPos && (
        <div
          className={cn(
            'fixed z-[101] rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out animate-in fade-in zoom-in-95',
            isCentered && 'shadow-[0_25px_60px_rgba(0,0,0,0.28)]',
          )}
          style={{
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            width: `${popoverPos.maxWidth}px`,
          }}
        >
          {/* Top Bar do Balão */}
          <div className="flex items-center justify-between gap-2 border-b border-[#f1f5f9] pb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="grid size-5 place-items-center rounded bg-amber-500/10 text-amber-700">
                <Sparkles className="size-3 text-amber-600" />
              </span>
              <span className="text-[11px] font-bold text-[#1c1c1e] truncate">
                Tour: {currentTour.pageName}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[10px] font-semibold text-[#64748b]">
                {currentStepIndex + 1} de {totalSteps}
              </span>
              <button
                type="button"
                onClick={closeTour}
                className="rounded p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#1c1c1e] transition"
                title="Sair do tour (Esc)"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Conteúdo do Passo */}
          <div className="pt-3">
            {currentStep.badge && (
              <span className="inline-block mb-1.5 rounded border border-amber-500/30 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">
                {currentStep.badge}
              </span>
            )}
            <h3
              id="tour-step-title"
              className="text-[13px] sm:text-[14px] font-bold tracking-tight text-[#1c1c1e] leading-snug"
            >
              {currentStep.title}
            </h3>
            <p className="mt-1.5 text-[11px] sm:text-[12px] leading-relaxed text-[#475569]">
              {currentStep.description}
            </p>
          </div>

          {/* Barra de Progresso visual discreta */}
          <div className="mt-4 flex gap-1">
            {currentTour.steps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300',
                  idx <= currentStepIndex ? 'bg-amber-500' : 'bg-[#e2e8f0]',
                )}
              />
            ))}
          </div>

          {/* Rodapé de Ações */}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#f1f5f9] pt-3">
            <button
              type="button"
              onClick={closeTour}
              className="text-[11px] font-medium text-[#64748b] hover:text-[#1c1c1e] transition hover:underline"
            >
              Sair do tour
            </button>

            <div className="flex items-center gap-1.5">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e2e8f0] bg-white px-2.5 text-[11px] font-medium text-[#475569] hover:bg-[#f8fafc] hover:text-[#1c1c1e] transition shadow-2xs"
                >
                  <ArrowLeft className="size-3" />
                  <span>Voltar</span>
                </button>
              )}

              <button
                type="button"
                onClick={nextStep}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-amber-500 px-3 text-[11px] font-bold text-white shadow-xs hover:bg-amber-600 transition"
              >
                <span>{isLastStep ? 'Concluir tour' : 'Avançar'}</span>
                {!isLastStep && <ArrowRight className="size-3" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
