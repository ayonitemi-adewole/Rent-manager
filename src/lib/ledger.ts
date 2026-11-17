// A tenant's statement: rent charged (+) and payments (−) in date order with a running balance.

type LedgerCharge = { id: string; due_date: string; period_start: string; period_end: string; amount_kobo: number }
type LedgerPayment = {
  id: string
  paid_at: string
  amount_kobo: number
  method: string
  receipt_number: string | null
  voided_at: string | null
}

export type LedgerEntry = {
  id: string
  date: string // yyyy-MM-dd
  kind: 'charge' | 'payment'
  chargeKobo: number
  paidKobo: number
  balanceKobo: number
  charge?: LedgerCharge
  payment?: LedgerPayment
}

/** Voided payments are left out. Same day: the charge comes before the payment. */
export function buildLedger(charges: LedgerCharge[], payments: LedgerPayment[]): LedgerEntry[] {
  const entries: Omit<LedgerEntry, 'balanceKobo'>[] = [
    ...charges.map((c) => ({
      id: `c-${c.id}`,
      date: c.due_date,
      kind: 'charge' as const,
      chargeKobo: c.amount_kobo,
      paidKobo: 0,
      charge: c,
    })),
    ...payments
      .filter((p) => p.voided_at === null)
      .map((p) => ({
        id: `p-${p.id}`,
        date: p.paid_at.slice(0, 10),
        kind: 'payment' as const,
        chargeKobo: 0,
        paidKobo: p.amount_kobo,
        payment: p,
      })),
  ]

  entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === b.kind ? 0 : a.kind === 'charge' ? -1 : 1) ||
      (a.payment?.paid_at ?? '').localeCompare(b.payment?.paid_at ?? ''),
  )

  let balance = 0
  return entries.map(({ id, date, kind, chargeKobo, paidKobo, charge, payment }) => {
    balance += chargeKobo - paidKobo
    return { id, date, kind, chargeKobo, paidKobo, balanceKobo: balance, charge, payment }
  })
}
