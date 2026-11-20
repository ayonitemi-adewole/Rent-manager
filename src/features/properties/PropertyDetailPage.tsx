import { DoorOpen, Pencil, Plus, UserPlus } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatKobo } from '@/lib/money'
import { rentPeriodPer, unitTypeLabel } from '@/lib/rent'
import { useProperty } from './api'

export function PropertyDetailPage() {
  const { propertyId = '' } = useParams()
  const { data: property, isPending, error, refetch } = useProperty(propertyId)

  return (
    <>
      <PageHeader
        title={property?.name ?? 'Property'}
        subtitle={property?.address ?? undefined}
        back={{ to: '/properties', label: 'Properties' }}
        action={
          property && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/properties/${propertyId}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )
        }
      />
      <QueryState isPending={isPending} error={error} refetch={refetch} />
      {property === null && <p className="text-sm">Property not found.</p>}

      {property && property.units.length > 0 && (
        <dl className="mb-6 grid grid-cols-3 gap-3 lg:max-w-xl">
          <Stat label="Units" value={property.units.length} />
          <Stat label="Occupied" value={property.units.filter((u) => u.activeTenant).length} />
          <Stat label="Vacant" value={property.units.filter((u) => !u.activeTenant).length} />
        </dl>
      )}

      {property && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Units ({property.units.length})</h2>
            {property.units.length > 0 && (
              <Button asChild size="sm" variant="secondary">
                <Link to={`/properties/${propertyId}/units/new`} data-tour="add-unit">
                  <Plus /> Add unit
                </Link>
              </Button>
            )}
          </div>

          {property.units.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No units yet"
              description="Add each room, flat or shop you rent out in this property, with its rent."
              action={
                <Button asChild>
                  <Link to={`/properties/${propertyId}/units/new`} data-tour="add-unit">
                    <Plus /> Add unit
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-2 md:grid-cols-2 lg:gap-3 xl:grid-cols-3">
              {property.units.map((unit) => (
                <li key={unit.id}>
                  <Card className="h-full gap-0 py-0">
                    <div className="flex items-start gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{unit.label}</p>
                          <span className="text-muted-foreground text-xs">{unitTypeLabel(unit.unit_type)}</span>
                        </div>
                        <p className="text-sm tabular-nums">
                          {formatKobo(unit.rent_amount_kobo)}
                          <span className="text-muted-foreground">{rentPeriodPer(unit.rent_period)}</span>
                        </p>
                        {unit.activeTenant ? (
                          <Link
                            to={`/tenants/${unit.activeTenant.id}`}
                            className="text-primary block truncate text-sm font-medium hover:underline"
                          >
                            {unit.activeTenant.full_name}
                          </Link>
                        ) : (
                          <Badge variant="outline">Vacant</Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {!unit.activeTenant && (
                          <Button asChild size="icon" variant="ghost" aria-label={`Add tenant to ${unit.label}`}>
                            <Link to={`/tenants/new?unit=${unit.id}`}>
                              <UserPlus />
                            </Link>
                          </Button>
                        )}
                        <Button asChild size="icon" variant="ghost" aria-label={`Edit ${unit.label}`}>
                          <Link to={`/properties/${propertyId}/units/${unit.id}/edit`}>
                            <Pencil />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-xl border px-4 py-3">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}
