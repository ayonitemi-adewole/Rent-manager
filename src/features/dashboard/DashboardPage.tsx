import { format, subDays } from 'date-fns'
import { AlertTriangle, CalendarClock, CheckCircle2, Landmark, PartyPopper, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Callout } from '@/components/Callout'
import { EmptyState } from '@/components/EmptyState'
import { LogoMark } from '@/components/Logo'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { SectionHeader } from '@/components/SectionHeader'
import { StatTile } from '@/components/StatTile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useOpenCharges } from '@/features/charges/api'
import { ChargeRow } from '@/features/charges/ChargeRow'
import { useLandlord } from '@/features/landlord/api'
import { SetupChecklist } from '@/features/onboarding/SetupChecklist'
import { METHOD_LABEL, usePaymentsSince } from '@/features/payments/api'
import { useTenants } from '@/features/tenants/api'
import { bucketCharges, type Bucket } from '@/lib/charges'
import { formatDate } from '@/lib/rent'

/** Start of this month and of 14 days ago, in Lagos time (UTC+1, no DST). */
function windows() {
  const now = new Date()
  const monthStart = `${format(now, 'yyyy-MM')}-01T00:00:00+01:00`
  const recentStart = `${format(subDays(now, 14), 'yyyy-MM-dd')}T00:00:00+01:00`
  const since = Date.parse(monthStart) < Date.parse(recentStart) ? monthStart : recentStart
  return { monthStart, since, recentStart, monthName: format(now, 'MMMM'), today: format(now, 'EEEE d MMMM') }
}

function greeting(fullName: string | undefined) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = fullName?.trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
}

const tenantsCount = (n: number) => `${n} ${n === 1 ? 'tenant' : 'tenants'}`

export function DashboardPage() {
  const charges = useOpenCharges()
  const tenants = useTenants('active')
  const { data: landlord } = useLandlord()
  const { monthStart, since, recentStart, monthName, today } = useMemo(() => windows(), [])
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
      <PageHeader eyebrow={today} title={greeting(landlord?.full_name)} subtitle="Who owes rent, and how soon." />
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
        <div className="space-y-6 lg:space-y-8">
          {landlord && (
            <SetupChecklist
              landlordId={landlord.id}
              fallback={
                !landlord.paystack_subaccount_code && (
                  <Callout
                    icon={Landmark}
                    title={landlord.account_number ? 'Confirm your payout account' : 'Get paid online'}
                    action={
                      <Button asChild size="sm">
                        <Link to="/settings/payout">{landlord.account_number ? 'Confirm' : 'Set up'}</Link>
                      </Button>
                    }
                  >
                    {landlord.account_number
                      ? // Saved before the move to Paystack: one confirmation sets it up there.
                        'Online payments now go through Paystack. Confirm your bank account once so tenants can keep paying online.'
                      : 'Add the bank account rent should go to.'}
                  </Callout>
                )
              }
            />
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
            <div className="brand-surface shadow-float relative col-span-2 overflow-hidden rounded-xl p-5 text-white lg:col-span-1">
              <LogoMark
                size={132}
                tone="onBrand"
                className="pointer-events-none absolute -right-5 -bottom-8 rotate-[-10deg] opacity-15"
              />
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white/80">
                <CheckCircle2 className="size-4" />
                Collected in {monthName}
              </p>
              <p className="mt-2 text-3xl leading-tight font-bold lg:text-[2rem]">
                <Money kobo={collectedKobo} />
              </p>
              <p className="mt-1 text-sm text-white/70">
                {thisMonth.length} {thisMonth.length === 1 ? 'payment' : 'payments'}
              </p>
            </div>
            <StatTile
              icon={AlertTriangle}
              label="Overdue"
              tone={overdue.count > 0 ? 'danger' : 'default'}
              value={<Money kobo={overdue.totalKobo} />}
              hint={tenantsCount(overdue.count)}
            />
            <StatTile
              icon={CalendarClock}
              label="Due in 30 days"
              tone={dueSoon.count > 0 ? 'warning' : 'default'}
              value={<Money kobo={dueSoon.totalKobo} />}
              hint={tenantsCount(dueSoon.count)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start lg:gap-8">
            <div className="space-y-6 lg:col-span-2">
              {overdue.count === 0 && dueSoon.count === 0 ? (
                <EmptyState
                  icon={PartyPopper}
                  title="All caught up"
                  description="Nobody is late, and no rent is due in the next 30 days."
                />
              ) : (
                <>
                  <ChargeSection title="Overdue" bucket={overdue} dot="bg-destructive" />
                  <ChargeSection title="Due in the next 30 days" bucket={dueSoon} dot="bg-warning" />
                </>
              )}
            </div>

            {/* Large screens keep the column when it's empty, so the page doesn't look lopsided. */}
            <section className={recent.length === 0 ? 'hidden space-y-3 lg:block' : 'space-y-3'}>
              <SectionHeader title="Paid recently" />
              {recent.length === 0 ? (
                <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                  No payments in the last two weeks.
                </p>
              ) : (
                <Card className="gap-0 divide-y overflow-hidden py-0">
                  {recent.map((p) => (
                    <Link
                      key={p.id}
                      to={`/tenants/${p.tenant_id}`}
                      className="hover:bg-accent/60 flex items-center gap-3 px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.tenant_name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {p.unit_label} · {p.paid_at && formatDate(p.paid_at.slice(0, 10))}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Money kobo={p.amount_kobo ?? 0} className="text-success text-sm font-semibold" />
                        <Badge variant="muted">{METHOD_LABEL[p.method ?? ''] ?? p.method}</Badge>
                      </div>
                    </Link>
                  ))}
                </Card>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  )
}

function ChargeSection({ title, bucket, dot }: { title: string; bucket: Bucket; dot: string }) {
  if (bucket.count === 0) return null
  return (
    <section className="space-y-3">
      <SectionHeader title={title} count={bucket.count} dot={dot} />
      <Card className="gap-0 divide-y overflow-hidden py-0">
        {bucket.tenants.map((t) => (
          <ChargeRow key={t.tenantId} due={t} />
        ))}
      </Card>
    </section>
  )
}
