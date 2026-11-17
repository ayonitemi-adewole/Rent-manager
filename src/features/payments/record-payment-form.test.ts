import { describe, expect, it } from 'vitest'
import { recordPaymentSchema, type RecordPaymentValues } from './record-payment-form'

const schema = recordPaymentSchema(35_000_000, '2026-11-17') // ₦350,000 owed
const valid: RecordPaymentValues = { amount: '350,000', method: 'cash', paidOn: '2026-11-17', note: '' }
const errors = (v: RecordPaymentValues) => schema.safeParse(v).error?.issues.map((i) => i.path.join('.')) ?? []

describe('recordPaymentSchema', () => {
  it('accepts paying the full balance today', () => expect(errors(valid)).toEqual([]))
  it('accepts a part payment', () => expect(errors({ ...valid, amount: '100000' })).toEqual([]))
  it('rejects more than owed', () => expect(errors({ ...valid, amount: '350,000.01' })).toEqual(['amount']))
  it('rejects zero', () => expect(errors({ ...valid, amount: '0' })).toContain('amount'))
  it('rejects a future date', () => expect(errors({ ...valid, paidOn: '2026-11-18' })).toEqual(['paidOn']))
  it('accepts a past date', () => expect(errors({ ...valid, paidOn: '2026-01-05' })).toEqual([]))
})
