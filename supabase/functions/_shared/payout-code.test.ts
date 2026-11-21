import { assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert@1.0.13'
import { isPayoutChange } from './payout-change.ts'
import { hashCode, newCode } from './payout-code.ts'

/** A stand-in random source that hands out the given values in order. */
const values = (...ns: number[]) => {
  let i = 0
  return (buf: Uint32Array) => {
    buf[0] = ns[i++]
    return buf
  }
}

Deno.test('newCode: six digits, zero-padded', () => {
  assertEquals(newCode(values(42)), '000042')
  assertEquals(newCode(values(123_456_789)), '456789')
  for (let i = 0; i < 200; i++) assertMatch(newCode(), /^\d{6}$/)
})

Deno.test('newCode: redraws the top sliver of 32-bit values, so every code is equally likely', () => {
  // 4_294_000_000 is at or above the last full million below 2^32: it is skipped.
  assertEquals(newCode(values(4_294_000_000, 0xffff_ffff, 7)), '000007')
})

Deno.test('hashCode: same inputs, same hash; any change, a different hash', async () => {
  const forA = { userId: 'u1', bankCode: '058', accountNumber: '0123456789' }
  const base = await hashCode('secret', forA, '123456')
  assertMatch(base, /^[0-9a-f]{64}$/)
  assertEquals(await hashCode('secret', forA, '123456'), base)
  assertNotEquals(await hashCode('secret', forA, '123457'), base)
  assertNotEquals(await hashCode('other', forA, '123456'), base)
  assertNotEquals(await hashCode('secret', { ...forA, userId: 'u2' }, '123456'), base)
  assertNotEquals(await hashCode('secret', { ...forA, bankCode: '044' }, '123456'), base)
  assertNotEquals(await hashCode('secret', { ...forA, accountNumber: '9876543210' }, '123456'), base)
})

Deno.test('isPayoutChange: only replacing an account on file needs a code', () => {
  const onFile = { bank_code: '058', account_number: '0123456789' }
  assertEquals(isPayoutChange(null, '058', '0123456789'), false, 'no profile yet')
  assertEquals(isPayoutChange({ bank_code: null, account_number: null }, '058', '0123456789'), false, 'first setup')
  assertEquals(isPayoutChange(onFile, '058', '0123456789'), false, 'same account (confirming it)')
  assertEquals(isPayoutChange(onFile, '044', '0123456789'), true, 'other bank')
  assertEquals(isPayoutChange(onFile, '058', '9876543210'), true, 'other account number')
})
