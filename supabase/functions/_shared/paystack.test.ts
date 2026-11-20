// Run: npx deno test supabase/functions/_shared/paystack.test.ts
import { assertEquals } from 'jsr:@std/assert@1.0.13'
import { isValidSignature } from './paystack.ts'

const SECRET = 'sk_test_example'
const BODY = '{"event":"charge.success","data":{"reference":"RP-abc"}}'

/** HMAC-SHA512 hex, computed independently of the code under test. */
async function sign(body: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, [
    'sign',
  ])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.test('accepts a body signed with the secret key', async () => {
  assertEquals(await isValidSignature(BODY, await sign(BODY, SECRET), SECRET), true)
})

Deno.test('accepts an upper-case or padded signature', async () => {
  assertEquals(await isValidSignature(BODY, ` ${(await sign(BODY, SECRET)).toUpperCase()} `, SECRET), true)
})

Deno.test('rejects a body changed after signing', async () => {
  assertEquals(await isValidSignature(BODY.replace('RP-abc', 'RP-xyz'), await sign(BODY, SECRET), SECRET), false)
})

Deno.test('rejects a signature made with another key', async () => {
  assertEquals(await isValidSignature(BODY, await sign(BODY, 'sk_test_other'), SECRET), false)
})

Deno.test('rejects a missing or truncated signature', async () => {
  assertEquals(await isValidSignature(BODY, '', SECRET), false)
  assertEquals(await isValidSignature(BODY, (await sign(BODY, SECRET)).slice(0, 64), SECRET), false)
})
