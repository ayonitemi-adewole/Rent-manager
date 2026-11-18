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

      <ul className="space-y-3">
        {properties?.map((p, i) => (
          <li key={p.id}>
            <Card className="hover:bg-accent/50 py-0 transition-colors">
              <Link
                to={`/properties/${p.id}`}
                data-tour={i === 0 ? 'property-card' : undefined}
                className="flex items-center gap-3 p-4"
              >
                <div className="bg-secondary text-secondary-foreground grid size-10 shrink-0 place-items-center rounded-lg">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  {p.address && <p className="text-muted-foreground truncate text-sm">{p.address}</p>}
                  <p className="text-muted-foreground text-xs">
                    {p.unitCount} {p.unitCount === 1 ? 'unit' : 'units'} · {p.occupiedCount} occupied
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}
