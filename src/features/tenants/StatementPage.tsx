import { ArrowDownLeft, ArrowUpRight, Download } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Money } from '@/components/Money'
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
        <div className="space-y-4 lg:max-w-3xl">
          <div
            className={cn(
              'flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-xl border p-4 sm:p-5',
              balance > 0 ? 'border-destructive/25 bg-destructive/5' : 'border-success/25 bg-success/5',
            )}
          >
            <div>
              <p className="text-muted-foreground text-sm font-semibold">Balance now</p>
              <p className={cn('text-2xl font-bold', balance > 0 ? 'text-destructive' : 'text-success')}>
                {balance > 0 ? <Money kobo={balance} /> : 'Nothing owed'}
              </p>
            </div>
            <p className="text-muted-foreground text-xs">Includes rent not yet due.</p>
          </div>

          <Card className="gap-0 divide-y overflow-hidden py-0">
            {ledger.map((e) => {
              const paid = e.kind === 'payment'
              const Icon = paid ? ArrowDownLeft : ArrowUpRight
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full',
                      paid ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{describe(e)}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(e.date)}
                      {e.payment?.receipt_number && (
                        <>
                          {' · '}
                          <span className="figure">{e.payment.receipt_number}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="figure shrink-0 text-right">
                    <p className={cn('font-semibold', paid && 'text-success')}>
                      {paid ? `−${formatKobo(e.paidKobo)}` : `+${formatKobo(e.chargeKobo)}`}
                    </p>
                    <p className="text-muted-foreground text-xs">Bal. {formatKobo(e.balanceKobo)}</p>
                  </div>
                </div>
              )
            })}
          </Card>
          <Button asChild variant="link" className="px-0">
            <Link to={`/tenants/${tenantId}`}>Back to tenant</Link>
          </Button>
        </div>
      )}
    </>
  )
}

function describe(e: LedgerEntry): string {
  if (e.kind === 'charge' && e.charge) return `Rent ${formatDate(e.charge.period_start)} – ${formatDate(e.charge.period_end)}`
  return `Payment (${METHOD_LABEL[e.payment?.method ?? ''] ?? e.payment?.method})`
}
