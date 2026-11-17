import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { Logo } from '@/components/Logo'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatKobo } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { supabase } from '@/lib/supabase'

type Receipt = {
  receipt_number: string
  amount_kobo: number
  method: 'link' | 'cash' | 'transfer'
  paid_at: string
  voided: boolean
  tenant_name: string
  unit_label: string
  property_name: string
  property_address: string | null
  landlord_name: string
  period_start: string
  period_end: string
  charge_amount_kobo: number
  balance_after_kobo: number
}

const METHOD: Record<Receipt['method'], string> = {
  link: 'Online (Flutterwave)',
  cash: 'Cash',
  transfer: 'Bank transfer',
}

// Public, printable receipt. The link (secret token) is the credential.
export function ReceiptPage() {
  const { token = '' } = useParams()
  const { data: r, isPending, error, refetch } = useQuery({
    queryKey: ['receipt', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('receipt', { p_token: token })
      if (error) throw error
      return (data as Receipt | null) ?? null
    },
  })

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8 print:max-w-none print:py-0">
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
                <Row label="Received from">{r.tenant_name}</Row>
                <Row label="Paid to">{r.landlord_name}</Row>
                <Row label="For">
                  {r.unit_label}, {r.property_name}
                  {r.property_address && <span className="text-muted-foreground block text-xs">{r.property_address}</span>}
                </Row>
                <Row label="Rent period">
                  {formatDate(r.period_start)} – {formatDate(r.period_end)}
                </Row>
                <Row label="Date paid">{formatDate(r.paid_at.slice(0, 10))}</Row>
                <Row label="Method">{METHOD[r.method]}</Row>
                <Row label="Rent for period">{formatKobo(r.charge_amount_kobo)}</Row>
                <Row label="Balance after this payment">
                  {r.balance_after_kobo > 0 ? formatKobo(r.balance_after_kobo) : 'Fully paid'}
                </Row>
              </dl>

              {r.voided && (
                <p className="text-destructive text-sm">
                  This payment was cancelled by the landlord and is no longer valid.
                </p>
              )}
            </CardContent>
          </Card>

          <Button variant="outline" className="h-12 print:hidden" onClick={() => window.print()}>
            <Printer /> Print or save as PDF
          </Button>
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
