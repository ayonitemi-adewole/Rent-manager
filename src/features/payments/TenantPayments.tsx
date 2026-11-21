import { Ban, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/Field'
import { Money } from '@/components/Money'
import { QueryState } from '@/components/QueryState'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { friendlyError } from '@/lib/errors'
import { feeBreakdown } from '@/lib/fees'
import { formatKobo, formatKoboExact } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { whatsappLink } from '@/lib/reminders'
import { cn } from '@/lib/utils'
import { METHOD_LABEL, useTenantPayments, useVoidPayment } from './api'
import { SendReceiptPdf } from './SendReceiptPdf'

const linkClass = 'text-primary inline-flex items-center gap-1 font-semibold hover:underline'

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
            const fees = voided ? null : feeBreakdown(p)
            return (
              <li key={p.id} className="space-y-3 py-3.5 text-sm first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('min-w-0 space-y-1', voided && 'text-muted-foreground')}>
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {p.paid_at && formatDate(p.paid_at.slice(0, 10))}
                      <Badge variant="muted">{METHOD_LABEL[p.method ?? ''] ?? p.method}</Badge>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      For {p.period_start && formatDate(p.period_start)} – {p.period_end && formatDate(p.period_end)}
                    </p>
                    {fees && (
                      <p className="text-muted-foreground figure text-xs">
                        {fees.gateway} fee {formatKoboExact(fees.gatewayFeeKobo)} · RentPadi fee{' '}
                        {formatKoboExact(fees.platformFeeKobo)} ·{' '}
                        <span className="text-foreground font-medium">{formatKoboExact(fees.toBankKobo)} to your bank</span>
                      </p>
                    )}
                    {p.note && <p className="text-muted-foreground text-xs">“{p.note}”</p>}
                    {voided && <p className="text-destructive text-xs">Voided: {p.void_reason}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Money
                      kobo={p.amount_kobo ?? 0}
                      className={cn('font-semibold', voided ? 'text-muted-foreground line-through' : 'text-success')}
                    />
                    {canVoid && voidingId !== p.id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground -mr-1.5"
                        aria-label="Void payment"
                        onClick={() => setVoidingId(p.id)}
                      >
                        <Ban />
                      </Button>
                    )}
                  </div>
                </div>
                {p.receipt_token && (
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                    <a href={`/r/${p.receipt_token}`} target="_blank" rel="noreferrer" className={linkClass}>
                      <ReceiptText className="size-3.5" /> Receipt <span className="figure">{p.receipt_number}</span>
                    </a>
                    {!voided && p.tenant_whatsapp && (
                      <a
                        href={whatsappLink(
                          p.tenant_whatsapp,
                          `Receipt ${p.receipt_number} for ${formatKobo(p.amount_kobo ?? 0)}: ${window.location.origin}/r/${p.receipt_token}`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className={linkClass}
                      >
                        <WhatsAppIcon className="size-3.5" /> Send link
                      </a>
                    )}
                    <SendReceiptPdf token={p.receipt_token} />
                  </p>
                )}
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
      className="border-destructive/20 bg-destructive/5 space-y-2.5 rounded-lg border p-3.5 motion-safe:animate-enter"
      onSubmit={(e) => {
        e.preventDefault()
        voidPayment.mutate({ paymentId, reason: reason.trim() }, { onSuccess: onDone })
      }}
    >
      <label htmlFor={`void-${paymentId}`} className="text-sm font-semibold">
        Why are you voiding this payment?
      </label>
      <Input
        id={`void-${paymentId}`}
        autoFocus
        placeholder="e.g. entered twice"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
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
