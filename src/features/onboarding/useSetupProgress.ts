import { useLandlord } from '@/features/landlord/api'
import { useProperties } from '@/features/properties/api'
import { useTenants } from '@/features/tenants/api'
import type { SetupProgress } from './tour-steps'

/** What the landlord has set up so far. null while loading. Refreshes as they add things. */
export function useSetupProgress(): SetupProgress | null {
  const landlord = useLandlord()
  const properties = useProperties()
  const tenants = useTenants('active')
  if (!landlord.data || !properties.data || !tenants.data) return null
  return {
    properties: properties.data.length,
    units: properties.data.reduce((sum, p) => sum + p.unitCount, 0),
    tenants: tenants.data.length,
    payout: Boolean(landlord.data.flw_subaccount_id),
  }
}
