import { z } from 'zod'
import { parseNairaToKobo } from '@/lib/money'
import { normalizeNgPhone, normalizeWhatsappPhone } from '@/lib/phone'
import { RENT_PERIODS, type RentPeriod } from '@/lib/rent'

export const tenantFormSchema = z
  .object({
    unitId: z.string().min(1, 'Choose the unit this tenant lives in'),
    fullName: z.string().trim().min(2, 'Enter the tenant’s full name').max(100),
    phone: z.string().refine((v) => normalizeNgPhone(v) !== null, 'Enter a valid Nigerian phone number'),
    whatsapp: z
      .string()
      .refine(
        (v) => v.trim() === '' || normalizeWhatsappPhone(v) !== null,
        'Enter a Nigerian number, or an international one starting with + and the country code',
      ),
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

/** Only stored when it's a different number from the calling one. */
function whatsappToStore(v: TenantFormValues): string | null {
  const whatsapp = v.whatsapp.trim() ? normalizeWhatsappPhone(v.whatsapp) : null
  return whatsapp && whatsapp !== normalizeNgPhone(v.phone) ? whatsapp : null
}

/** Form values → database columns (unit_id handled by the caller). */
export function tenantFormToRow(v: TenantFormValues) {
  return {
    full_name: v.fullName,
    phone: normalizeNgPhone(v.phone)!,
    whatsapp_phone: whatsappToStore(v),
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
