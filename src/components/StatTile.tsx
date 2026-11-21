import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const TONES = {
  default: 'bg-muted text-muted-foreground',
  brand: 'bg-secondary text-primary',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-warning-foreground',
  success: 'bg-success/10 text-success',
} as const

type Props = {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  /** Colours the icon; use "default" when there's nothing to worry about. */
  tone?: keyof typeof TONES
  className?: string
}

/** One number with its label, e.g. "Overdue · ₦450,000 · 3 tenants". */
export function StatTile({ label, value, hint, icon: Icon, tone = 'default', className }: Props) {
  return (
    <div className={cn('bg-card shadow-card flex flex-col gap-2 rounded-xl border border-border/80 p-4 lg:p-5', className)}>
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold lg:text-sm">
        {Icon && (
          <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', TONES[tone])}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
        {label}
      </div>
      <div className="text-lg leading-tight font-bold sm:text-xl lg:text-2xl">{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  )
}
