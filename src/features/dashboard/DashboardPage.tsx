import { format, subDays } from 'date-fns'
import { AlertTriangle, CalendarClock, CheckCircle2, Landmark, PartyPopper, Plus, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useOpenCharges } from '@/features/charges/api'
import { ChargeRow } from '@/features/charges/ChargeRow'
import { useLandlord } from '@/features/landlord/api'
import { SetupChecklist } from '@/features/onboarding/SetupChecklist'
import { METHOD_LABEL, usePaymentsSince } from '@/features/payments/api'
import { useTenants } from '@/features/tenants/api'
import { bucketCharges, type Bucket } from '@/lib/charges'
import { formatKobo } from '@/lib/money'
import { formatDate } from '@/lib/rent'
import { cn } from '@/lib/utils'

/** Start of this month and of 14 days ago, in Lagos time (UTC+1, no DST). */
function windows() {
  const now = new Date()
  const monthStart = `${format(now, 'yyyy-MM')}-01T00:00:00+01:00`
  const recentStart = `${format(subDays(now, 14), 'yyyy-MM-dd')}T00:00:00+01:00`
  const since = Date.parse(monthStart) < Date.parse(recentStart) ? monthStart : recentStart
  return { monthStart, since, recentStart, monthName: format(now, 'MMMM') }
}

function greeting(fullName: string | undefined) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = fullName?.trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
}

export function DashboardPage() {
  const charges = useOpenCharges()
  const tenants = useTenants('active')
  const { data: landlord } = useLandlord()
  const { monthStart, since, recentStart, monthName } = useMemo(() => windows(), [])
  const payments = usePaymentsSince(since)

  const isPending = charges.isPending || tenants.isPending || payments.isPending
  const error = charges.error ?? tenants.error ?? payments.error
  const ready = !isPending && !error
  const { overdue, dueSoon } = bucketCharges(charges.data ?? [])
  const noTenants = tenants.data?.length === 0

  const paid = payments.data ?? []
  const after = (iso: string | null, start: string) => iso !== null && Date.parse(iso) >= Date.parse(start)
  const thisMonth = paid.filter((p) => after(p.paid_at, monthStart))
  const collectedKobo = thisMonth.reduce((sum, p) => sum + (p.amount_kobo ?? 0), 0)
  const recent = paid.filter((p) => after(p.paid_at, recentStart)).slice(0, 5)

  return (
    <>
      <PageHeader title={greeting(landlord?.full_name)} subtitle="Who owes rent, and how soon." />
      <QueryState
        isPending={isPending}
        error={error}
        refetch={() => {
          void charges.refetch()
          void tenants.refetch()
          void payments.refetch()
        }}
      />

      {ready && noTenants && landlord && (
        <SetupChecklist
          landlordId={landlord.id}
          fallback={
            <EmptyState
              icon={Plus}
              title="No rent to track yet"
              description="Add a property, its units and your tenants. Rent due dates will show up here."
              action={
                <Button asChild>
                  <Link to="/properties">Set up properties</Link>
                </Button>
              }
            />
          }
        />
      )}

      {ready && !noTenants && (
        <div className="space-y-6">
          {landlord && (
            <SetupChecklist
              landlordId={landlord.id}
              fallback={
                !landlord.paystack_subaccount_code && (
                  <Card className="border-primary/30 bg-secondary py-4">
                    <CardContent className="flex items-center gap-3 px-4">
                      <Landmark className="text-primary size-6 shrink-0" />
                      {landlord.account_number ? (
                        // Saved before the move to Paystack: one confirmation sets it up there.
                        <p className="flex-1 text-sm">
                          <span className="font-semibold">Confirm your payout account.</span> Online payments now go
                          through Paystack. Confirm your bank account once so tenants can keep paying online.
                        </p>
                      ) : (
                        <p className="flex-1 text-sm">
                          <span className="font-semibold">Get paid online.</span> Add the bank account rent should go
                          to.
                        </p>
                      )}
                      <Button asChild size="sm">
                        <Link to="/settings/payout">{landlord.account_number ? 'Confirm' : 'Set up'}</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              }
            />
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
            <Card className="bg-primary text-primary-foreground col-span-2 gap-1 border-transparent py-4 lg:col-span-1 lg:py-5">
              <CardContent className="flex items-end justify-between gap-3 px-4 lg:block lg:space-y-1 lg:px-5">
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
                    <CheckCircle2 className="size-4" />
                    Collected in {monthName}
                  </p>
                  <p className="text-2xl font-bold tabular-nums lg:text-3xl">{formatKobo(collectedKobo)}</p>
                </div>
                <p className="text-xs opacity-80">
                  {thisMonth.length} {thisMonth.length === 1 ? 'payment' : 'payments'}
                </p>
              </CardContent>
            </Card>
            <StatCard icon={AlertTriangle} label="Overdue" bucket={overdue} tone="text-destructive" />
            <StatCard icon={CalendarClock} label="Due in 30 days" bucket={dueSoon} tone="text-warning" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
            <div className="space-y-6 lg:col-span-2">
              {overdue.count === 0 && dueSoon.count === 0 ? (
                <EmptyState
                  icon={PartyPopper}
                  title="All caught up"
                  description="Nobody is late, and no rent is due in the next 30 days."
                />
              ) : (
                <>
                  <ChargeSection title="Overdue" bucket={overdue} />
                  <ChargeSection title="Due in the next 30 days" bucket={dueSoon} />
                </>
              )}
            </div>

            {recent.length === 0 ? (
              // Large screens keep the column, so the page doesn't look lopsided.
              <section className="hidden space-y-2 lg:block">
                <h2 className="font-semibold">Paid recently</h2>
                <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                  No payments in the last two weeks.
                </p>
              </section>
            ) : (
              <section className="space-y-2">
                <h2 className="font-semibold">Paid recently</h2>
                <Card className="gap-0 divide-y overflow-hidden py-0">
                  {recent.map((p) => (
                    <Link
                      key={p.id}
                      to={`/tenants/${p.tenant_id}`}
                      className="hover:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.tenant_name}</p>
                        <p className="text-muted-foreground truncate text-sm">
                          {p.unit_label} · {p.paid_at && formatDate(p.paid_at.slice(0, 10))}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-success font-semibold tabular-nums">{formatKobo(p.amount_kobo ?? 0)}</span>
                        <Badge variant="outline" className="text-xs">
                          {METHOD_LABEL[p.method ?? ''] ?? p.method}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </Card>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function StatCard({
  icon: Icon,
  label,
  bucket,
  tone,
}: {
  icon: LucideIcon
  label: string
  bucket: Bucket
  tone: string
}) {
  return (
    <Card className="gap-1 py-4 lg:py-5">
      <CardContent className="space-y-1 px-4 lg:px-5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <Icon className={cn('size-4', bucket.count > 0 ? tone : 'text-muted-foreground')} />
          {label}
        </p>
        <p className="text-xl font-bold tabular-nums lg:text-3xl">{formatKobo(bucket.totalKobo)}</p>
        <p className="text-muted-foreground text-xs">
          {bucket.count} {bucket.count === 1 ? 'tenant' : 'tenants'}
        </p>
      </CardContent>
    </Card>
  )
}

function ChargeSection({ title, bucket }: { title: string; bucket: Bucket }) {
  if (bucket.count === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <Card className="gap-0 divide-y overflow-hidden py-0">
        {bucket.tenants.map((t) => (
          <ChargeRow key={t.tenantId} due={t} />
        ))}
      </Card>
    </section>
  )
}
