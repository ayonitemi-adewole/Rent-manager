import { assertEquals, assertRejects, assertStringIncludes } from 'jsr:@std/assert@1.0.13'
import { sendSms, TermiiError, type TermiiConfig } from '../_shared/termii.ts'
import { signWebhook, verifyWebhook } from '../_shared/webhook.ts'
import { loginCodeTemplate } from '../_shared/wa-templates.ts'
import type { WhatsAppConfig } from '../_shared/whatsapp.ts'
import { handleSmsHook, otpMessage, parseChannels, type HookDeps } from './index.ts'

const SECRET = 'v1,whsec_' + btoa('test-secret-of-32-bytes-length!!')
const config: TermiiConfig = { apiKey: 'key', senderId: 'RentPadi', baseUrl: 'https://termii.test/' }
const wa: WhatsAppConfig = { token: 't', phoneNumberId: '1', apiVersion: 'v23.0' }

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

type Sent = { channel: string; to: string; message: unknown }

function fakeDeps(over: Partial<HookDeps> = {}, fail: string[] = []) {
  const sent: Sent[] = []
  const deps: HookDeps = {
    channels: ['whatsapp', 'sms'],
    whatsapp: wa,
    termii: config,
    sendWhatsApp: (_c, to, message) => {
      if (fail.includes('whatsapp')) return Promise.reject(new Error('WhatsApp 400: template not approved'))
      sent.push({ channel: 'whatsapp', to, message })
      return Promise.resolve('wamid.1')
    },
    sendSms: (_c, to, message) => {
      if (fail.includes('sms')) return Promise.reject(new TermiiError('Termii 400: Insufficient balance'))
      sent.push({ channel: 'sms', to, message })
      return Promise.resolve('msg-id')
    },
    ...over,
  }
  return { sent, deps }
}

Deno.env.set('SEND_SMS_HOOK_SECRET', SECRET)
const payload = { user: { phone: '2348031234567' }, sms: { otp: '123456' } }

Deno.test('sends the code on WhatsApp first, as the login_code template', async () => {
  const { sent, deps } = fakeDeps()
  const res = await handleSmsHook(await signedRequest(payload), deps)
  assertEquals(res.status, 200)
  assertEquals(sent, [{ channel: 'whatsapp', to: '+2348031234567', message: loginCodeTemplate('123456') }])
  assertStringIncludes(JSON.stringify(sent[0].message), '"name":"login_code"')
})

Deno.test('falls back to SMS when WhatsApp refuses', async () => {
  const { sent, deps } = fakeDeps({}, ['whatsapp'])
  const res = await handleSmsHook(await signedRequest(payload), deps)
  assertEquals(res.status, 200)
  assertEquals(sent, [{ channel: 'sms', to: '+2348031234567', message: otpMessage('123456') }])
})

Deno.test('uses SMS only while WhatsApp is not set up', async () => {
  const { sent, deps } = fakeDeps({ whatsapp: null })
  await handleSmsHook(await signedRequest(payload), deps)
  assertEquals(sent.map((s) => s.channel), ['sms'])
})

Deno.test('uses WhatsApp only while Termii is not set up', async () => {
  const { sent, deps } = fakeDeps({ termii: null })
  await handleSmsHook(await signedRequest(payload), deps)
  assertEquals(sent.map((s) => s.channel), ['whatsapp'])
})

Deno.test('OTP_CHANNELS can put SMS first', async () => {
  const { sent, deps } = fakeDeps({ channels: parseChannels('sms, whatsapp') })
  await handleSmsHook(await signedRequest(payload), deps)
  assertEquals(sent.map((s) => s.channel), ['sms'])
})

Deno.test('parseChannels ignores unknown names and duplicates', () => {
  assertEquals(parseChannels(undefined), ['whatsapp', 'sms'])
  assertEquals(parseChannels('SMS,telegram,sms'), ['sms'])
})

Deno.test('nothing set up: a clear hook error, nothing sent', async () => {
  const { sent, deps } = fakeDeps({ whatsapp: null, termii: null })
  const res = await handleSmsHook(await signedRequest(payload), deps)
  assertEquals(res.status, 500)
  assertEquals(sent, [])
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

Deno.test('every channel failing becomes a hook error Supabase understands', async () => {
  const res = await handleSmsHook(await signedRequest(payload), fakeDeps({}, ['whatsapp', 'sms']).deps)
  assertEquals(res.status, 502)
  assertEquals((await res.json()).error.http_code, 502)
})

Deno.test('accepts the secret however it was pasted', async () => {
  const body = '{}'
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = await signWebhook(SECRET, 'id', ts, body)
  const headers = new Headers({ 'webhook-id': 'id', 'webhook-timestamp': ts, 'webhook-signature': sig })
  const raw = SECRET.replace('v1,whsec_', '')
  for (const pasted of [SECRET, ` ${SECRET}
`, `'${SECRET}'`, `v1 whsec_${raw}`, `whsec_${raw}`, `other|${SECRET}`]) {
    assertEquals(await verifyWebhook(pasted.replace('other', 'v1,whsec_' + btoa('old-secret')), headers, body), true, pasted)
  }
})

Deno.test('a malformed secret is a clear hook error, not a crash', async () => {
  Deno.env.set('SEND_SMS_HOOK_SECRET', 'v1,whsec_not base64!!')
  try {
    const { sent, deps } = fakeDeps()
    const res = await handleSmsHook(await signedRequest(payload), deps)
    assertEquals(res.status, 500)
    assertEquals(sent, [])
  } finally {
    Deno.env.set('SEND_SMS_HOOK_SECRET', SECRET)
  }
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
