import { ChevronRight, Plus, Search, Users, X } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatKobo } from '@/lib/money'
import { formatNgPhone } from '@/lib/phone'
import { formatDate, rentPeriodPer } from '@/lib/rent'
import { cn, initials } from '@/lib/utils'
import { useTenants } from './api'

type Tenant = NonNullable<ReturnType<typeof useTenants>['data']>[number]

/** Matches name, unit, property or phone (any spacing, 080… or +234…). */
function matches(t: Tenant, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  const text = [t.full_name, t.units?.label, t.units?.properties?.name].join(' ').toLowerCase()
  if (text.includes(q)) return true
  if (digits.length >= 3) {
    const local = t.phone.replace(/^\+234/, '0')
    return t.phone.includes(digits) || local.includes(digits)
  }
  return false
}

export function TenantsPage() {
  const [status, setStatus] = useState<'active' | 'moved_out'>('active')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const { data: tenants, isPending, error, refetch } = useTenants(status)
  const navigate = useNavigate()

  const shown = tenants?.filter((t) => matches(t, deferredQuery))
  const searching = deferredQuery.trim() !== ''

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle={tenants && tenants.length > 0 ? `${tenants.length} ${status === 'active' ? 'current' : 'past'}` : undefined}
        action={
          <Button asChild size="sm">
            <Link to="/tenants/new" data-tour="add-tenant">
              <Plus /> Add<span className="hidden lg:inline"> tenant</span>
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="tablist" className="bg-muted grid grid-cols-2 rounded-lg p-1 text-sm font-medium sm:w-64">
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

        {(tenants?.length ?? 0) > 0 && (
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, unit or phone"
              aria-label="Search tenants"
              className="h-10 pr-9 pl-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
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
                <Link to="/tenants/new" data-tour="add-tenant">
                  <Plus /> Add tenant
                </Link>
              </Button>
            }
          />
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">No past tenants.</p>
        ))}

      {searching && shown?.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">No tenants match “{deferredQuery.trim()}”.</p>
      )}

      {/* Phones and tablets: cards. */}
      <ul className="space-y-2 lg:hidden">
        {shown?.map((t) => (
          <li key={t.id}>
            <Card className="hover:bg-accent/50 py-0 transition-colors">
              <Link to={`/tenants/${t.id}`} className="flex items-center gap-3 p-4">
                <Avatar name={t.full_name} />
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

      {/* Large screens: a table, easier to scan with many tenants. */}
      {shown && shown.length > 0 && (
        <Card className="hidden overflow-hidden py-0 lg:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Tenant</th>
                <th scope="col" className="px-5 py-3 font-medium">Unit</th>
                <th scope="col" className="px-5 py-3 font-medium">Phone</th>
                <th scope="col" className="px-5 py-3 font-medium">Since</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Rent</th>
                <th scope="col" className="w-10"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tenants/${t.id}`)}
                  className="hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={t.full_name} small />
                      <Link
                        to={`/tenants/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold hover:underline"
                      >
                        {t.full_name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {t.units?.label}
                    <span className="text-muted-foreground"> · {t.units?.properties?.name}</span>
                  </td>
                  <td className="text-muted-foreground px-5 py-3 tabular-nums">{formatNgPhone(t.phone)}</td>
                  <td className="text-muted-foreground px-5 py-3">{formatDate(t.start_date)}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">
                    {formatKobo(t.rent_amount_kobo)}
                    <span className="text-muted-foreground font-normal">{rentPeriodPer(t.rent_period)}</span>
                  </td>
                  <td className="pr-4">
                    <ChevronRight className="text-muted-foreground size-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-secondary text-secondary-foreground grid shrink-0 place-items-center rounded-full font-semibold',
        small ? 'size-8 text-xs' : 'size-10 text-sm',
      )}
    >
      {initials(name)}
    </div>
  )
}
