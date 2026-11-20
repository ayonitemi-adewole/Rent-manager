// Start a Paystack checkout for one of a tenant's rent charges.
// Used by pay-checkout (the tenant's payment page) and the WhatsApp bot ("Pay rent").
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { requireEnv, UserError } from './http.ts'
import { initializeTransaction } from './paystack.ts'

type TenantRow = {
  id: string
  full_name: string
  phone: string
  units: {
    label: string
    properties: {
      name: string
      landlords: { name_for_tenants: string; paystack_subaccount_code: string | null }
    }
  }
}

/** Returns the Paystack checkout URL. Throws UserError with a tenant-safe message. */
export async function startCheckout(admin: SupabaseClient, token: string, chargeId: string): Promise<string> {
  if (!token || token.length < 20 || !chargeId) throw new UserError('This payment link is not valid.', 404)

  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, full_name, phone, units(label, properties(name, landlords(name_for_tenants, paystack_subaccount_code)))')
    .eq('access_token', token)
    .maybeSingle<TenantRow>()
  if (error) throw error
  if (!tenant) throw new UserError('This payment link is not valid.', 404)

  const landlord = tenant.units.properties.landlords
  if (!landlord.paystack_subaccount_code) {
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

  // RentPadi's fee on this payment. ₦0 during the pilot; the Padi Free fee (PRICING.md step 3) is
  // worked out here from the landlord's plan and also sent to Paystack as transaction_charge.
  const platformFeeKobo = 0

  const reference = `RP-${crypto.randomUUID()}`
  const { error: attemptError } = await admin.from('payment_attempts').insert({
    charge_id: charge.id,
    tx_ref: reference,
    amount_kobo: balanceKobo,
    gateway: 'paystack',
    platform_fee_kobo: platformFeeKobo,
  })
  if (attemptError) throw attemptError

  const appUrl = requireEnv('APP_URL').replace(/\/$/, '')
  const phoneDigits = tenant.phone.replace(/^\+/, '')
  // Paystack requires an email; tenants often don't have one. Receipts go by SMS and WhatsApp instead.
  const emailDomain = Deno.env.get('TENANT_EMAIL_DOMAIN') ?? 'tenants.rentpadi.app'

  return await initializeTransaction({
    reference,
    amountKobo: balanceKobo,
    email: `${phoneDigits}@${emailDomain}`,
    // Paystack adds ?trxref=…&reference=… to the callback.
    callbackUrl: `${appUrl}/t/${token}/paid`,
    cancelUrl: `${appUrl}/t/${token}/paid?status=cancelled`,
    subaccountCode: landlord.paystack_subaccount_code,
    metadata: { charge_id: charge.id, tenant_id: tenant.id },
    customFields: [
      { display_name: 'Tenant', variable_name: 'tenant', value: tenant.full_name },
      { display_name: 'Unit', variable_name: 'unit', value: `${tenant.units.label}, ${tenant.units.properties.name}` },
      { display_name: 'Rent period', variable_name: 'period', value: `${charge.period_start} to ${charge.period_end}` },
      { display_name: 'Landlord', variable_name: 'landlord', value: landlord.name_for_tenants },
    ],
  })
}
