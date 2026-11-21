import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Props = {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  back?: { to: string; label: string }
  /** Small line above the title, e.g. today's date. */
  eyebrow?: ReactNode
}

export function PageHeader({ title, subtitle, action, back, eyebrow }: Props) {
  return (
    <div className="mb-5 space-y-3 lg:mb-8">
      {back && (
        <Link
          to={back.to}
          className="text-muted-foreground hover:text-foreground hover:bg-card -ml-2 inline-flex items-center gap-0.5 rounded-full py-1 pr-3 pl-1.5 text-sm font-medium transition-colors"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="text-muted-foreground mb-0.5 text-xs font-semibold lg:text-sm">{eyebrow}</p>}
          <h1 className="truncate text-2xl leading-tight font-bold lg:text-3xl">{title}</h1>
          {subtitle && <div className="text-muted-foreground mt-0.5 text-sm lg:mt-1 lg:text-base">{subtitle}</div>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}
