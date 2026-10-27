import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'
import { initials, type UserRecord } from '@/types/crm'

export function UserAvatar({ user, className }: { user?: UserRecord | null; className?: string }) {
  const src = user?.avatar ? pb.files.getURL(user, user.avatar, { thumb: '64x64' }) : ''
  return src ? (
    <img
      src={src}
      alt={user?.name || 'Usuário'}
      className={cn('size-6 rounded-full border border-[#e2e8f0] object-cover', className)}
    />
  ) : (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border border-[#e2e8f0] bg-[#f1f5f9] text-[9px] font-bold text-[#475569]',
        className,
      )}
    >
      {initials(user?.name || user?.email || '')}
    </span>
  )
}
