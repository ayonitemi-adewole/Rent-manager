// Called by the page Paystack sends the tenant back to. Confirms the payment with Paystack and
// records it, so the tenant sees the result even if the webhook is slow.
// Public: the tenant link token must own the reference. Body: { token, reference }
import { handler, json, readJson, UserError } from '../_shared/http.ts'
import { PaystackError, verifyTransaction } from '../_shared/paystack.ts'
import { settleTransaction } from '../_shared/settle.ts'
import { adminClient } from '../_shared/supabase.ts'

type Body = { token?: string; reference?: string }

Deno.serve(
  handler(async (req) => {
    const { token, reference } = await readJson<Body>(req)
    if (!token || !reference) throw new UserError('Missing payment details.')

    const admin = adminClient()

    // The reference must belong to a charge of the tenant this link is for.
    const { data: attempt, error } = await admin
      .from('payment_attempts')
      .select('id, status, rent_charges!inner(tenants!inner(access_token))')
      .eq('tx_ref', reference)
      .eq('rent_charges.tenants.access_token', token)
      .maybeSingle()
    if (error) throw error
    if (!attempt) throw new UserError('Payment not found.', 404)
    if (attempt.status === 'successful') return json({ outcome: 'recorded' })

    let tx
    try {
      tx = await verifyTransaction(reference)
    } catch (err) {
      // Paystack answers "Transaction reference not found" for checkouts that were never paid.
      if (err instanceof PaystackError) return json({ outcome: 'not_found' })
      throw err
    }
    if (tx.reference !== reference) throw new UserError('Payment details do not match.')

    const result = await settleTransaction(admin, tx)
    return json(result.outcome === 'failed' ? { outcome: 'failed', reason: result.reason } : { outcome: result.outcome })
  }),
)
