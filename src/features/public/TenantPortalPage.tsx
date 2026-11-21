import { CheckCircle2, ChevronRight, Link2Off, Lock, ReceiptText } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Callout } from '@/components/Callout'
import { FormError } from '@/components/Field'
import { Logo, LogoMark } from '@/components/Logo'
import { Money } from '@/components/Money'
import { QueryState } from '@/components/QueryState'
import { SectionHeader } from '@/components/SectionHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { dueLabel, isOpen, TIMING_LABEL } from '@/lib/charges'
import { friendlyError } from '@/lib/errors'
import { formatKobo } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { env } from '@/lib/env'
import { whatsappLink } from '@/lib/reminders'
import { cn } from '@/lib/utils'
import { usePortal, useStartCheckout, type PortalCharge } from './api'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'

// No-login tenant page: what's owed now (one period at a time), pay online, past receipts.
export function TenantPortalPage() {
  const { token = '' } = useParams()
  const { data: portal, isPending, error, refetch } = usePortal(token)
  const checkout = useStartCheckout(token)

  // One payment at a time, oldest first, so a tenant can't pay next period before this one.
  const open = (portal?.charges ?? []).filter(isOpen).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const current = open[0]
  const next = open[1]

  return (
    <main className="motion-safe:animate-enter mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Logo size="sm" />
        <span className="bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold">
          <Lock className="size-3" aria-hidden="true" /> Secure rent page
        </span>
      </header>
      <QueryState isPending={isPending} error={error} refetch={refetch} />
      {portal === null && (
        <Callout tone="info" icon={Link2Off} title="This link is not valid">
          Please ask your landlord for your current RentPadi link.
        </Callout>
      )}

      {portal && (
        <>
          <div className="pt-2">
            <h1 className="text-2xl font-bold">Hello {portal.tenant_name.split(' ')[0]},</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Rent for {portal.unit_label}, {portal.property_name} · Landlord: {portal.landlord_name}
            </p>
          </div>

          {!current ? (
            <div className="border-success/25 bg-success/10 flex flex-col items-center gap-2 rounded-2xl border p-6 text-center">
              <span className="bg-success/15 text-success grid size-12 place-items-center rounded-full">
                <CheckCircle2 className="size-6 motion-safe:animate-pop" />
              </span>
              <p className="text-lg font-bold">You’re all paid up</p>
              <p className="text-muted-foreground text-sm">Thank you!</p>
            </div>
          ) : (
            <AmountDue
              charge={current}
              canPay={portal.can_pay_online}
              paying={checkout.isPending}
              onPay={() => checkout.mutate(current.id)}
            />
          )}

          {next && (
            <p className="text-muted-foreground px-1 text-sm">
              Next: {formatKobo(next.balance_kobo)} due {formatDate(next.due_date)}
              {open.length > 2 && ` (and ${open.length - 2} more after that)`}. You can pay it once this one is paid.
            </p>
          )}

          <FormError message={checkout.error ? friendlyError(checkout.error) : null} />

          {portal.can_pay_online ? (
            <p className="text-muted-foreground flex items-start gap-2 px-1 text-xs leading-relaxed">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Payments are processed securely by Paystack and go directly to {portal.landlord_name}’s{' '}
                {portal.payout_bank} account ending <span className="figure">{portal.payout_account_last4}</span>.
              </span>
            </p>
          ) : (
            open.length > 0 && (
              <Callout tone="info">Online payment isn’t available yet. Please pay your landlord directly.</Callout>
            )
          )}

          {portal.receipts.length > 0 && (
            <section className="space-y-3">
              <SectionHeader title="Your receipts" count={portal.receipts.length} />
              <Card className="gap-0 divide-y overflow-hidden py-0">
                {portal.receipts.map((r) => (
                  <Link
                    key={r.receipt_token}
                    to={`/r/${r.receipt_token}`}
                    className="hover:bg-accent/60 flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                  >
                    <span className="bg-success/10 text-success grid size-9 shrink-0 place-items-center rounded-full">
                      <ReceiptText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="figure block font-semibold">{r.receipt_number}</span>
                      <span className="text-muted-foreground text-xs">{formatDate(r.paid_at.slice(0, 10))}</span>
                    </span>
                    <Money kobo={r.amount_kobo} className="font-semibold" />
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                ))}
              </Card>
            </section>
          )}

          {env.whatsappNumber && (
            <Button asChild variant="outline" className="h-11">
              <a href={whatsappLink(env.whatsappNumber, 'Hi')} target="_blank" rel="noreferrer">
                <WhatsAppIcon /> Check rent and receipts on WhatsApp
              </a>
            </Button>
          )}
        </>
      )}
    </main>
  )
}

/** Dot colours on the green card: red = late, gold = due soon. */
const DOT: Partial<Record<PortalCharge['timing'], string>> = {
  overdue: 'bg-[oklch(0.72_0.19_25)]',
  due_soon: 'bg-brand-gold',
}

type AmountDueProps = { charge: PortalCharge; canPay: boolean; paying: boolean; onPay: () => void }

function AmountDue({ charge: c, canPay, paying, onPay }: AmountDueProps) {
  const status = c.status === 'partially_paid' ? 'Part paid' : TIMING_LABEL[c.timing]
  return (
    <section
      aria-label="Rent due now"
      className="brand-surface shadow-float relative overflow-hidden rounded-2xl p-5 text-white"
    >
      <LogoMark
        size={128}
        tone="onBrand"
        className="pointer-events-none absolute -right-6 -bottom-8 rotate-[-10deg] opacity-15"
      />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white/80">Amount due</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            <span aria-hidden="true" className={cn('size-1.5 rounded-full bg-white/70', DOT[c.timing])} />
            {status}
          </span>
        </div>
        <div>
          <p className="text-4xl leading-tight font-bold">
            <Money kobo={c.balance_kobo} />
          </p>
          <p className="mt-1 text-sm text-white/75">
            {formatDate(c.period_start)} – {formatDate(c.period_end)}
          </p>
          <p className="mt-2 text-sm font-semibold">{dueLabel(c.days_until_due)}</p>
          {c.amount_paid_kobo > 0 && (
            <p className="text-xs text-white/70">
              {formatKobo(c.amount_paid_kobo)} of {formatKobo(c.amount_kobo)} already paid
            </p>
          )}
        </div>
        {canPay && (
          <Button variant="gold" className="h-12 w-full text-base" onClick={onPay} disabled={paying}>
            {paying ? 'Opening secure payment…' : `Pay ${formatKobo(c.balance_kobo)}`}
          </Button>
        )}
      </div>
    </section>
  )
}
