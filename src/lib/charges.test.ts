import { describe, expect, it } from 'vitest'
import { bucketCharges, dueLabel, firstOpenCharge, type Charge } from './charges'

describe('dueLabel', () => {
  it.each([
    [0, 'Due today'],
    [1, 'Due tomorrow'],
    [12, 'Due in 12 days'],
    [59, 'Due in 59 days'],
    [-1, '1 day late'],
    [-14, '14 days late'],
    [-60, '2 months late'],
    [-400, '13 months late'],
  ])('%i → %s', (days, label) => {
    expect(dueLabel(days)).toBe(label)
  })
})

const charge = (over: Partial<Charge>): Charge => ({
  id: crypto.randomUUID(),
  tenant_id: 't',
  tenant_name: 'Tola',
  tenant_phone: '+2348031234567',
  unit_id: 'u',
  unit_label: 'Room 1',
  property_id: 'p',
  property_name: 'Bodija',
  period_start: '2026-12-01',
  period_end: '2027-11-30',
  due_date: '2026-12-01',
  amount_kobo: 100_000_00,
  amount_paid_kobo: 0,
  balance_kobo: 100_000_00,
  status: 'unpaid',
  days_until_due: 10,
  timing: 'due_soon',
  ...over,
})

describe('bucketCharges', () => {
  it('splits by timing, totals balances and sorts most urgent first', () => {
    const charges = [
      charge({ tenant_id: 'a', timing: 'overdue', days_until_due: -3, balance_kobo: 500 }),
      charge({ tenant_id: 'b', timing: 'overdue', days_until_due: -40, balance_kobo: 1_000 }),
      charge({ tenant_id: 'c', timing: 'due_soon', days_until_due: 20, balance_kobo: 300 }),
      charge({ tenant_id: 'd', timing: 'due_soon', days_until_due: 2, balance_kobo: 200 }),
      charge({ tenant_id: 'e', timing: 'upcoming', days_until_due: 44 }),
    ]
    const { overdue, dueSoon } = bucketCharges(charges)

    expect(overdue.tenants.map((t) => t.tenantId)).toEqual(['b', 'a'])
    expect(overdue).toMatchObject({ count: 2, totalKobo: 1_500 })
    expect(dueSoon.tenants.map((t) => t.tenantId)).toEqual(['d', 'c'])
    expect(dueSoon).toMatchObject({ count: 2, totalKobo: 500 })
  })

  it('counts a monthly tenant with two rents due as one tenant', () => {
    const { dueSoon } = bucketCharges([
      charge({ id: 'jan', tenant_id: 'mama', timing: 'due_soon', days_until_due: 29, balance_kobo: 40_000 }),
      charge({ id: 'dec', tenant_id: 'mama', timing: 'due_soon', days_until_due: 0, balance_kobo: 40_000 }),
      charge({ id: 'other', tenant_id: 'tola', timing: 'due_soon', days_until_due: 10, balance_kobo: 5_000 }),
    ])
    expect(dueSoon).toMatchObject({ count: 2, totalKobo: 85_000 })
    expect(dueSoon.tenants.map((t) => [t.tenantId, t.totalKobo])).toEqual([
      ['mama', 80_000],
      ['tola', 5_000],
    ])
    expect(dueSoon.tenants[0].charges.map((c) => c.id)).toEqual(['dec', 'jan'])
  })

  it('uses the remaining balance for partly paid charges', () => {
    const { overdue } = bucketCharges([
      charge({ timing: 'overdue', amount_kobo: 1_000, amount_paid_kobo: 400, balance_kobo: 600 }),
    ])
    expect(overdue.totalKobo).toBe(600)
  })
})

describe('firstOpenCharge', () => {
  const c = (id: string, due_date: string, balance_kobo: number, status: Charge['status'] = 'unpaid') =>
    ({ id, due_date, balance_kobo, status })

  it('picks the earliest unpaid period, whatever the list order', () => {
    expect(firstOpenCharge([c('dec', '2026-12-17', 100), c('nov', '2026-11-17', 100)])?.id).toBe('nov')
  })
  it('skips paid and cancelled periods', () => {
    const charges = [c('oct', '2026-10-17', 0, 'paid'), c('nov', '2026-11-17', 100, 'cancelled'), c('dec', '2026-12-17', 100)]
    expect(firstOpenCharge(charges)?.id).toBe('dec')
  })
  it('a part-paid period still comes first', () => {
    expect(firstOpenCharge([c('dec', '2026-12-17', 100), c('nov', '2026-11-17', 40, 'partially_paid')])?.id).toBe('nov')
  })
  it('null when nothing is owed', () => {
    expect(firstOpenCharge([c('nov', '2026-11-17', 0, 'paid')])).toBeNull()
  })
})
