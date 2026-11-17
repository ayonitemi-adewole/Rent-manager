import { Ban } from 'lucide-react'
import { FormError } from '@/components/Field'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { friendlyError } from '@/lib/errors'
import { formatKobo } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { cn } from '@/lib/utils'
import { METHOD_LABEL, useTenantPayments, useVoidPayment } from './api'

/** Every payment for a tenant, newest first. Hand-recorded ones can be voided (kept, struck through). */
export function TenantPayments({ tenantId }: { tenantId: string }) {
  const { data: payments, isPending, error, refetch } = useTenantPayments(tenantId)
  const voidPayment = useVoidPayment()

  function onVoid(paymentId: string, amount: string) {
    const reason = prompt(`Void this ${amount} payment? Say why (e.g. "entered twice"):`)
    if (reason === null) return
    if (!reason.trim()) return alert('A reason is needed to void a payment.')
    voidPayment.mutate({ paymentId, reason })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isPending={isPending} error={error} refetch={refetch} />
        {payments?.length === 0 && <p className="text-muted-foreground text-sm">No payments yet.</p>}
        <FormError message={voidPayment.error ? friendlyError(voidPayment.error) : null} />
        <ul className="divide-y">
          {payments?.map((p) => {
            const voided = p.voided_at !== null
            const amount = formatKobo(p.amount_kobo ?? 0)
            return (
              <li key={p.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className={cn('min-w-0', voided && 'text-muted-foreground')}>
                  <p className="font-medium">
                    {p.paid_at && formatDate(p.paid_at.slice(0, 10))}
                    <Badge variant="outline" className="ml-2 align-middle">
                      {METHOD_LABEL[p.method ?? ''] ?? p.method}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    For {p.period_start && formatDate(p.period_start)} – {p.period_end && formatDate(p.period_end)}
                  </p>
                  {p.note && <p className="text-muted-foreground text-xs">“{p.note}”</p>}
                  {voided && <p className="text-destructive text-xs">Voided: {p.void_reason}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={cn('font-semibold tabular-nums', voided && 'line-through')}>{amount}</span>
                  {!voided && p.method !== 'link' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Void payment"
                      disabled={voidPayment.isPending}
                      onClick={() => onVoid(p.id!, amount)}
                    >
                      <Ban />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
