import { AlertTriangle, CalendarClock, Landmark, PartyPopper, Plus, type LucideIcon } from 'lucide-react'
import { useLandlord } from '@/features/landlord/api'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useOpenCharges } from '@/features/charges/api'
import { ChargeRow } from '@/features/charges/ChargeRow'
import { useTenants } from '@/features/tenants/api'
import { bucketCharges, type Bucket } from '@/lib/charges'
import { formatKobo } from '@/lib/money'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const charges = useOpenCharges()
  const tenants = useTenants('active')
  const { data: landlord } = useLandlord()

  const isPending = charges.isPending || tenants.isPending
  const error = charges.error ?? tenants.error
  const ready = !isPending && !error
  const { overdue, dueSoon } = bucketCharges(charges.data ?? [])
  const noTenants = tenants.data?.length === 0

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Who owes rent, and how soon." />
      <QueryState
        isPending={isPending}
        error={error}
        refetch={() => {
          void charges.refetch()
          void tenants.refetch()
        }}
      />

      {ready && noTenants && (
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
      )}

      {ready && !noTenants && (
        <div className="space-y-6">
          {landlord && !landlord.flw_subaccount_id && (
            <Card className="border-primary/30 bg-secondary py-4">
              <CardContent className="flex items-center gap-3 px-4">
                <Landmark className="text-primary size-6 shrink-0" />
                <p className="flex-1 text-sm">
                  <span className="font-semibold">Get paid online.</span> Add the bank account rent should go to.
                </p>
                <Button asChild size="sm">
                  <Link to="/settings/payout">Set up</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={AlertTriangle} label="Overdue" bucket={overdue} tone="text-destructive" />
            <StatCard icon={CalendarClock} label="Due in 30 days" bucket={dueSoon} tone="text-warning" />
          </div>

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
      )}
    </>
  )
}

function StatCard({ icon: Icon, label, bucket, tone }: { icon: LucideIcon; label: string; bucket: Bucket; tone: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <Icon className={cn('size-4', bucket.count > 0 ? tone : 'text-muted-foreground')} />
          {label}
        </p>
        <p className="text-xl font-bold tabular-nums">{formatKobo(bucket.totalKobo)}</p>
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
      <Card className="divide-y overflow-hidden py-0">
        {bucket.charges.map((c) => (
          <ChargeRow key={c.id} charge={c} />
        ))}
      </Card>
    </section>
  )
}
