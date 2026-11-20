import { Building2, ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useProperties } from './api'

export function PropertiesPage() {
  const { data: properties, isPending, error, refetch } = useProperties()

  return (
    <>
      <PageHeader
        title="Properties"
        action={
          properties?.length ? (
            <Button asChild size="sm">
              <Link to="/properties/new" data-tour="add-property">
                <Plus /> Add
              </Link>
            </Button>
          ) : undefined
        }
      />
      <QueryState isPending={isPending} error={error} refetch={refetch} />

      {properties?.length === 0 && (
        <EmptyState
          icon={Building2}
          title="Add your first property"
          description="A property is a building or compound. You'll add its rooms, flats or shops next."
          action={
            <Button asChild>
              <Link to="/properties/new" data-tour="add-property">
                <Plus /> Add property
              </Link>
            </Button>
          }
        />
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {properties?.map((p, i) => (
          <li key={p.id}>
            <Card className="hover:border-primary/40 h-full py-0 transition-[border-color,box-shadow] hover:shadow-md">
              <Link
                to={`/properties/${p.id}`}
                data-tour={i === 0 ? 'property-card' : undefined}
                className="flex h-full flex-col gap-4 p-4 lg:p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-secondary text-secondary-foreground grid size-10 shrink-0 place-items-center rounded-lg">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    {p.address && <p className="text-muted-foreground truncate text-sm">{p.address}</p>}
                  </div>
                  <ChevronRight className="text-muted-foreground size-5 shrink-0" />
                </div>
                <Occupancy units={p.unitCount} occupied={p.occupiedCount} />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}

/** "4 of 6 occupied" with a bar, so empty units stand out. */
function Occupancy({ units, occupied }: { units: number; occupied: number }) {
  if (units === 0) return <p className="text-muted-foreground mt-auto text-xs">No units yet. Open it to add some.</p>
  const vacant = units - occupied
  return (
    <div className="mt-auto space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">
          {occupied} of {units} {units === 1 ? 'unit' : 'units'} occupied
        </span>
        {vacant > 0 && <span className="dark:text-warning font-medium text-amber-700">{vacant} vacant</span>}
      </div>
      <div
        className="bg-muted h-1.5 overflow-hidden rounded-full"
        role="meter"
        aria-label="Units occupied"
        aria-valuemin={0}
        aria-valuemax={units}
        aria-valuenow={occupied}
      >
        <div className="bg-primary h-full rounded-full" style={{ width: `${(occupied / units) * 100}%` }} />
      </div>
    </div>
  )
}
