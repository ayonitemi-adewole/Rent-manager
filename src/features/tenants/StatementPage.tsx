import { Download } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useTenantCharges } from '@/features/charges/api'
import { METHOD_LABEL, useTenantPayments } from '@/features/payments/api'
import { downloadCsv, nairaCell, toCsv } from '@/lib/csv'
import { buildLedger, type LedgerEntry } from '@/lib/ledger'
import { formatKobo } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { cn } from '@/lib/utils'
import { useTenant } from './api'

/** Everything charged and paid for one tenant, with a running balance. */
export function StatementPage() {
  const { tenantId = '' } = useParams()
  const tenant = useTenant(tenantId)
  const charges = useTenantCharges(tenantId)
  const payments = useTenantPayments(tenantId)

  const isPending = tenant.isPending || charges.isPending || payments.isPending
  const error = tenant.error ?? charges.error ?? payments.error
  const ledger =
    charges.data && payments.data
      ? buildLedger(
          charges.data,
          payments.data.map((p) => ({
            id: p.id!,
            paid_at: p.paid_at!,
            amount_kobo: p.amount_kobo!,
            method: p.method!,
            receipt_number: p.receipt_number,
            voided_at: p.voided_at,
          })),
        )
      : []
  const balance = ledger.at(-1)?.balanceKobo ?? 0

  function exportCsv() {
    const name = tenant.data?.full_name ?? 'tenant'
    const csv = toCsv(
      ['Date', 'Description', 'Rent charged (NGN)', 'Paid (NGN)', 'Balance (NGN)', 'Receipt'],
      ledger.map((e) => [e.date, describe(e), nairaCell(e.chargeKobo), nairaCell(e.paidKobo), nairaCell(e.balanceKobo), e.payment?.receipt_number ?? '']),
    )
    downloadCsv(`${name.replace(/[^\w]+/g, '-')}-statement.csv`, csv)
  }

  return (
    <>
      <PageHeader
        title="Statement"
        subtitle={tenant.data?.full_name}
        back={{ to: `/tenants/${tenantId}`, label: 'Back' }}
        action={
          ledger.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download /> CSV
            </Button>
          )
        }
      />
      <QueryState isPending={isPending} error={error} />
      {!isPending && !error && ledger.length === 0 && <p className="text-muted-foreground text-sm">Nothing to show yet.</p>}

      {ledger.length > 0 && (
        <>
          <p className="mb-3 text-sm">
            Balance now:{' '}
            <span className={cn('font-semibold tabular-nums', balance > 0 && 'text-destructive')}>
              {balance > 0 ? `${formatKobo(balance)} owed` : 'nothing owed'}
            </span>
            <span className="text-muted-foreground"> (includes rent not yet due)</span>
          </p>
          <Card className="divide-y overflow-hidden py-0">
            {ledger.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{describe(e)}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(e.date)}
                    {e.payment?.receipt_number && ` · ${e.payment.receipt_number}`}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className={e.kind === 'payment' ? 'text-success font-semibold' : 'font-semibold'}>
                    {e.kind === 'payment' ? `−${formatKobo(e.paidKobo)}` : `+${formatKobo(e.chargeKobo)}`}
                  </p>
                  <p className="text-muted-foreground text-xs">Bal. {formatKobo(e.balanceKobo)}</p>
                </div>
              </div>
            ))}
          </Card>
          <Button asChild variant="link" className="mt-2 px-0">
            <Link to={`/tenants/${tenantId}`}>Back to tenant</Link>
          </Button>
        </>
      )}
    </>
  )
}

function describe(e: LedgerEntry): string {
  if (e.kind === 'charge' && e.charge) return `Rent ${formatDate(e.charge.period_start)} – ${formatDate(e.charge.period_end)}`
  return `Payment (${METHOD_LABEL[e.payment?.method ?? ''] ?? e.payment?.method})`
}
