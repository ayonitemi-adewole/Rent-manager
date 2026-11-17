import { Lock } from 'lucide-react'
import { useParams } from 'react-router'
import { Logo } from '@/components/Logo'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChargeBadge } from '@/features/charges/ChargeBadge'
import { dueLabel, isOpen } from '@/lib/charges'
import { friendlyError } from '@/lib/errors'
import { formatKobo } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { usePortal, useStartCheckout, type PortalCharge } from './api'

// No-login tenant page (basic version; Phase 5 adds receipts and history).
export function TenantPortalPage() {
  const { token = '' } = useParams()
  const { data: portal, isPending, error, refetch } = usePortal(token)
  const checkout = useStartCheckout(token)

  // One payment at a time, oldest first, so a tenant can't pay next period before this one.
  const open = (portal?.charges ?? []).filter(isOpen).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const current = open[0]
  const next = open[1]

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <Logo />
      <QueryState isPending={isPending} error={error} refetch={refetch} />
      {portal === null && (
        <p className="text-sm">This link is not valid. Please ask your landlord for your current RentPadi link.</p>
      )}

      {portal && (
        <>
          <div>
            <h1 className="text-xl font-bold">Hello {portal.tenant_name.split(' ')[0]},</h1>
            <p className="text-muted-foreground text-sm">
              Rent for {portal.unit_label}, {portal.property_name} · Landlord: {portal.landlord_name}
            </p>
          </div>

          {!current ? (
            <Card>
              <CardContent className="text-sm">You’re all paid up. Thank you!</CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              <ChargeCard
                charge={current}
                canPay={portal.can_pay_online}
                paying={checkout.isPending}
                disabled={checkout.isPending}
                onPay={() => checkout.mutate(current.id)}
              />
            </ul>
          )}

          {next && (
            <p className="text-muted-foreground text-sm">
              Next: {formatKobo(next.balance_kobo)} due {formatDate(next.due_date)}
              {open.length > 2 && ` (and ${open.length - 2} more after that)`}. You can pay it once this one is
              paid.
            </p>
          )}

          {checkout.error && (
            <p role="alert" className="text-destructive text-sm">
              {friendlyError(checkout.error)}
            </p>
          )}

          {portal.can_pay_online ? (
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              Payments are processed securely by Flutterwave and go directly to {portal.landlord_name}’s{' '}
              {portal.payout_bank} account ending {portal.payout_account_last4}.
            </p>
          ) : (
            open.length > 0 && (
              <p className="text-muted-foreground text-sm">
                Online payment isn’t available yet. Please pay your landlord directly.
              </p>
            )
          )}
        </>
      )}
    </main>
  )
}

type CardProps = { charge: PortalCharge; canPay: boolean; paying: boolean; disabled: boolean; onPay: () => void }

function ChargeCard({ charge: c, canPay, paying, disabled, onPay }: CardProps) {
  return (
    <li>
      <Card className="gap-3">
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatKobo(c.balance_kobo)}</p>
              <p className="text-muted-foreground text-sm">
                {formatDate(c.period_start)} – {formatDate(c.period_end)}
              </p>
              <p className="text-sm">{dueLabel(c.days_until_due)}</p>
              {c.amount_paid_kobo > 0 && (
                <p className="text-muted-foreground text-xs">
                  {formatKobo(c.amount_paid_kobo)} of {formatKobo(c.amount_kobo)} already paid
                </p>
              )}
            </div>
            <ChargeBadge charge={c} />
          </div>
          {canPay && (
            <Button className="h-12 w-full text-base" onClick={onPay} disabled={disabled}>
              {paying ? 'Opening secure payment…' : `Pay ${formatKobo(c.balance_kobo)}`}
            </Button>
          )}
        </CardContent>
      </Card>
    </li>
  )
}
