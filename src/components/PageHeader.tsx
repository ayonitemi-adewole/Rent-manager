import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Props = {
  title: string
  subtitle?: string
  action?: ReactNode
  back?: { to: string; label: string }
}

export function PageHeader({ title, subtitle, action, back }: Props) {
  return (
    <div className="mb-4 space-y-2">
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
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
