import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Props = {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  back?: { to: string; label: string }
}

export function PageHeader({ title, subtitle, action, back }: Props) {
  return (
    <div className="mb-4 space-y-2 lg:mb-8">
      {back && (
        <Link
          to={back.to}
          className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-0.5 text-sm"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm lg:mt-1 lg:text-base">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}
