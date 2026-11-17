import { Link } from 'react-router'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { useUnitTenants } from '@/features/tenants/api'
import { formatKobo } from '@/lib/money'
import { formatDate, rentPeriodPer } from '@/lib/rent'

/** Everyone who has rented this unit, current tenant first. */
export function UnitHistory({ unitId }: { unitId: string }) {
  const { data: tenants, isPending, error, refetch } = useUnitTenants(unitId)

  return (
    <section className="mt-10 space-y-3 border-t pt-6">
      <h2 className="text-sm font-semibold">Tenant history</h2>
      <QueryState isPending={isPending} error={error} refetch={refetch} />
      {tenants?.length === 0 && <p className="text-muted-foreground text-sm">Nobody has rented this unit yet.</p>}
      <ul className="divide-y rounded-lg border">
        {tenants?.map((t) => (
          <li key={t.id}>
            <Link to={`/tenants/${t.id}`} className="hover:bg-accent/50 flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{t.full_name}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(t.start_date)} – {t.moved_out_at ? formatDate(t.moved_out_at) : 'now'} ·{' '}
                  {formatKobo(t.rent_amount_kobo)}
                  {rentPeriodPer(t.rent_period)}
                </span>
              </span>
              {t.status === 'active' && <Badge variant="secondary">Current</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
