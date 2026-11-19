import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Logo } from '@/components/Logo'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { useVerifyPayment } from './api'

// Flutterwave redirects here: /t/:token/paid?status=successful|cancelled|failed&tx_ref=…&transaction_id=…
// The query string is only a hint; the result shown comes from flw-verify (which asks Flutterwave).
export function PaymentResultPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const cancelled = params.get('status') === 'cancelled'
  const txRef = cancelled ? null : params.get('tx_ref')
  const verify = useVerifyPayment(token, txRef, params.get('transaction_id'))
  const outcome = verify.data?.outcome

  return (
    <main className="motion-safe:animate-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <Logo />
      {cancelled || !txRef ? (
        <Result icon={<XCircle className="text-muted-foreground size-12" />} title="Payment cancelled">
          No money was taken. You can try again whenever you’re ready.
        </Result>
      ) : (
        <>
          <QueryState isPending={verify.isPending} error={verify.error} refetch={verify.refetch} />
          {outcome === 'recorded' && (
            <Result icon={<CheckCircle2 className="text-success size-12 motion-safe:animate-pop" />} title="Payment received">
              Thank you! Your landlord can now see this payment. A receipt will be sent to your phone.
            </Result>
          )}
          {outcome === 'pending' && (
            <Result icon={<Clock className="text-warning size-12" />} title="Confirming your payment…">
              This can take a minute for bank transfers. You can keep this page open or come back later.
            </Result>
          )}
          {(outcome === 'failed' || outcome === 'not_found' || outcome === 'ignored') && (
            <Result icon={<XCircle className="text-destructive size-12" />} title="Payment not completed">
              {verify.data?.reason ?? 'We could not confirm this payment. If money left your account, contact your landlord.'}
            </Result>
          )}
        </>
      )}
      <Button asChild variant="outline" className="h-12">
        <Link to={`/t/${token}`}>Back to my rent</Link>
      </Button>
    </main>
  )
}

function Result({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center motion-safe:animate-enter">
      {icon}
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-muted-foreground max-w-xs text-sm">{children}</p>
    </div>
  )
}
