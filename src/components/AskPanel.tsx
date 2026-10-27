import { AskChat } from '@/components/AskChat'
import { useAsk } from '@/contexts/AskContext'

export function AskPanel() {
  const { open, setOpen } = useAsk()
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-3 backdrop-blur-[2px] sm:p-7"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <div className="w-full max-w-[960px] animate-panel-rise">
        <AskChat mode="panel" onClose={() => setOpen(false)} />
      </div>
    </div>
  )
}
