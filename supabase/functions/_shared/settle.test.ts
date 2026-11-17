// Run: npx deno test supabase/functions/_shared/settle.test.ts
import { assertEquals } from 'jsr:@std/assert@1.0.13'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { VerifiedTransaction } from './flutterwave.ts'
import { settleTransaction } from './settle.ts'

type Attempt = { id: string; charge_id: string; amount_kobo: number; status: string }

/** Just enough of the Supabase client for settleTransaction, recording what it does. */
function fakeAdmin(attempt: Attempt | null) {
  const calls = { rpc: [] as unknown[], updates: [] as unknown[] }
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: attempt, error: null }) }) }),
      update: (values: unknown) => ({
        eq: () => {
          calls.updates.push(values)
          return Promise.resolve({ error: null })
        },
      }),
    }),
    rpc: (_name: string, args: unknown) => {
      calls.rpc.push(args)
      return Promise.resolve({ data: 'payment-1', error: null })
    },
  }
  return { admin: client as unknown as SupabaseClient, calls }
}

const attempt: Attempt = { id: 'att-1', charge_id: 'chg-1', amount_kobo: 35_000_000, status: 'pending' }
const tx = (over: Partial<VerifiedTransaction> = {}): VerifiedTransaction => ({
  id: 987,
  tx_ref: 'RP-abc',
  status: 'successful',
  amount: 350_000,
  currency: 'NGN',
  created_at: '2026-11-17T10:00:00Z',
  ...over,
})

Deno.test('records a successful, full-amount NGN payment', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  const result = await settleTransaction(admin, tx())
  assertEquals(result, { outcome: 'recorded', paymentId: 'payment-1', chargeId: 'chg-1' })
  assertEquals(calls.rpc, [{
    p_charge_id: 'chg-1',
    p_amount_kobo: 35_000_000,
    p_method: 'link',
    p_reference: 'RP-abc',
    p_flw_transaction_id: 987,
    p_paid_at: '2026-11-17T10:00:00Z',
  }])
  assertEquals(calls.updates, [{ status: 'successful', flw_transaction_id: 987, failure_reason: null }])
})

Deno.test('converts naira with kobo exactly (no float drift)', async () => {
  const { admin, calls } = fakeAdmin({ ...attempt, amount_kobo: 1_015 })
  await settleTransaction(admin, tx({ amount: 10.15 }))
  assertEquals((calls.rpc[0] as { p_amount_kobo: number }).p_amount_kobo, 1_015)
})

Deno.test('refuses an underpayment and records nothing', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  const result = await settleTransaction(admin, tx({ amount: 349_999 }))
  assertEquals(result.outcome, 'failed')
  assertEquals(calls.rpc.length, 0)
})

Deno.test('refuses a non-NGN payment', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  const result = await settleTransaction(admin, tx({ currency: 'USD' }))
  assertEquals(result.outcome, 'failed')
  assertEquals(calls.rpc.length, 0)
})

Deno.test('a failed transaction marks the attempt failed', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  const result = await settleTransaction(admin, tx({ status: 'failed' }))
  assertEquals(result.outcome, 'failed')
  assertEquals(calls.rpc.length, 0)
  assertEquals((calls.updates[0] as { status: string }).status, 'failed')
})

Deno.test('a pending transaction changes nothing', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  assertEquals(await settleTransaction(admin, tx({ status: 'pending' })), { outcome: 'pending' })
  assertEquals(calls.rpc.length + calls.updates.length, 0)
})

Deno.test('an unknown tx_ref is ignored', async () => {
  const { admin, calls } = fakeAdmin(null)
  assertEquals((await settleTransaction(admin, tx())).outcome, 'ignored')
  assertEquals(calls.rpc.length, 0)
})
