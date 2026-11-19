import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileDown, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { Logo } from '@/components/Logo'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatKobo } from '@/lib/money'
import { publicRpc } from '@/lib/public-api'
import { downloadFile } from '@/lib/share'
import { receiptFileName, receiptPdf, receiptRows, type Receipt } from '@/features/receipts/receipt'

// Public, printable receipt. The link (secret token) is the credential.
export function ReceiptPage() {
  const { token = '' } = useParams()
  const { data: r, isPending, error, refetch } = useQuery({
    queryKey: ['receipt', token],
    queryFn: async () => (await publicRpc<Receipt | null>('receipt', { p_token: token })) ?? null,
  })

  return (
    <main className="motion-safe:animate-enter mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8 print:max-w-none print:py-0">
      <Logo />
      <QueryState isPending={isPending} error={error} refetch={refetch} />
      {r === null && <p className="text-sm">This receipt link is not valid.</p>}

      {r && (
        <>
          <Card className="print:border-0 print:shadow-none">
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Rent receipt</p>
                  <p className="text-lg font-bold">{r.receipt_number}</p>
                </div>
                {r.voided ? (
                  <span className="border-destructive text-destructive rounded border-2 px-2 py-0.5 text-sm font-bold">
                    VOID
                  </span>
                ) : (
                  <CheckCircle2 className="text-success size-8" />
                )}
              </div>

              <div className={r.voided ? 'text-muted-foreground line-through' : ''}>
                <p className="text-muted-foreground text-sm">Amount received</p>
                <p className="text-3xl font-bold tabular-nums">{formatKobo(r.amount_kobo)}</p>
              </div>

              <dl className="divide-y text-sm">
                {receiptRows(r).map(([label, value, note]) => (
                  <Row key={label} label={label}>
                    {value}
                    {note && <span className="text-muted-foreground block text-xs">{note}</span>}
                  </Row>
                ))}
              </dl>

              {r.voided && (
                <p className="text-destructive text-sm">
                  This payment was cancelled by the landlord and is no longer valid.
                </p>
              )}
            </CardContent>
          </Card>

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
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}
