// Turning a Flutterwave transaction into a recorded payment. Shared by the webhook and the
// redirect-page verification, so both paths apply exactly the same checks.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { VerifiedTransaction } from './flutterwave.ts'

export type SettleResult =
  | { outcome: 'recorded'; paymentId: string; chargeId: string }
  | { outcome: 'pending' }
  | { outcome: 'failed'; reason: string }
  | { outcome: 'ignored'; reason: string }

type Attempt = { id: string; charge_id: string; amount_kobo: number; status: string }

/**
 * `tx` MUST come from Flutterwave's verify endpoint, not from a webhook body.
 * Safe to call any number of times for the same transaction.
 */
export async function settleTransaction(admin: SupabaseClient, tx: VerifiedTransaction): Promise<SettleResult> {
  const { data: attempt, error } = await admin
    .from('payment_attempts')
    .select('id, charge_id, amount_kobo, status')
    .eq('tx_ref', tx.tx_ref)
    .maybeSingle<Attempt>()
  if (error) throw error
  if (!attempt) return { outcome: 'ignored', reason: `unknown tx_ref ${tx.tx_ref}` }

  if (tx.status !== 'successful') {
    if (tx.status === 'failed') {
      await markAttempt(admin, attempt.id, 'failed', tx.id, `Flutterwave status: ${tx.status}`)
      return { outcome: 'failed', reason: 'The payment did not go through.' }
    }
    return { outcome: 'pending' }
  }

  const paidKobo = Math.round(tx.amount * 100)
  if (tx.currency !== 'NGN') {
    await markAttempt(admin, attempt.id, 'failed', tx.id, `currency ${tx.currency}`)
    return { outcome: 'failed', reason: 'Payment was not in naira.' }
  }
  if (paidKobo < attempt.amount_kobo) {
    // Never silently accept less than was asked for. Flag for a human to look at.
    await markAttempt(admin, attempt.id, 'failed', tx.id, `amount ${paidKobo} < expected ${attempt.amount_kobo}`)
    return { outcome: 'failed', reason: 'The amount paid does not match. Please contact your landlord.' }
  }

  const { data: paymentId, error: rpcError } = await admin.rpc('record_payment', {
    p_charge_id: attempt.charge_id,
    p_amount_kobo: paidKobo,
    p_method: 'link',
    p_reference: tx.tx_ref,
    p_flw_transaction_id: tx.id,
    p_paid_at: tx.created_at,
  })
  if (rpcError) throw rpcError

  await markAttempt(admin, attempt.id, 'successful', tx.id, null)
  return { outcome: 'recorded', paymentId: paymentId as string, chargeId: attempt.charge_id }
}

async function markAttempt(
  admin: SupabaseClient,
  id: string,
  status: 'successful' | 'failed',
  flwTransactionId: number,
  failureReason: string | null,
) {
  const { error } = await admin
    .from('payment_attempts')
    .update({ status, flw_transaction_id: flwTransactionId, failure_reason: failureReason })
    .eq('id', id)
  if (error) throw error
}
