import { Ban } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/Field'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { friendlyError } from '@/lib/errors'
import { formatKobo } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { cn } from '@/lib/utils'
import { METHOD_LABEL, useTenantPayments, useVoidPayment } from './api'

/** Every payment for a tenant, newest first. Hand-recorded ones can be voided (kept, struck through). */
export function TenantPayments({ tenantId }: { tenantId: string }) {
  const { data: payments, isPending, error, refetch } = useTenantPayments(tenantId)
  const [voidingId, setVoidingId] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isPending={isPending} error={error} refetch={refetch} />
        {payments?.length === 0 && <p className="text-muted-foreground text-sm">No payments yet.</p>}
        <ul className="divide-y">
          {payments?.map((p) => {
            const voided = p.voided_at !== null
            const canVoid = !voided && p.method !== 'link'
            return (
              <li key={p.id} className="space-y-3 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
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
                    <span className={cn('font-semibold tabular-nums', voided && 'line-through')}>
                      {formatKobo(p.amount_kobo ?? 0)}
                    </span>
                    {canVoid && voidingId !== p.id && (
                      <Button variant="ghost" size="icon" aria-label="Void payment" onClick={() => setVoidingId(p.id)}>
                        <Ban />
                      </Button>
                    )}
                  </div>
                </div>
                {canVoid && voidingId === p.id && (
                  <VoidForm paymentId={p.id!} onDone={() => setVoidingId(null)} />
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function VoidForm({ paymentId, onDone }: { paymentId: string; onDone: () => void }) {
  const voidPayment = useVoidPayment()
  const [reason, setReason] = useState('')

  return (
    <form
      className="bg-muted space-y-2 rounded-lg p-3"
      onSubmit={(e) => {
        e.preventDefault()
        voidPayment.mutate({ paymentId, reason: reason.trim() }, { onSuccess: onDone })
      }}
    >
      <label htmlFor={`void-${paymentId}`} className="text-sm font-medium">
        Why are you voiding this payment?
      </label>
      <Input
        id={`void-${paymentId}`}
        autoFocus
        placeholder="e.g. entered twice"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="bg-background h-11"
      />
      <p className="text-muted-foreground text-xs">The payment stays in the history, crossed out.</p>
      <FormError message={voidPayment.error ? friendlyError(voidPayment.error) : null} />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={!reason.trim() || voidPayment.isPending}>
          {voidPayment.isPending ? 'Voiding…' : 'Void payment'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={voidPayment.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
