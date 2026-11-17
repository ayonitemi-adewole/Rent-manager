import { describe, expect, it } from 'vitest'
import { bucketCharges, dueLabel, type Charge } from './charges'

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
      charge({ id: 'late-3', timing: 'overdue', days_until_due: -3, balance_kobo: 500 }),
      charge({ id: 'late-40', timing: 'overdue', days_until_due: -40, balance_kobo: 1_000 }),
      charge({ id: 'soon-20', timing: 'due_soon', days_until_due: 20, balance_kobo: 300 }),
      charge({ id: 'soon-2', timing: 'due_soon', days_until_due: 2, balance_kobo: 200 }),
      charge({ id: 'later', timing: 'upcoming', days_until_due: 44 }),
    ]
    const { overdue, dueSoon } = bucketCharges(charges)

    expect(overdue.charges.map((c) => c.id)).toEqual(['late-40', 'late-3'])
    expect(overdue).toMatchObject({ count: 2, totalKobo: 1_500 })
    expect(dueSoon.charges.map((c) => c.id)).toEqual(['soon-2', 'soon-20'])
    expect(dueSoon).toMatchObject({ count: 2, totalKobo: 500 })
  })

  it('uses the remaining balance for partly paid charges', () => {
    const { overdue } = bucketCharges([
      charge({ timing: 'overdue', amount_kobo: 1_000, amount_paid_kobo: 400, balance_kobo: 600 }),
    ])
    expect(overdue.totalKobo).toBe(600)
  })
})
