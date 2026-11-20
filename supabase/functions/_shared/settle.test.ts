// Run: npx deno test supabase/functions/_shared/settle.test.ts
import { assertEquals } from 'jsr:@std/assert@1.0.13'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { VerifiedTransaction } from './paystack.ts'
import { settleTransaction } from './settle.ts'

type Attempt = { id: string; charge_id: string; amount_kobo: number; status: string; platform_fee_kobo: number }

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

const attempt: Attempt = { id: 'att-1', charge_id: 'chg-1', amount_kobo: 35_000_000, status: 'pending', platform_fee_kobo: 0 }
const tx = (over: Partial<VerifiedTransaction> = {}): VerifiedTransaction => ({
  id: 987,
  reference: 'RP-abc',
  status: 'success',
  amount: 35_000_000, // Paystack amounts are kobo
  currency: 'NGN',
  paid_at: '2026-11-17T10:00:05Z',
  created_at: '2026-11-17T10:00:00Z',
  gateway_response: 'Successful',
  fees: 32_250, // ₦322.50
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
    p_gateway: 'paystack',
    p_gateway_transaction_id: 987,
    p_paid_at: '2026-11-17T10:00:05Z',
    p_gateway_fee_kobo: 32_250,
    p_platform_fee_kobo: 0,
  }])
  assertEquals(calls.updates, [{ status: 'successful', gateway_transaction_id: 987, failure_reason: null }])
})

Deno.test('records the RentPadi fee fixed at checkout, not anything from Paystack', async () => {
  const { admin, calls } = fakeAdmin({ ...attempt, platform_fee_kobo: 200_000 })
  await settleTransaction(admin, tx())
  assertEquals((calls.rpc[0] as { p_platform_fee_kobo: number }).p_platform_fee_kobo, 200_000)
})

Deno.test('a missing or nonsense Paystack fee is stored as unknown, never guessed', async () => {
  for (const fees of [null, -1]) {
    const { admin, calls } = fakeAdmin(attempt)
    await settleTransaction(admin, tx({ fees }))
    assertEquals((calls.rpc[0] as { p_gateway_fee_kobo: number | null }).p_gateway_fee_kobo, null)
  }
})

Deno.test('uses created_at when Paystack gives no paid_at', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  await settleTransaction(admin, tx({ paid_at: null }))
  assertEquals((calls.rpc[0] as { p_paid_at: string }).p_paid_at, '2026-11-17T10:00:00Z')
})

Deno.test('refuses an underpayment and records nothing', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  const result = await settleTransaction(admin, tx({ amount: 34_999_999 }))
  assertEquals(result.outcome, 'failed')
  assertEquals(calls.rpc.length, 0)
})

Deno.test('refuses a non-NGN payment', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  const result = await settleTransaction(admin, tx({ currency: 'USD' }))
  assertEquals(result.outcome, 'failed')
  assertEquals(calls.rpc.length, 0)
})

for (const status of ['failed', 'reversed']) {
  Deno.test(`a ${status} transaction marks the attempt failed`, async () => {
    const { admin, calls } = fakeAdmin(attempt)
    const result = await settleTransaction(admin, tx({ status }))
    assertEquals(result.outcome, 'failed')
    assertEquals(calls.rpc.length, 0)
    assertEquals((calls.updates[0] as { status: string }).status, 'failed')
  })
}

Deno.test('an abandoned checkout is reported but the attempt stays open (the tenant may still pay)', async () => {
  const { admin, calls } = fakeAdmin(attempt)
  const result = await settleTransaction(admin, tx({ status: 'abandoned' }))
  assertEquals(result.outcome, 'failed')
  assertEquals(calls.rpc.length + calls.updates.length, 0)
})

for (const status of ['ongoing', 'pending', 'processing', 'queued']) {
  Deno.test(`an ${status} transaction changes nothing`, async () => {
    const { admin, calls } = fakeAdmin(attempt)
    assertEquals(await settleTransaction(admin, tx({ status })), { outcome: 'pending' })
    assertEquals(calls.rpc.length + calls.updates.length, 0)
  })
}

Deno.test('an unknown reference is ignored', async () => {
  const { admin, calls } = fakeAdmin(null)
  assertEquals((await settleTransaction(admin, tx())).outcome, 'ignored')
  assertEquals(calls.rpc.length, 0)
})
