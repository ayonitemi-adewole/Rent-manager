import { DoorOpen, Pencil, Plus, UserPlus } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { SectionHeader } from '@/components/SectionHeader'
import { StatTile } from '@/components/StatTile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { rentPeriodPer, unitTypeLabel } from '@/lib/rent'
import { cn } from '@/lib/utils'
import { useProperty } from './api'

export function PropertyDetailPage() {
  const { propertyId = '' } = useParams()
  const { data: property, isPending, error, refetch } = useProperty(propertyId)
  const occupied = property?.units.filter((u) => u.activeTenant).length ?? 0
  const vacant = (property?.units.length ?? 0) - occupied

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
        <div className="mb-6 grid grid-cols-3 gap-3 lg:mb-8 lg:max-w-2xl lg:gap-4">
          <StatTile label="Units" value={<span className="figure">{property.units.length}</span>} />
          <StatTile label="Occupied" value={<span className="figure">{occupied}</span>} />
          <StatTile
            label="Vacant"
            value={<span className={cn('figure', vacant > 0 && 'text-warning-foreground')}>{vacant}</span>}
          />
        </div>
      )}

      {property && (
        <section className="space-y-3">
          <SectionHeader
            title="Units"
            count={property.units.length}
            action={
              property.units.length > 0 && (
                <Button asChild size="sm" variant="secondary">
                  <Link to={`/properties/${propertyId}/units/new`} data-tour="add-unit">
                    <Plus /> Add unit
                  </Link>
                </Button>
              )
            }
          />

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
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {property.units.map((unit) => (
                <li key={unit.id}>
                  <Card
                    className={cn(
                      'h-full gap-0 py-0',
                      !unit.activeTenant && 'bg-card/70 border-warning/50 border-dashed shadow-none',
                    )}
                  >
                    <div className="flex items-start gap-3 p-4 pb-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div>
                          <p className="truncate font-bold">{unit.label}</p>
                          <p className="text-muted-foreground truncate text-xs">{unitTypeLabel(unit.unit_type)}</p>
                        </div>
                        <p className="text-sm">
                          <Money kobo={unit.rent_amount_kobo} className="font-semibold" />
                          <span className="text-muted-foreground">{rentPeriodPer(unit.rent_period)}</span>
                        </p>
                      </div>
                      <Button
                        asChild
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground -mt-1 -mr-1.5"
                        aria-label={`Edit ${unit.label}`}
                      >
                        <Link to={`/properties/${propertyId}/units/${unit.id}/edit`}>
                          <Pencil />
                        </Link>
                      </Button>
                    </div>
                    <div className="mt-auto border-t border-dashed px-4 py-3">
                      {unit.activeTenant ? (
                        <Link
                          to={`/tenants/${unit.activeTenant.id}`}
                          className="text-primary block truncate py-1 text-sm font-semibold hover:underline"
                        >
                          {unit.activeTenant.full_name}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="warning" dot>
                            Vacant
                          </Badge>
                          <Button asChild size="sm" variant="secondary" aria-label={`Add tenant to ${unit.label}`}>
                            <Link to={`/tenants/new?unit=${unit.id}`}>
                              <UserPlus /> Add tenant
                            </Link>
                          </Button>
                        </div>
                      )}
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
