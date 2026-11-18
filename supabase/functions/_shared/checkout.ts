// Start a Flutterwave checkout for one of a tenant's rent charges.
// Used by flw-checkout (the tenant's payment page) and the WhatsApp bot ("Pay rent").
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { createPaymentLink } from './flutterwave.ts'
import { requireEnv, UserError } from './http.ts'

type TenantRow = {
  id: string
  full_name: string
  phone: string
  units: {
    label: string
    properties: { name: string; landlords: { name_for_tenants: string; flw_subaccount_id: string | null } }
  }
}

/** Returns the Flutterwave checkout URL. Throws UserError with a tenant-safe message. */
export async function startCheckout(admin: SupabaseClient, token: string, chargeId: string): Promise<string> {
  if (!token || token.length < 20 || !chargeId) throw new UserError('This payment link is not valid.', 404)

  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, full_name, phone, units(label, properties(name, landlords(name_for_tenants, flw_subaccount_id)))')
    .eq('access_token', token)
    .maybeSingle<TenantRow>()
  if (error) throw error
  if (!tenant) throw new UserError('This payment link is not valid.', 404)

  const landlord = tenant.units.properties.landlords
  if (!landlord.flw_subaccount_id) {
    throw new UserError('Your landlord has not set up online payment yet. Please contact them.')
  }

  const { data: charge, error: chargeError } = await admin
    .from('rent_charges')
    .select('id, period_start, period_end, amount_kobo, amount_paid_kobo, status')
    .eq('id', chargeId)
    .eq('tenant_id', tenant.id) // the charge must belong to this link's tenant
    .maybeSingle()
  if (chargeError) throw chargeError
  if (!charge || charge.status === 'cancelled') throw new UserError('That rent charge was not found.', 404)

  const balanceKobo = charge.amount_kobo - charge.amount_paid_kobo
  if (charge.status === 'paid' || balanceKobo <= 0) throw new UserError('This rent is already paid.')

  // Rent is paid in order (same rule as public.earlier_open_charge_due).
  const { data: earlier, error: earlierError } = await admin.rpc('earlier_open_charge_due', {
    p_charge_id: charge.id,
  })
  if (earlierError) throw earlierError
  if (earlier) throw new UserError(`Please pay the earlier rent (due ${earlier}) first.`)

  const txRef = `RP-${crypto.randomUUID()}`
  const { error: attemptError } = await admin
    .from('payment_attempts')
    .insert({ charge_id: charge.id, tx_ref: txRef, amount_kobo: balanceKobo })
  if (attemptError) throw attemptError

  const appUrl = requireEnv('APP_URL').replace(/\/$/, '')
  const phoneDigits = tenant.phone.replace(/^\+/, '')
  // Flutterwave requires an email; tenants often don't have one. Receipts go by SMS instead.
  const emailDomain = Deno.env.get('TENANT_EMAIL_DOMAIN') ?? 'tenants.rentpadi.app'

  return await createPaymentLink({
    txRef,
    amountNaira: balanceKobo / 100,
    redirectUrl: `${appUrl}/t/${token}/paid`,
    subaccountId: landlord.flw_subaccount_id,
    customer: { name: tenant.full_name, phone: phoneDigits, email: `${phoneDigits}@${emailDomain}` },
    title: `Rent: ${tenant.units.label}`,
    description: `${tenant.units.properties.name} · ${charge.period_start} to ${charge.period_end} · to ${landlord.name_for_tenants}`,
    meta: { charge_id: charge.id },
  })
}
