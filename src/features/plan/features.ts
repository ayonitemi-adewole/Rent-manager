import { formatKobo } from '@/lib/money'
import type { Entitlements } from './api'

export type PlanFeature = {
  label: string
  included: boolean
  /** Part of the plan but not built yet. */
  soon?: boolean
}

/** What a plan includes, in plain words, for the Settings → Plan card. */
export function planFeatures(e: Entitlements): PlanFeature[] {
  const units =
    e.unit_limit === null
      ? { label: `${e.units_used} ${e.units_used === 1 ? 'unit' : 'units'}, no limit`, included: true }
      : {
          label:
            `${e.units_used} of ${e.unit_limit} units used` +
            (e.extra_unit_price_kobo ? `, then ${formatKobo(e.extra_unit_price_kobo)} a month per extra unit` : ''),
          included: true,
        }

  const fee =
    e.platform_fee_bps === 0
      ? { label: 'No RentPadi fee on rent', included: true }
      : {
          label:
            `RentPadi keeps ${e.platform_fee_bps / 100}% of rent paid online` +
            (e.platform_fee_cap_kobo !== null ? `, max ${formatKobo(e.platform_fee_cap_kobo)} per rent bill` : ''),
          included: true,
        }

  return [
    units,
    fee,
    {
      label:
        e.sms_reminders_per_bill === null
          ? 'Full SMS reminder schedule'
          : `${e.sms_reminders_per_bill} SMS ${e.sms_reminders_per_bill === 1 ? 'reminder' : 'reminders'} per rent bill`,
      included: true,
    },
    { label: 'WhatsApp reminders', included: e.whatsapp_reminders },
    { label: 'Your name on receipts', included: e.branded_receipts, soon: true },
    { label: 'Your own reminder schedule and wording', included: e.custom_reminders, soon: true },
    { label: 'Agreements and quit notices', included: e.documents, soon: true },
    { label: 'Full PDF statements and reports', included: e.full_reports, soon: true },
    {
      label: e.caretakers > 0 ? `Up to ${e.caretakers} caretaker ${e.caretakers === 1 ? 'account' : 'accounts'}` : 'Caretaker accounts',
      included: e.caretakers > 0,
      soon: true,
    },
  ]
}
