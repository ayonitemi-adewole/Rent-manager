import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portfolioKeys } from '@/features/properties/api'
import { supabase } from '@/lib/supabase'
import type { TablesInsert, TablesUpdate } from '@/types/database'

const tenantKeys = {
  list: (status: 'active' | 'moved_out') => [...portfolioKeys.all, 'tenants', status] as const,
  detail: (id: string) => [...portfolioKeys.all, 'tenant', id] as const,
  vacantUnits: [...portfolioKeys.all, 'vacant-units'] as const,
}

const UNIT_WITH_PROPERTY = 'units(id, label, property_id, properties(id, name))'

export function useTenants(status: 'active' | 'moved_out' = 'active') {
  return useQuery({
    queryKey: tenantKeys.list(status),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select(`id, full_name, phone, rent_amount_kobo, rent_period, start_date, ${UNIT_WITH_PROPERTY}`)
        .eq('status', status)
        .order('full_name')
      if (error) throw error
      return data
    },
  })
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: tenantKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select(`*, ${UNIT_WITH_PROPERTY}`)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Units with no active tenant, with their property, for the "add tenant" picker. */
export function useVacantUnits() {
  return useQuery({
    queryKey: tenantKeys.vacantUnits,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, label, rent_amount_kobo, rent_period, properties(id, name), tenants(status)')
        .order('label')
      if (error) throw error
      return data
        .filter((u) => !u.tenants.some((t) => t.status === 'active'))
        .map(({ tenants: _tenants, ...u }) => u)
    },
  })
}

function useInvalidatePortfolio() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: portfolioKeys.all })
}

export function useCreateTenant() {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async (values: TablesInsert<'tenants'>) => {
      const { data, error } = await supabase.from('tenants').insert(values).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateTenant(id: string) {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async (values: TablesUpdate<'tenants'>) => {
      const { error } = await supabase.from('tenants').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
