import { ChevronRight, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatKobo } from '@/lib/money'
import { rentPeriodPer } from '@/lib/rent'
import { cn } from '@/lib/utils'
import { useTenants } from './api'

export function TenantsPage() {
  const [status, setStatus] = useState<'active' | 'moved_out'>('active')
  const { data: tenants, isPending, error, refetch } = useTenants(status)

  return (
    <>
      <PageHeader
        title="Tenants"
        action={
          <Button asChild size="sm">
            <Link to="/tenants/new">
              <Plus /> Add
            </Link>
          </Button>
        }
      />

      <div role="tablist" className="bg-muted mb-4 grid grid-cols-2 rounded-lg p-1 text-sm font-medium">
        {(
          [
            ['active', 'Current'],
            ['moved_out', 'Moved out'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
            className={cn(
              'rounded-md py-2 transition-colors',
              status === value ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <QueryState isPending={isPending} error={error} refetch={refetch} />

      {tenants?.length === 0 &&
        (status === 'active' ? (
          <EmptyState
            icon={Users}
            title="No tenants yet"
            description="Add the tenant living in each unit, with when their rent started."
            action={
              <Button asChild>
                <Link to="/tenants/new">
                  <Plus /> Add tenant
                </Link>
              </Button>
            }
          />
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">No past tenants.</p>
        ))}

      <ul className="space-y-2">
        {tenants?.map((t) => (
          <li key={t.id}>
            <Card className="hover:bg-accent/50 py-0 transition-colors">
              <Link to={`/tenants/${t.id}`} className="flex items-center gap-3 p-4">
                <div className="bg-secondary text-secondary-foreground grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold">
                  {initials(t.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.full_name}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {t.units?.label} · {t.units?.properties?.name}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm tabular-nums">
                  {formatKobo(t.rent_amount_kobo)}
                  <span className="text-muted-foreground">{rentPeriodPer(t.rent_period)}</span>
                </p>
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
