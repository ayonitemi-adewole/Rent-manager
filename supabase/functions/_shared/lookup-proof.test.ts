// Run: npx deno test supabase/functions/_shared/lookup-proof.test.ts
import { assertEquals } from 'jsr:@std/assert@1.0.13'
import { LOOKUP_TTL_SECONDS, signLookup, verifyLookup, type Lookup } from './lookup-proof.ts'

const SECRET = 'sk_test_example'
const NOW = 1_800_000_000
const lookup: Lookup = { userId: 'user-1', bankCode: '058', accountNumber: '0123456789', accountName: 'KUNLE ADEYEMI' }

Deno.test('a fresh proof for the same lookup is accepted', async () => {
  const proof = await signLookup(SECRET, lookup, NOW)
  assertEquals(await verifyLookup(SECRET, lookup, proof, NOW + 60), true)
})

Deno.test('a changed name, account, bank or landlord is refused', async () => {
  const proof = await signLookup(SECRET, lookup, NOW)
  for (const change of [
    { accountName: 'SOMEONE ELSE' },
    { accountNumber: '9876543210' },
    { bankCode: '044' },
    { userId: 'user-2' },
  ]) {
    assertEquals(await verifyLookup(SECRET, { ...lookup, ...change }, proof, NOW), false)
  }
})

Deno.test('an expired proof is refused', async () => {
  const proof = await signLookup(SECRET, lookup, NOW)
  assertEquals(await verifyLookup(SECRET, lookup, proof, NOW + LOOKUP_TTL_SECONDS + 1), false)
})

Deno.test('a proof signed with another key, or a made-up expiry, is refused', async () => {
  assertEquals(await verifyLookup(SECRET, lookup, await signLookup('sk_test_other', lookup, NOW), NOW), false)
  const [, sig] = (await signLookup(SECRET, lookup, NOW)).split('.')
  assertEquals(await verifyLookup(SECRET, lookup, `${NOW + 999_999}.${sig}`, NOW), false)
})

Deno.test('garbage is refused', async () => {
  for (const proof of ['', 'abc', '123.', '.ffff', `${NOW}.${'z'.repeat(64)}`]) {
    assertEquals(await verifyLookup(SECRET, lookup, proof, NOW), false)
  }
})
