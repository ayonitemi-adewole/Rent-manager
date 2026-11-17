import { AlertTriangle, CalendarClock, CheckCircle2, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatKobo } from '@/lib/money'

// Week 2: replace zeros with the `dashboard_summary` RPC.
const stats = [
  { label: 'Collected this month', value: formatKobo(0), icon: CheckCircle2, tone: 'text-success' },
  { label: 'Due in 30 days', value: formatKobo(0), icon: CalendarClock, tone: 'text-warning' },
  { label: 'Overdue', value: formatKobo(0), icon: AlertTriangle, tone: 'text-destructive' },
]

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Who has paid, who is due, who is late." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="py-4">
            <CardContent className="flex items-center gap-3 px-4">
              <Icon className={`size-5 shrink-0 ${tone}`} />
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-lg font-semibold tabular-nums">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <EmptyState
        icon={LayoutDashboard}
        title="No rent to track yet"
        description="Add a property, its units and your tenants. Rent due dates will show up here."
        action={
          <Button asChild>
            <Link to="/properties">Set up properties</Link>
          </Button>
        }
      />
    </>
  )
}
