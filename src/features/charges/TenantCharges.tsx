import { HandCoins } from 'lucide-react';
import { Link } from 'react-router';
import { Money } from '@/components/Money';
import { QueryState } from '@/components/QueryState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dueLabel, firstOpenCharge, isOpen } from '@/lib/charges';
import { formatKobo } from '@/lib/money';
import { formatDate } from '@/lib/rent';
import { useTenantCharges } from './api';
import { ChargeBadge } from './ChargeBadge';

/** A tenant's rent periods, oldest first, with what's owed on each. */
export function TenantCharges({ tenantId }: { tenantId: string }) {
  const {
    data: charges,
    isPending,
    error,
    refetch,
  } = useTenantCharges(tenantId);
  const owed = (charges ?? [])
    .filter((c) => c.timing === 'overdue')
    .reduce((sum, c) => sum + c.balance_kobo, 0);

  const sortedCharges = charges
    ?.slice()
    .sort((a, b) => a.period_start.localeCompare(b.period_start));

  // Rent is paid in order: only the earliest unpaid period can be recorded.
  const payableId = firstOpenCharge(charges ?? [])?.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Rent
          {owed > 0 && (
            <Badge variant="danger" dot className="figure">
              {formatKobo(owed)} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isPending={isPending} error={error} refetch={refetch} />
        {charges?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No rent due yet. The next charge appears ahead of its due date (75
            days for yearly rent, 45 days otherwise).
          </p>
        )}
        <ul className="divide-y">
          {sortedCharges?.map((c) => (
            <li key={c.id} className="space-y-3 py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold">
                    {formatDate(c.period_start)} – {formatDate(c.period_end)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {c.timing === 'paid'
                      ? `Was due ${formatDate(c.due_date)}`
                      : dueLabel(c.days_until_due)}
                    {c.amount_paid_kobo > 0 &&
                      c.timing !== 'paid' &&
                      ` · ${formatKobo(c.amount_paid_kobo)} paid`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Money kobo={c.amount_kobo} className="font-semibold" />
                  <ChargeBadge charge={c} />
                </div>
              </div>
              {c.id === payableId ? (
                <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
                  <Link to={`/tenants/${tenantId}/charges/${c.id}/record`}>
                    <HandCoins /> Record payment
                  </Link>
                </Button>
              ) : (
                isOpen(c) && (
                  <p className="text-muted-foreground text-xs">
                    Can be recorded after the earlier rent.
                  </p>
                )
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
