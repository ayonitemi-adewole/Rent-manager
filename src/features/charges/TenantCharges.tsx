import { Link } from 'react-router'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { dueLabel } from '@/lib/charges'
import { formatKobo } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { useTenantCharges } from './api'
import { ChargeBadge } from './ChargeBadge'

/** A tenant's rent periods, newest first, with what's owed on each. */
export function TenantCharges({ tenantId }: { tenantId: string }) {
  const { data: charges, isPending, error, refetch } = useTenantCharges(tenantId)
  const owed = (charges ?? [])
    .filter((c) => c.timing === 'overdue')
    .reduce((sum, c) => sum + c.balance_kobo, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Rent
          {owed > 0 && (
            <span className="text-destructive text-sm font-semibold tabular-nums">{formatKobo(owed)} overdue</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isPending={isPending} error={error} refetch={refetch} />
        {charges?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No rent due yet. The next charge appears 45 days before it falls due.
          </p>
        )}
        <ul className="divide-y">
          {charges?.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {formatDate(c.period_start)} – {formatDate(c.period_end)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {c.timing === 'paid' ? `Was due ${formatDate(c.due_date)}` : dueLabel(c.days_until_due)}
                  {c.amount_paid_kobo > 0 && c.timing !== 'paid' && ` · ${formatKobo(c.amount_paid_kobo)} paid`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-semibold tabular-nums">{formatKobo(c.amount_kobo)}</span>
                <ChargeBadge charge={c} />
                {c.balance_kobo > 0 && c.status !== 'cancelled' && (
                  <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                    <Link to={`/tenants/${tenantId}/charges/${c.id}/record`}>Record payment</Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
