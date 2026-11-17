// Called by the page Flutterwave redirects the tenant back to. Confirms the payment with
// Flutterwave and records it, so the tenant sees the result even if the webhook is slow.
// Public: the tenant link token must own the tx_ref. Body: { token, tx_ref, transaction_id? }
import { FlutterwaveError, verifyByReference, verifyTransaction } from '../_shared/flutterwave.ts'
import { handler, json, readJson, UserError } from '../_shared/http.ts'
import { settleTransaction } from '../_shared/settle.ts'
import { adminClient } from '../_shared/supabase.ts'

type Body = { token?: string; tx_ref?: string; transaction_id?: string | number }

Deno.serve(
  handler(async (req) => {
    const { token, tx_ref: txRef, transaction_id: rawId } = await readJson<Body>(req)
    if (!token || !txRef) throw new UserError('Missing payment details.')

    const admin = adminClient()

    // The tx_ref must belong to a charge of the tenant this link is for.
    const { data: attempt, error } = await admin
      .from('payment_attempts')
      .select('id, status, rent_charges!inner(tenants!inner(access_token))')
      .eq('tx_ref', txRef)
      .eq('rent_charges.tenants.access_token', token)
      .maybeSingle()
    if (error) throw error
    if (!attempt) throw new UserError('Payment not found.', 404)
    if (attempt.status === 'successful') return json({ outcome: 'recorded' })

    const transactionId = Number(rawId)
    let tx
    try {
      tx = Number.isSafeInteger(transactionId) && transactionId > 0
        ? await verifyTransaction(transactionId)
        : await verifyByReference(txRef)
    } catch (err) {
      // Cancelled checkouts have no transaction at Flutterwave.
      if (err instanceof FlutterwaveError) return json({ outcome: 'not_found' })
      throw err
    }
    if (tx.tx_ref !== txRef) throw new UserError('Payment details do not match.')

    const result = await settleTransaction(admin, tx)
    return json(result.outcome === 'failed' ? { outcome: 'failed', reason: result.reason } : { outcome: result.outcome })
  }),
)
