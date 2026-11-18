// Tenant taps "Pay": create a payment attempt and a Flutterwave checkout link for what's owed.
// Public (no login): the tenant's secret link token is the credential. Body: { token, charge_id }
import { startCheckout } from '../_shared/checkout.ts'
import { handler, json, readJson } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'

type Body = { token?: string; charge_id?: string }

Deno.serve(
  handler(async (req) => {
    const { token = '', charge_id: chargeId = '' } = await readJson<Body>(req)
    return json({ link: await startCheckout(adminClient(), token, chargeId) })
  }),
)
