import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileDown, Link2Off, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { Callout } from '@/components/Callout'
import { Logo } from '@/components/Logo'
import { PullToRefresh } from '@/components/PullToRefresh'
import { Money } from '@/components/Money'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { publicRpc } from '@/lib/public-api'
import { downloadFile } from '@/lib/share'
import { cn } from '@/lib/utils'
import { receiptFileName, receiptPdf, receiptRows, type Receipt } from '@/features/receipts/receipt'

// Public, printable receipt. The link (secret token) is the credential.
export function ReceiptPage() {
  const { token = '' } = useParams()
  const { data: r, isPending, error, refetch } = useQuery({
    queryKey: ['receipt', token],
    queryFn: async () => (await publicRpc<Receipt | null>('receipt', { p_token: token })) ?? null,
  })

  return (
    <PullToRefresh>
      <main className="motion-safe:animate-enter mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6 print:max-w-none print:py-0">
        <Logo size="sm" />
        <QueryState isPending={isPending} error={error} refetch={refetch} />
        {r === null && (
          <Callout tone="info" icon={Link2Off}>
            This receipt link is not valid.
          </Callout>
        )}

        {r && (
          <>
            {/* A paper receipt: amount on top, a torn-off line, then the details. */}
            <article className="bg-card shadow-card relative overflow-hidden rounded-2xl border border-border/80 print:border-0 print:shadow-none">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Rent receipt</p>
                    <p className="figure text-lg font-bold">{r.receipt_number}</p>
                  </div>
                  {r.voided ? (
                    <span className="border-destructive text-destructive -rotate-6 rounded-md border-2 px-2 py-0.5 text-sm font-bold tracking-widest">
                      VOID
                    </span>
                  ) : (
                    <span className="bg-success/10 text-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold">
                      <CheckCircle2 className="size-4" /> Paid
                    </span>
                  )}
                </div>

                <div className={cn(r.voided && 'text-muted-foreground line-through')}>
                  <p className="text-muted-foreground text-sm">Amount received</p>
                  <p className="text-4xl leading-tight font-bold">
                    <Money kobo={r.amount_kobo} />
                  </p>
                </div>
              </div>

              <div aria-hidden="true" className="relative mx-5 border-t-2 border-dashed sm:mx-6 print:mx-0">
                <span className="bg-background absolute top-1/2 -left-8 size-6 sm:-left-9 -translate-y-1/2 rounded-full border border-border/80 print:hidden" />
                <span className="bg-background absolute top-1/2 -right-8 size-6 sm:-right-9 -translate-y-1/2 rounded-full border border-border/80 print:hidden" />
              </div>

              <dl className="divide-y px-5 py-3 text-sm sm:px-6">
                {receiptRows(r).map(([label, value, note]) => (
                  <Row key={label} label={label}>
                    {value}
                    {note && <span className="text-muted-foreground block text-xs font-normal">{note}</span>}
                  </Row>
                ))}
              </dl>

              {r.voided && (
                <p className="text-destructive px-5 pb-5 text-sm sm:px-6">
                  This payment was cancelled by the landlord and is no longer valid.
                </p>
              )}
            </article>

            <div className="grid grid-cols-2 gap-2 print:hidden">
              <Button
                className="h-12"
                onClick={() =>
                  downloadFile(
                    new File([receiptPdf(r, window.location.href) as BlobPart], receiptFileName(r), {
                      type: 'application/pdf',
                    }),
                  )
                }
              >
                <FileDown /> Download PDF
              </Button>
              <Button variant="outline" className="h-12" onClick={() => window.print()}>
                <Printer /> Print
              </Button>
            </div>
            <p className="text-muted-foreground text-center text-xs print:hidden">Issued by RentPadi</p>
          </>
        )}
      </main>
    </PullToRefresh>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}
