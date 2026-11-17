import { describe, expect, it } from 'vitest'
import { tenantFormSchema, tenantFormToRow, type TenantFormValues } from './tenant-form'

const valid: TenantFormValues = {
  unitId: 'unit-1',
  fullName: '  Tola Bakare ',
  phone: '0803 123 4567',
  startDate: '2026-01-31',
  rent: '350,000',
  rentPeriod: 'yearly',
  paidUntil: '',
  remindersEnabled: true,
}

const errorPaths = (v: TenantFormValues) =>
  tenantFormSchema.safeParse(v).error?.issues.map((i) => i.path.join('.')) ?? []

describe('tenantFormSchema', () => {
  it('accepts a valid tenant', () => {
    expect(errorPaths(valid)).toEqual([])
  })

  it.each([
    ['unitId', { unitId: '' }],
    ['fullName', { fullName: 'A' }],
    ['phone', { phone: '12345' }],
    ['startDate', { startDate: '' }],
    ['rent', { rent: '0' }],
    ['rent', { rent: 'abc' }],
  ] as const)('rejects bad %s', (path, patch) => {
    expect(errorPaths({ ...valid, ...patch })).toContain(path)
  })

  it('rejects paid-until before the start date', () => {
    expect(errorPaths({ ...valid, paidUntil: '2025-12-31' })).toEqual(['paidUntil'])
  })

  it('accepts paid-until on or after the start date', () => {
    expect(errorPaths({ ...valid, paidUntil: '2026-01-31' })).toEqual([])
  })
})

describe('tenantFormToRow', () => {
  it('normalises phone, converts rent to kobo and empties to null', () => {
    const parsed = tenantFormSchema.parse(valid)
    expect(tenantFormToRow(parsed)).toEqual({
      full_name: 'Tola Bakare',
      phone: '+2348031234567',
      start_date: '2026-01-31',
      rent_amount_kobo: 35_000_000,
      rent_period: 'yearly',
      paid_until: null,
      reminders_enabled: true,
    })
  })
})
