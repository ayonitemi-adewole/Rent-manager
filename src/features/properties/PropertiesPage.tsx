import { Building2, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'

// Week 1: list / add / edit properties and their units.
export function PropertiesPage() {
  return (
    <>
      <PageHeader title="Properties" />
      <EmptyState
        icon={Building2}
        title="Add your first property"
        description="A property is a building or compound. You'll add its rooms, flats or shops next."
        action={
          <Button disabled>
            <Plus /> Add property
          </Button>
        }
      />
    </>
  )
}
