import { useQuery } from '@tanstack/react-query'
import { portfolioKeys } from '@/features/properties/api'
import { toCharge } from '@/lib/charges'
import { supabase } from '@/lib/supabase'

// Under 'portfolio' so tenant edits (which rebuild charges) refresh these too.
const chargeKeys = {
  open: [...portfolioKeys.all, 'charges', 'open'] as const,
  tenant: (tenantId: string) => [...portfolioKeys.all, 'charges', 'tenant', tenantId] as const,
}

/** Overdue and due-within-30-days charges across all the landlord's tenants. */
export function useOpenCharges() {
  return useQuery({
    queryKey: chargeKeys.open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_overview')
        .select('*')
        .in('timing', ['overdue', 'due_soon'])
        .order('due_date')
      if (error) throw error
      return data.map(toCharge)
    },
  })
}

/** All of one tenant's charges, newest period first (cancelled ones hidden). */
export function useTenantCharges(tenantId: string) {
  return useQuery({
    queryKey: chargeKeys.tenant(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_overview')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('status', 'cancelled')
        .order('period_start', { ascending: false })
      if (error) throw error
      return data.map(toCharge)
    },
  })
}
