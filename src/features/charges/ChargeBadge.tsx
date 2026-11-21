import { Badge } from '@/components/ui/badge'
import { TIMING_LABEL, type Charge } from '@/lib/charges'
import { cn } from '@/lib/utils'

const VARIANT = {
  overdue: 'danger',
  due_soon: 'warning',
  upcoming: 'muted',
  paid: 'success',
  cancelled: 'muted',
} as const satisfies Record<Charge['timing'], string>

export function ChargeBadge({ charge, className }: { charge: Pick<Charge, 'timing' | 'status'>; className?: string }) {
  const label = charge.status === 'partially_paid' && charge.timing !== 'paid' ? 'Part paid' : TIMING_LABEL[charge.timing]
  return (
    <Badge
      variant={VARIANT[charge.timing]}
      dot={charge.timing !== 'cancelled'}
      className={cn('shrink-0', charge.timing === 'cancelled' && 'line-through', className)}
    >
      {label}
    </Badge>
  )
}
