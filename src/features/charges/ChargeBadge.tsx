import { Badge } from '@/components/ui/badge'
import { TIMING_LABEL, type Charge } from '@/lib/charges'
import { cn } from '@/lib/utils'

const TONE: Record<Charge['timing'], string> = {
  overdue: 'border-destructive/30 bg-destructive/10 text-destructive',
  due_soon: 'border-warning/40 bg-warning/15 text-foreground',
  upcoming: 'text-muted-foreground',
  paid: 'border-success/30 bg-success/10 text-success',
  cancelled: 'text-muted-foreground line-through',
}

export function ChargeBadge({ charge }: { charge: Pick<Charge, 'timing' | 'status'> }) {
  const label = charge.status === 'partially_paid' && charge.timing !== 'paid' ? 'Part paid' : TIMING_LABEL[charge.timing]
  return (
    <Badge variant="outline" className={cn('shrink-0', TONE[charge.timing])}>
      {label}
    </Badge>
  )
}
