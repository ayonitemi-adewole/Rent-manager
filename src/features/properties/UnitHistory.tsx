import { Link } from 'react-router'
import { QueryState } from '@/components/QueryState'
import { SectionHeader } from '@/components/SectionHeader'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useUnitTenants } from '@/features/tenants/api'
import { formatKobo } from '@/lib/money'
import { formatDate, rentPeriodPer } from '@/lib/rent'

/** Everyone who has rented this unit, current tenant first. */
export function UnitHistory({ unitId }: { unitId: string }) {
  const { data: tenants, isPending, error, refetch } = useUnitTenants(unitId)

  return (
    <section className="mt-10 space-y-3">
      <SectionHeader title="Tenant history" count={tenants?.length || undefined} />
      <QueryState isPending={isPending} error={error} refetch={refetch} />
      {tenants?.length === 0 && <p className="text-muted-foreground text-sm">Nobody has rented this unit yet.</p>}
      {tenants && tenants.length > 0 && (
        <Card className="gap-0 divide-y overflow-hidden py-0">
          {tenants.map((t) => (
            <Link
              key={t.id}
              to={`/tenants/${t.id}`}
              className="hover:bg-accent/60 flex items-center gap-3 px-4 py-3 text-sm transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.full_name}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(t.start_date)} – {t.moved_out_at ? formatDate(t.moved_out_at) : 'now'} ·{' '}
                  {formatKobo(t.rent_amount_kobo)}
                  {rentPeriodPer(t.rent_period)}
                </span>
              </span>
              {t.status === 'active' && (
                <Badge variant="success" dot>
                  Current
                </Badge>
              )}
            </Link>
          ))}
        </Card>
      )}
    </section>
  )
}
