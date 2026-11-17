import { Users } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

// Week 1: add tenants to vacant units; tenant detail + ledger come in Week 5.
export function TenantsPage() {
  return (
    <>
      <PageHeader title="Tenants" />
      <EmptyState
        icon={Users}
        title="No tenants yet"
        description="Once you've added a property and its units, you can add the tenant living in each one."
      />
    </>
  )
}
