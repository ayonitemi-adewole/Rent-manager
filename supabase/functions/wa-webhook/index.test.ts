import { assertEquals } from 'jsr:@std/assert@1.0.13'
import { signWebhookBody, type Inbound } from '../_shared/whatsapp.ts'
import { handleWaWebhook, type WebhookDeps } from './index.ts'

function deps(handled: Inbound[] = [], statuses: string[] = []): WebhookDeps {
  const seen = new Set<string>()
  return {
    verifyToken: 'verify-me',
    appSecret: 'app-secret',
    handleMessage: (m) => {
      if (seen.has(m.id)) return Promise.resolve(false)
      seen.add(m.id)
      handled.push(m)
      return Promise.resolve(true)
    },
    handleStatus: (s) => {
      statuses.push(`${s.id}:${s.status}`)
      return Promise.resolve()
    },
  }
}

const payload = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [{ id: 'm1', from: '2348031234567', type: 'text', text: { body: 'hi' } }] } }] }],
})

async function post(body: string, secret = 'app-secret') {
  return new Request('https://fn.test/wa-webhook', {
    method: 'POST',
    body,
    headers: { 'x-hub-signature-256': await signWebhookBody(secret, body) },
  })
}

Deno.test('answers Meta’s verification with the challenge', async () => {
  const res = await handleWaWebhook(
    new Request('https://fn.test/wa-webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345'),
    deps(),
  )
  assertEquals([res.status, await res.text()], [200, '12345'])
})

Deno.test('refuses verification with the wrong token', async () => {
  const res = await handleWaWebhook(
    new Request('https://fn.test/wa-webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1'),
    deps(),
  )
  assertEquals(res.status, 403)
})

Deno.test('handles a signed message', async () => {
  const handled: Inbound[] = []
  const res = await handleWaWebhook(await post(payload), deps(handled))
  assertEquals(res.status, 200)
  assertEquals(handled.map((m) => [m.from, m.text]), [['+2348031234567', 'hi']])
})

Deno.test('rejects a message not signed by Meta', async () => {
  const handled: Inbound[] = []
  const res = await handleWaWebhook(await post(payload, 'forged'), deps(handled))
  assertEquals(res.status, 401)
  assertEquals(handled, [])
})

Deno.test('a redelivered message is handled once', async () => {
  const handled: Inbound[] = []
  const d = deps(handled)
  await handleWaWebhook(await post(payload), d)
  await handleWaWebhook(await post(payload), d)
  assertEquals(handled.length, 1)
})

Deno.test('one failing message does not stop the others or cause a retry storm', async () => {
  const two = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { id: 'bad', from: '234800', type: 'text', text: { body: 'x' } },
                { id: 'good', from: '234801', type: 'text', text: { body: 'y' } },
              ],
              statuses: [{ id: 'wamid.1', status: 'delivered' }],
            },
          },
        ],
      },
    ],
  })
  const handled: string[] = []
  const statuses: string[] = []
  const res = await handleWaWebhook(await post(two), {
    ...deps([], statuses),
    handleMessage: (m) => {
      if (m.id === 'bad') return Promise.reject(new Error('boom'))
      handled.push(m.id)
      return Promise.resolve(true)
    },
  })
  assertEquals(res.status, 200)
  assertEquals(handled, ['good'])
  assertEquals(statuses, ['wamid.1:delivered'])
})
