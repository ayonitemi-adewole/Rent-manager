import { z } from 'zod'
import { parseNairaToKobo } from '@/lib/money'
import { normalizeNgPhone } from '@/lib/phone'
import { RENT_PERIODS, type RentPeriod } from '@/lib/rent'

export const tenantFormSchema = z
  .object({
    unitId: z.string().min(1, 'Choose the unit this tenant lives in'),
    fullName: z.string().trim().min(2, 'Enter the tenant’s full name').max(100),
    phone: z.string().refine((v) => normalizeNgPhone(v) !== null, 'Enter a valid Nigerian phone number'),
    startDate: z.iso.date('Choose the date their tenancy started'),
    rent: z.string().refine((v) => (parseNairaToKobo(v) ?? 0) > 0, 'Enter the rent in naira, e.g. 350,000'),
    rentPeriod: z.enum(RENT_PERIODS.map((p) => p.value) as [RentPeriod, ...RentPeriod[]]),
    paidUntil: z.union([z.literal(''), z.iso.date()]),
    remindersEnabled: z.boolean(),
  })
  .refine((v) => !v.paidUntil || v.paidUntil >= v.startDate, {
    path: ['paidUntil'],
    message: 'Must be on or after the start date',
  })

export type TenantFormValues = z.infer<typeof tenantFormSchema>

/** Form values → database columns (unit_id handled by the caller). */
export function tenantFormToRow(v: TenantFormValues) {
  return {
    full_name: v.fullName,
    phone: normalizeNgPhone(v.phone)!,
    start_date: v.startDate,
    rent_amount_kobo: parseNairaToKobo(v.rent)!,
    rent_period: v.rentPeriod,
    paid_until: v.paidUntil || null,
    reminders_enabled: v.remindersEnabled,
  }
}

export type UnitOption = {
  id: string
  label: string
  rent_amount_kobo: number
  rent_period: RentPeriod
  properties: { id: string; name: string } | null
}
