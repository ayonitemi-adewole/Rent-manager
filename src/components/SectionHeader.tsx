import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  title: ReactNode
  /** How many items, in a small chip next to the title. */
  count?: number
  /** Colour of a status dot before the title, e.g. "bg-destructive". */
  dot?: string
  action?: ReactNode
  id?: string
  className?: string
}

/** The heading over a list or group of cards. */
export function SectionHeader({ title, count, dot, action, id, className }: Props) {
  return (
    <div className={cn('flex min-h-8 items-center justify-between gap-3', className)}>
      <h2 id={id} className="flex items-center gap-2 font-bold">
        {dot && <span aria-hidden="true" className={cn('size-2 rounded-full', dot)} />}
        {title}
        {count !== undefined && (
          <span className="bg-muted text-muted-foreground figure rounded-full px-2 py-0.5 text-xs font-medium">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  )
}
