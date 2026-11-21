import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Logo } from '@/components/Logo'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useVerifyPayment } from './api'

// Paystack redirects here: /t/:token/paid?trxref=…&reference=… after a payment, or ?status=cancelled
// if the tenant closes the checkout. The result shown comes from pay-verify (which asks Paystack).
export function PaymentResultPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const cancelled = params.get('status') === 'cancelled'
  const reference = cancelled ? null : (params.get('reference') ?? params.get('trxref'))
  const verify = useVerifyPayment(token, reference)
  const outcome = verify.data?.outcome

  return (
    <main className="motion-safe:animate-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
      <Logo size="sm" />
      <div className="bg-card shadow-card rounded-2xl border border-border/80 px-5">
        {cancelled || !reference ? (
          <Result tone="muted" icon={<XCircle className="size-10" />} title="Payment cancelled">
            No money was taken. You can try again whenever you’re ready.
          </Result>
        ) : (
          <>
            <div className="py-5 empty:hidden">
              <QueryState isPending={verify.isPending} error={verify.error} refetch={verify.refetch} />
            </div>
            {outcome === 'recorded' && (
              <Result
                tone="success"
                icon={<CheckCircle2 className="size-10 motion-safe:animate-pop" />}
                title="Payment received"
              >
                Thank you! Your landlord can now see this payment. A receipt will be sent to your phone.
              </Result>
            )}
            {outcome === 'pending' && (
              <Result tone="warning" icon={<Clock className="size-10" />} title="Confirming your payment…">
                This can take a minute for bank transfers. You can keep this page open or come back later.
              </Result>
            )}
            {(outcome === 'failed' || outcome === 'not_found' || outcome === 'ignored') && (
              <Result tone="danger" icon={<XCircle className="size-10" />} title="Payment not completed">
                {verify.data?.reason ?? 'We could not confirm this payment. If money left your account, contact your landlord.'}
              </Result>
            )}
          </>
        )}
      </div>
      <Button asChild variant="outline" className="h-12">
        <Link to={`/t/${token}`}>Back to my rent</Link>
      </Button>
    </main>
  )
}

const TONE = {
  success: 'bg-success/12 text-success ring-success/6',
  warning: 'bg-warning/15 text-warning-foreground ring-warning/8',
  danger: 'bg-destructive/10 text-destructive ring-destructive/5',
  muted: 'bg-muted text-muted-foreground ring-muted/50',
} as const

function Result({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof TONE
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center motion-safe:animate-enter">
      <span className={cn('mb-2 grid size-20 place-items-center rounded-full ring-8', TONE[tone])}>{icon}</span>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground max-w-xs text-sm">{children}</p>
    </div>
  )
}
