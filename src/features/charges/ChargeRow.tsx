import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { dueLabel, type Charge } from '@/lib/charges'
import { formatKobo } from '@/lib/money'
import { cn } from '@/lib/utils'

/** One open charge on the dashboard: who, where, how much is left, how late. */
export function ChargeRow({ charge }: { charge: Charge }) {
  const late = charge.timing === 'overdue'
  return (
    <Link
      to={`/tenants/${charge.tenant_id}`}
      className="hover:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{charge.tenant_name}</p>
        <p className="text-muted-foreground truncate text-sm">
          {charge.unit_label} · {charge.property_name}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{formatKobo(charge.balance_kobo)}</p>
        <p className={cn('text-xs', late ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {dueLabel(charge.days_until_due)}
        </p>
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  )
}
