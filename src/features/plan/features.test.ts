import { describe, expect, it } from 'vitest'
import type { Entitlements } from './api'
import { planFeatures } from './features'

const pilot: Entitlements = {
  plan_code: 'pilot',
  plan_name: 'Pilot',
  subscription_status: 'none',
  current_period_end: null,
  unit_limit: null,
  extra_unit_price_kobo: null,
  units_used: 7,
  platform_fee_bps: 0,
  platform_fee_cap_kobo: null,
  whatsapp_reminders: true,
  sms_reminders_per_bill: null,
  branded_receipts: true,
  custom_reminders: true,
  documents: true,
  full_reports: true,
  caretakers: 5,
}

const free: Entitlements = {
  ...pilot,
  plan_code: 'padi_free',
  plan_name: 'Padi Free',
  unit_limit: 5,
  units_used: 3,
  platform_fee_bps: 100,
  platform_fee_cap_kobo: 200_000,
  whatsapp_reminders: false,
  sms_reminders_per_bill: 2,
  branded_receipts: false,
  custom_reminders: false,
  documents: false,
  full_reports: false,
  caretakers: 0,
}

const label = (features: ReturnType<typeof planFeatures>, start: string) => features.find((f) => f.label.startsWith(start))

describe('planFeatures', () => {
  it('pilot: everything included, no limit, no fee', () => {
    const f = planFeatures(pilot)
    expect(f[0].label).toBe('7 units, no limit')
    expect(f[1].label).toBe('No RentPadi fee on rent')
    expect(f[2].label).toBe('Full SMS reminder schedule')
    expect(f.every((x) => x.included)).toBe(true)
    expect(label(f, 'Up to 5 caretaker')).toBeTruthy()
  })

  it('Padi Free: unit limit, capped 1% fee, 2 SMS reminders, no WhatsApp reminders', () => {
    const f = planFeatures(free)
    expect(f[0].label).toBe('3 of 5 units used')
    expect(f[1].label).toBe('RentPadi keeps 1% of rent paid online, max ₦2,000 per rent bill')
    expect(f[2].label).toBe('2 SMS reminders per rent bill')
    expect(label(f, 'WhatsApp reminders')?.included).toBe(false)
    expect(label(f, 'Caretaker accounts')?.included).toBe(false)
  })

  it('Padi Pro: the price of each unit over the limit', () => {
    const f = planFeatures({ ...pilot, plan_code: 'padi_pro', unit_limit: 50, extra_unit_price_kobo: 20_000, units_used: 52 })
    expect(f[0].label).toBe('52 of 50 units used, then ₦200 a month per extra unit')
  })

  it('marks features that are not built yet', () => {
    const soon = planFeatures(pilot).filter((x) => x.soon).map((x) => x.label)
    expect(soon).toContain('Your name on receipts')
    expect(soon).not.toContain('WhatsApp reminders')
  })
})
