import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TablesInsert, TablesUpdate } from '@/types/database'

// Every portfolio query key starts with 'portfolio' so one invalidation refreshes them all.
export const portfolioKeys = {
  all: ['portfolio'] as const,
  properties: ['portfolio', 'properties'] as const,
  property: (id: string) => ['portfolio', 'property', id] as const,
  unit: (id: string) => ['portfolio', 'unit', id] as const,
}

function useInvalidatePortfolio() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: portfolioKeys.all })
}

// ───────────── properties ─────────────

export function useProperties() {
  return useQuery({
    queryKey: portfolioKeys.properties,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, address, units(id, tenants(id, status))')
        .order('created_at')
      if (error) throw error
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        unitCount: p.units.length,
        occupiedCount: p.units.filter((u) => u.tenants.some((t) => t.status === 'active')).length,
      }))
    },
  })
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: portfolioKeys.property(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*, units(*, tenants(id, full_name, status))')
        .eq('id', id)
        .order('label', { referencedTable: 'units' })
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        ...data,
        units: data.units.map(({ tenants, ...unit }) => ({
          ...unit,
          activeTenant: tenants.find((t) => t.status === 'active') ?? null,
        })),
      }
    },
  })
}

export function useCreateProperty() {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async (values: Omit<TablesInsert<'properties'>, 'landlord_id'>) => {
      const { data, error } = await supabase.from('properties').insert(values).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateProperty(id: string) {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async (values: TablesUpdate<'properties'>) => {
      const { error } = await supabase.from('properties').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteProperty(id: string) {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('properties').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// ───────────── units ─────────────

export function useUnit(id: string) {
  return useQuery({
    queryKey: portfolioKeys.unit(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCreateUnit() {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async (values: TablesInsert<'units'>) => {
      const { error } = await supabase.from('units').insert(values)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateUnit(id: string) {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async (values: TablesUpdate<'units'>) => {
      const { error } = await supabase.from('units').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteUnit(id: string) {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('units').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
