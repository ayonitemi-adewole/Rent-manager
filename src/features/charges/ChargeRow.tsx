import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Money } from '@/components/Money'
import { dueLabel, type TenantDue } from '@/lib/charges'
import { cn } from '@/lib/utils'

/** One tenant on the dashboard: who, where, how much is left, how late. Several rents add up into one row. */
export function ChargeRow({ due }: { due: TenantDue }) {
  const first = due.charges[0]
  const late = first.timing === 'overdue'
  const rents = due.charges.length
  return (
    <Link
      to={`/tenants/${first.tenant_id}`}
      className="group hover:bg-accent/60 flex items-center gap-3 px-4 py-3.5 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{first.tenant_name}</p>
        <p className="text-muted-foreground truncate text-sm">
          {first.unit_label} · {first.property_name}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <Money kobo={due.totalKobo} className="font-semibold" />
        <p className={cn('text-xs font-semibold', late ? 'text-destructive' : 'text-warning-foreground')}>
          {dueLabel(first.days_until_due)}
          {rents > 1 && ` · ${rents} rents`}
        </p>
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
