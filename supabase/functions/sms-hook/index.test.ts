import { assertEquals, assertRejects } from 'jsr:@std/assert@1.0.13'
import { sendSms, TermiiError, type TermiiConfig } from '../_shared/termii.ts'
import { signWebhook, verifyWebhook } from '../_shared/webhook.ts'
import { handleSmsHook, otpMessage } from './index.ts'

const SECRET = 'v1,whsec_' + btoa('test-secret-of-32-bytes-length!!')
const config: TermiiConfig = { apiKey: 'key', senderId: 'RentPadi', baseUrl: 'https://termii.test/' }

async function signedRequest(payload: unknown, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(payload)
  const ts = String(timestamp)
  const signature = await signWebhook(secret, 'msg_1', ts, body)
  return new Request('https://fn.test/sms-hook', {
    method: 'POST',
    body,
    headers: { 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': signature },
  })
}

function fakeDeps(fail = false) {
  const sent: { to: string; message: string }[] = []
  return {
    sent,
    deps: {
      termiiConfigFromEnv: () => config,
      sendSms: (_c: TermiiConfig, to: string, message: string) => {
        if (fail) return Promise.reject(new TermiiError('Termii 400: Insufficient balance'))
        sent.push({ to, message })
        return Promise.resolve('msg-id')
      },
    },
  }
}

Deno.env.set('SEND_SMS_HOOK_SECRET', SECRET)
const payload = { user: { phone: '2348031234567' }, sms: { otp: '123456' } }

Deno.test('sends the code to the E.164 number', async () => {
  const { sent, deps } = fakeDeps()
  const res = await handleSmsHook(await signedRequest(payload), deps)
  assertEquals(res.status, 200)
  assertEquals(sent, [{ to: '+2348031234567', message: otpMessage('123456') }])
})

Deno.test('rejects a request signed with another secret', async () => {
  const { sent, deps } = fakeDeps()
  const res = await handleSmsHook(await signedRequest(payload, 'v1,whsec_' + btoa('another-secret')), deps)
  assertEquals(res.status, 401)
  assertEquals(sent.length, 0)
})

Deno.test('rejects a replayed request older than 5 minutes', async () => {
  const { deps } = fakeDeps()
  const res = await handleSmsHook(await signedRequest(payload, SECRET, Math.floor(Date.now() / 1000) - 600), deps)
  assertEquals(res.status, 401)
})

Deno.test('rejects a tampered body', async () => {
  const req = await signedRequest(payload)
  const tampered = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ ...payload, user: { phone: '2349999999999' } }),
  })
  assertEquals((await handleSmsHook(tampered, fakeDeps().deps)).status, 401)
})

Deno.test('a Termii failure becomes a hook error Supabase understands', async () => {
  const res = await handleSmsHook(await signedRequest(payload), fakeDeps(true).deps)
  assertEquals(res.status, 502)
  assertEquals((await res.json()).error.http_code, 502)
})

Deno.test('verifyWebhook accepts any of several signatures', async () => {
  const body = '{}'
  const ts = String(Math.floor(Date.now() / 1000))
  const good = await signWebhook(SECRET, 'id', ts, body)
  const headers = new Headers({ 'webhook-id': 'id', 'webhook-timestamp': ts, 'webhook-signature': `v1,bad ${good}` })
  assertEquals(await verifyWebhook(SECRET, headers, body), true)
})

Deno.test('sendSms posts to Termii on the dnd channel without the plus', async () => {
  let request: { url: string; body: Record<string, string> } | undefined
  const fakeFetch = ((url: string, init: RequestInit) => {
    request = { url, body: JSON.parse(String(init.body)) }
    return Promise.resolve(new Response(JSON.stringify({ message_id: 'abc', message: 'Successfully Sent' })))
  }) as unknown as typeof fetch
  assertEquals(await sendSms(config, '+2348031234567', 'hi', fakeFetch), 'abc')
  assertEquals(request?.url, 'https://termii.test/api/sms/send')
  assertEquals(request?.body, {
    api_key: 'key',
    to: '2348031234567',
    from: 'RentPadi',
    sms: 'hi',
    type: 'plain',
    channel: 'dnd',
  })
})

Deno.test('sendSms throws when Termii refuses', async () => {
  const fakeFetch = (() =>
    Promise.resolve(new Response(JSON.stringify({ message: 'Sender ID not approved' }), { status: 400 }))) as unknown as typeof fetch
  await assertRejects(() => sendSms(config, '+234803', 'hi', fakeFetch), TermiiError, 'Sender ID not approved')
})
