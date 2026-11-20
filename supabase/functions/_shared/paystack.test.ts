// Run: npx deno test supabase/functions/_shared/paystack.test.ts
import { assertEquals } from 'jsr:@std/assert@1.0.13'
import { isValidSignature, resolveAccount, SKIPPED_LOOKUP_NAME } from './paystack.ts'

/** Runs fn with these env vars and a fetch that answers a lookup as "ADA OBI", counting calls. */
async function withLookupEnv(env: Record<string, string | undefined>, fn: (calls: () => number) => Promise<void>) {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, Deno.env.get(k)]))
  const realFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = () => {
    calls++
    return Promise.resolve(Response.json({ status: true, message: 'ok', data: { account_name: 'ADA OBI' } }))
  }
  for (const [k, v] of Object.entries(env)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v)
  try {
    await fn(() => calls)
  } finally {
    globalThis.fetch = realFetch
    for (const [k, v] of Object.entries(saved)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v)
  }
}

Deno.test('test key + PAYSTACK_TEST_SKIP_LOOKUP: no lookup, placeholder name', async () => {
  await withLookupEnv({ PAYSTACK_SECRET_KEY: 'sk_test_x', PAYSTACK_TEST_SKIP_LOOKUP: 'true' }, async (calls) => {
    assertEquals(await resolveAccount('0123456789', '058'), SKIPPED_LOOKUP_NAME)
    assertEquals(calls(), 0)
  })
})

Deno.test('a live key always looks the account up, even with the shortcut on', async () => {
  await withLookupEnv({ PAYSTACK_SECRET_KEY: 'sk_live_x', PAYSTACK_TEST_SKIP_LOOKUP: 'true' }, async (calls) => {
    assertEquals(await resolveAccount('0123456789', '058'), 'ADA OBI')
    assertEquals(calls(), 1)
  })
})

Deno.test('without the setting, test mode looks the account up', async () => {
  for (const value of [undefined, 'false', '1', '']) {
    await withLookupEnv({ PAYSTACK_SECRET_KEY: 'sk_test_x', PAYSTACK_TEST_SKIP_LOOKUP: value }, async (calls) => {
      assertEquals(await resolveAccount('0123456789', '058'), 'ADA OBI')
      assertEquals(calls(), 1)
    })
  }
})

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
