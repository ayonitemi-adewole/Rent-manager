// Run: npx deno test supabase/functions/_shared/scrub.test.ts
import { assertEquals } from 'jsr:@std/assert@1.0.13'
import { scrubDeep, scrubText } from './scrub.ts'

const cases: [string, string, string][] = [
  ['tenant link token', 'GET https://rent-padi.vercel.app/t/x7Kp2Qm9LzRtAb12Cd34Ef56/paid', 'GET https://rent-padi.vercel.app/t/[token]/paid'],
  ['receipt link token', '/r/abcdefghijklmnopqrstuvwx', '/r/[token]'],
  ['international phone', 'sent to +2348031234567', 'sent to [phone]'],
  ['phone without plus', 'to 2348031234567 failed', 'to [phone] failed'],
  ['local phone', 'call 08031234567', 'call [phone]'],
  ['spaced local phone', 'call 0803 123 4567', 'call [phone]'],
  ['email', 'notify ada.obi+rent@example.com now', 'notify [email] now'],
  ['account number', 'account 0123456789 not found', 'account [number] not found'],
  ['secret key', 'key sk_live_abc123XYZ was rejected', 'key [key] was rejected'],
  ['bearer header', 'Authorization: Bearer abc.def.ghi', 'Authorization: Bearer [redacted]'],
  ['jwt', 'token eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4', 'token [jwt]'],
  ['token in a query string', '/verify?reference=RP-1&token=secretvalue123', '/verify?reference=RP-1&token=[redacted]'],
]

for (const [name, input, expected] of cases) {
  Deno.test(`scrubs ${name}`, () => assertEquals(scrubText(input), expected))
}

Deno.test('keeps what helps debugging: amounts, references, dates, function names', () => {
  const text = 'pay-checkout: charge 7f3a amount 35000000 kobo, reference RP-1b2c, due 2026-12-01'
  assertEquals(scrubText(text), text)
})

Deno.test('walks nested objects and arrays, and leaves other values alone', () => {
  const event = {
    request: { url: 'https://x.app/t/x7Kp2Qm9LzRtAb12Cd34Ef56' },
    breadcrumbs: [{ message: 'sent to +2348031234567', data: { status: 200 } }],
    level: 'error',
    count: 3,
    ok: true,
  }
  assertEquals(scrubDeep(event), {
    request: { url: 'https://x.app/t/[token]' },
    breadcrumbs: [{ message: 'sent to [phone]', data: { status: 200 } }],
    level: 'error',
    count: 3,
    ok: true,
  })
})

Deno.test('does not loop on cycles', () => {
  const a: Record<string, unknown> = { name: 'a' }
  a.self = a
  assertEquals((scrubDeep(a) as Record<string, unknown>).self, '[cut]')
})
