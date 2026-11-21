import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const TONES = {
  brand: 'border-primary/15 bg-secondary text-secondary-foreground [&_[data-icon]]:text-primary',
  info: 'border-border bg-muted/70 text-foreground [&_[data-icon]]:text-muted-foreground',
  success: 'border-success/25 bg-success/10 text-foreground [&_[data-icon]]:text-success',
  warning: 'border-warning/45 bg-warning/12 text-foreground [&_[data-icon]]:text-warning-foreground',
} as const

type Props = {
  tone?: keyof typeof TONES
  icon?: LucideIcon
  title?: ReactNode
  children?: ReactNode
  /** A button or link; sits on the right on wider screens, under the text on phones. */
  action?: ReactNode
  role?: 'status' | 'alert' | 'note'
  className?: string
}

/** A short note in a tinted box: something to know, or one thing to do next. */
export function Callout({ tone = 'brand', icon: Icon, title, children, action, role, className }: Props) {
  return (
    <div role={role} className={cn('flex items-start gap-3 rounded-lg border p-3.5 text-sm', TONES[tone], className)}>
      {Icon && <Icon data-icon className="mt-px size-5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && 'opacity-85')}>{children}</div>}
        </div>
        {action && <div className="mt-3 shrink-0 sm:mt-0">{action}</div>}
      </div>
    </div>
  )
}
