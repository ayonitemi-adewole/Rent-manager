import { Building2, ChevronRight, MapPin, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useProperties } from './api'

export function PropertiesPage() {
  const { data: properties, isPending, error, refetch } = useProperties()
  const units = properties?.reduce((sum, p) => sum + p.unitCount, 0) ?? 0

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle={
          properties?.length
            ? `${properties.length} ${properties.length === 1 ? 'property' : 'properties'} · ${units} ${units === 1 ? 'unit' : 'units'}`
            : undefined
        }
        action={
          properties?.length ? (
            <Button asChild size="sm">
              <Link to="/properties/new" data-tour="add-property">
                <Plus /> Add<span className="hidden sm:inline"> property</span>
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

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {properties?.map((p, i) => (
          <li key={p.id}>
            <Card className="group hover:border-primary/30 hover:shadow-float h-full py-0 transition-[border-color,box-shadow,translate] motion-safe:hover:-translate-y-0.5">
              <Link
                to={`/properties/${p.id}`}
                data-tour={i === 0 ? 'property-card' : undefined}
                className="flex h-full flex-col gap-5 rounded-xl p-4 lg:p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-secondary text-primary grid size-11 shrink-0 place-items-center rounded-lg">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}</p>
                    {p.address && (
                      <p className="text-muted-foreground flex items-center gap-1 truncate text-sm">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{p.address}</span>
                      </p>
                    )}
                  </div>
                  <ChevronRight className="text-muted-foreground mt-0.5 size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
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

/** Up to this many units, the bar shows one segment per unit. */
const SEGMENTS_UP_TO = 24

/** "4 of 6 occupied" with a bar, so empty units stand out. */
function Occupancy({ units, occupied }: { units: number; occupied: number }) {
  if (units === 0) return <p className="text-muted-foreground mt-auto text-xs">No units yet. Open it to add some.</p>
  const vacant = units - occupied
  return (
    <div className="mt-auto space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">
          <span className="figure text-foreground font-semibold">{occupied}</span> of{' '}
          <span className="figure">{units}</span> {units === 1 ? 'unit' : 'units'} occupied
        </span>
        {vacant > 0 && <span className="text-warning-foreground font-semibold">{vacant} vacant</span>}
      </div>
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        role="meter"
        aria-label="Units occupied"
        aria-valuemin={0}
        aria-valuemax={units}
        aria-valuenow={occupied}
      >
        {units <= SEGMENTS_UP_TO ? (
          Array.from({ length: units }, (_, i) => (
            <span key={i} className={cn('h-full flex-1', i < occupied ? 'bg-primary' : 'bg-warning/45')} />
          ))
        ) : (
          <>
            <span className="bg-primary h-full" style={{ width: `${(occupied / units) * 100}%` }} />
            <span className="bg-warning/45 h-full flex-1" />
          </>
        )}
      </div>
    </div>
  )
}
