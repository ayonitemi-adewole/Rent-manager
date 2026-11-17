import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import { buildLedger } from './ledger'

const charge = (id: string, due: string, amount: number) => ({
  id,
  due_date: due,
  period_start: due,
  period_end: due,
  amount_kobo: amount,
})
const payment = (id: string, paidAt: string, amount: number, voided = false) => ({
  id,
  paid_at: paidAt,
  amount_kobo: amount,
  method: 'cash',
  receipt_number: null,
  voided_at: voided ? '2026-11-20T00:00:00Z' : null,
})

describe('buildLedger', () => {
  it('orders by date and keeps a running balance', () => {
    const ledger = buildLedger(
      [charge('dec', '2026-12-01', 1000), charge('nov', '2026-11-01', 1000)],
      [payment('p1', '2026-11-05T10:00:00Z', 600), payment('p2', '2026-11-20T10:00:00Z', 400)],
    )
    expect(ledger.map((e) => [e.id, e.balanceKobo])).toEqual([
      ['c-nov', 1000],
      ['p-p1', 400],
      ['p-p2', 0],
      ['c-dec', 1000],
    ])
  })

  it('puts a charge before a payment on the same day', () => {
    const ledger = buildLedger([charge('nov', '2026-11-01', 1000)], [payment('p', '2026-11-01T08:00:00Z', 1000)])
    expect(ledger.map((e) => e.kind)).toEqual(['charge', 'payment'])
    expect(ledger.at(-1)?.balanceKobo).toBe(0)
  })

  it('ignores voided payments', () => {
    const ledger = buildLedger([charge('nov', '2026-11-01', 1000)], [payment('p', '2026-11-02T08:00:00Z', 1000, true)])
    expect(ledger).toHaveLength(1)
    expect(ledger[0].balanceKobo).toBe(1000)
  })
})

describe('toCsv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['line\nbreak', 5]])).toBe(
      'a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",5\r\n',
    )
  })
  it('neutralises spreadsheet formulas but keeps numbers', () => {
    expect(toCsv(['a'], [['=SUM(A1)'], [-5], [null]])).toBe("a\r\n'=SUM(A1)\r\n-5\r\n\r\n")
  })
})
