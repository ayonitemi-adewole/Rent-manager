import { assertEquals } from 'jsr:@std/assert@1.0.13'
import { handler, UserError } from '../_shared/http.ts'
import type { OutboundRow } from '../_shared/wa-templates.ts'
import { WhatsAppError } from '../_shared/whatsapp.ts'
import { handleSendNow, type SendNowDeps } from './index.ts'

const row: OutboundRow = {
  id: 'rem-1',
  channel: 'whatsapp',
  kind: 'manual',
  to_phone: '+2348031234567',
  message: 'Hi Mama…',
  tenant_id: 'tenant-1',
  tenant_name: 'Mama Buka',
  unit_label: 'Shop 1',
  balance_kobo: 40_000_00,
  due_date: '2026-11-01',
  landlord_name: 'Adewole Properties',
  access_token: 'tok',
  receipt_number: null,
  receipt_token: null,
  payment_amount_kobo: null,
}

function deps(over: Partial<SendNowDeps> = {}, log: string[] = []): SendNowDeps {
  return {
    userId: () => Promise.resolve('landlord-1'),
    send: (r) => {
      log.push(`send ${r.to_phone}`)
      return Promise.resolve('wamid.1')
    },
    prepare: (landlordId, tenantId) => {
      log.push(`prepare ${landlordId} ${tenantId}`)
      return Promise.resolve(row)
    },
    markSent: (id, provider) => {
      log.push(`sent ${id} ${provider}`)
      return Promise.resolve()
    },
    markFailed: (id, error) => {
      log.push(`failed ${id} ${error}`)
      return Promise.resolve()
    },
    ...over,
  }
}

const call = (d: SendNowDeps, body: unknown = { tenant_id: 'tenant-1' }) =>
  handler((req) => handleSendNow(req, d))(
    new Request('https://fn.test/send-reminder-now', { method: 'POST', body: JSON.stringify(body) }),
  )

Deno.test('sends the reminder and records it as sent', async () => {
  const log: string[] = []
  const res = await call(deps({}, log))
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { status: 'sent', to: '+2348031234567' })
  assertEquals(log, ['prepare landlord-1 tenant-1', 'send +2348031234567', 'sent rem-1 wamid.1'])
})

Deno.test('signed-out callers are refused before anything happens', async () => {
  const log: string[] = []
  const res = await call(deps({ userId: () => Promise.reject(new UserError('Please sign in again.', 401)) }, log))
  assertEquals(res.status, 401)
  assertEquals(log, [])
})

Deno.test('WhatsApp not set up: a clear message, nothing recorded', async () => {
  const log: string[] = []
  const res = await call(deps({ send: null }, log))
  assertEquals(res.status, 503)
  assertEquals(log, [])
})

Deno.test('the database’s refusal (e.g. sent in the last 12 hours) is shown as is', async () => {
  const res = await call(
    deps({ prepare: () => Promise.reject(new UserError('You already sent Mama a WhatsApp reminder at 9:05 am.')) }),
  )
  assertEquals(res.status, 400)
  assertEquals((await res.json()).error, 'You already sent Mama a WhatsApp reminder at 9:05 am.')
})

Deno.test('a WhatsApp failure is recorded and explained in plain words', async () => {
  const log: string[] = []
  const res = await call(
    deps(
      {
        send: () =>
          Promise.reject(new WhatsAppError('WhatsApp 400: Recipient phone number not in allowed list', 131030)),
      },
      log,
    ),
  )
  assertEquals(res.status, 502)
  assertEquals((await res.json()).error, 'RentPadi’s WhatsApp is still in test mode and can’t message this number yet.')
  assertEquals(log.at(-1), 'failed rem-1 WhatsApp 400: Recipient phone number not in allowed list')
})

Deno.test('a missing tenant id is refused', async () => {
  assertEquals((await call(deps(), {})).status, 400)
})
