// Turning a Paystack transaction into a recorded payment. Shared by the webhook and the
// redirect-page verification, so both paths apply exactly the same checks.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { VerifiedTransaction } from './paystack.ts'

export type SettleResult =
  | { outcome: 'recorded'; paymentId: string; chargeId: string }
  | { outcome: 'pending' }
  | { outcome: 'failed'; reason: string }
  | { outcome: 'ignored'; reason: string }

type Attempt = { id: string; charge_id: string; amount_kobo: number; status: string; platform_fee_kobo: number }

/** Final states where no money moved. "abandoned" is not final: the tenant may still pay on the same checkout. */
const FAILED = new Set(['failed', 'reversed'])

/**
 * `tx` MUST come from Paystack's verify endpoint, not from a webhook body.
 * Safe to call any number of times for the same transaction.
 */
export async function settleTransaction(admin: SupabaseClient, tx: VerifiedTransaction): Promise<SettleResult> {
  const { data: attempt, error } = await admin
    .from('payment_attempts')
    .select('id, charge_id, amount_kobo, status, platform_fee_kobo')
    .eq('tx_ref', tx.reference)
    .maybeSingle<Attempt>()
  if (error) throw error
  if (!attempt) return { outcome: 'ignored', reason: `unknown reference ${tx.reference}` }

  if (tx.status !== 'success') {
    if (FAILED.has(tx.status)) {
      await markAttempt(admin, attempt.id, 'failed', tx.id, `Paystack status: ${tx.status}`)
      return { outcome: 'failed', reason: 'The payment did not go through.' }
    }
    if (tx.status === 'abandoned') return { outcome: 'failed', reason: 'The payment was not completed.' }
    return { outcome: 'pending' }
  }

  if (tx.currency !== 'NGN') {
    await markAttempt(admin, attempt.id, 'failed', tx.id, `currency ${tx.currency}`)
    return { outcome: 'failed', reason: 'Payment was not in naira.' }
  }
  if (tx.amount < attempt.amount_kobo) {
    // Never silently accept less than was asked for. Flag for a human to look at.
    await markAttempt(admin, attempt.id, 'failed', tx.id, `amount ${tx.amount} < expected ${attempt.amount_kobo}`)
    return { outcome: 'failed', reason: 'The amount paid does not match. Please contact your landlord.' }
  }

  const { data: paymentId, error: rpcError } = await admin.rpc('record_payment', {
    p_charge_id: attempt.charge_id,
    p_amount_kobo: tx.amount,
    p_method: 'link',
    p_reference: tx.reference,
    p_gateway: 'paystack',
    p_gateway_transaction_id: tx.id,
    p_paid_at: tx.paid_at ?? tx.created_at,
    // Paystack's own figure; null if it didn't report one (never guessed).
    p_gateway_fee_kobo: typeof tx.fees === 'number' && tx.fees >= 0 ? Math.round(tx.fees) : null,
    // Fixed at checkout from the landlord's plan.
    p_platform_fee_kobo: attempt.platform_fee_kobo,
  })
  if (rpcError) throw rpcError

  await markAttempt(admin, attempt.id, 'successful', tx.id, null)
  return { outcome: 'recorded', paymentId: paymentId as string, chargeId: attempt.charge_id }
}

async function markAttempt(
  admin: SupabaseClient,
  id: string,
  status: 'successful' | 'failed',
  gatewayTransactionId: number,
  failureReason: string | null,
) {
  const { error } = await admin
    .from('payment_attempts')
    .update({ status, gateway_transaction_id: gatewayTransactionId, failure_reason: failureReason })
    .eq('id', id)
  if (error) throw error
}
