import { z } from 'zod'
import { parseNairaToKobo } from '@/lib/money'

/** Build the schema for one charge: amount must be > 0 and ≤ what's still owed; date not in the future. */
export function recordPaymentSchema(balanceKobo: number, today: string) {
  return z.object({
    amount: z
      .string()
      .refine((v) => (parseNairaToKobo(v) ?? 0) > 0, 'Enter the amount received, e.g. 150,000')
      .refine((v) => (parseNairaToKobo(v) ?? 0) <= balanceKobo, 'That is more than what is owed for this period'),
    method: z.enum(['cash', 'transfer']),
    paidOn: z.iso.date('Choose the date you received it').refine((d) => d <= today, 'The date cannot be in the future'),
    note: z.string().trim().max(300),
  })
}

export type RecordPaymentValues = z.infer<ReturnType<typeof recordPaymentSchema>>
