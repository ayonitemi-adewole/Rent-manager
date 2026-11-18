import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { dueLabel, type TenantDue } from '@/lib/charges'
import { formatKobo } from '@/lib/money'
import { cn } from '@/lib/utils'

/** One tenant on the dashboard: who, where, how much is left, how late. Several rents add up into one row. */
export function ChargeRow({ due }: { due: TenantDue }) {
  const first = due.charges[0]
  const late = first.timing === 'overdue'
  const rents = due.charges.length
  return (
    <Link
      to={`/tenants/${first.tenant_id}`}
      className="hover:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{first.tenant_name}</p>
        <p className="text-muted-foreground truncate text-sm">
          {first.unit_label} · {first.property_name}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{formatKobo(due.totalKobo)}</p>
        <p className={cn('text-xs', late ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {dueLabel(first.days_until_due)}
          {rents > 1 && ` · ${rents} rents`}
        </p>
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  )
}
