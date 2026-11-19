import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1.0.13'
import { loginCodeTemplate, receiptTemplate, reminderTemplate, TEMPLATE_DEFINITIONS, type OutboundRow } from '../_shared/wa-templates.ts'
import { handleSend, type SendDeps } from './index.ts'

const row = (over: Partial<OutboundRow> = {}): OutboundRow => ({
  id: 'r1',
  channel: 'whatsapp',
  kind: 'd7',
  to_phone: '+2348031234567',
  message: 'Hi Mama, your rent…',
  tenant_id: 'tenant-shop',
  tenant_name: 'Mama Buka',
  unit_label: 'Shop 1',
  balance_kobo: 40_000_00,
  due_date: '2026-12-17',
  landlord_name: 'Adewole Properties',
  access_token: 'tok',
  receipt_number: null,
  receipt_token: null,
  payment_amount_kobo: null,
  ...over,
})

const request = (secret = 'shh') =>
  new Request('https://fn.test/send-reminders', { method: 'POST', headers: { 'x-sender-secret': secret } })

function deps(over: Partial<SendDeps> = {}, log: string[] = []): SendDeps {
  return {
    secret: 'shh',
    senders: {
      whatsapp: (r) => Promise.resolve(`wa-${r.id}`),
      sms: (r) => Promise.resolve(`sms-${r.id}`),
    },
    claim: (channels) => {
      log.push(`claim ${channels.join(',')}`)
      return Promise.resolve([row(), row({ id: 'r2', channel: 'sms' })])
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

Deno.test('only the cron job (with the secret) can trigger sending', async () => {
  const log: string[] = []
  assertEquals((await handleSend(request('wrong'), deps({}, log))).status, 401)
  assertEquals(log, [])
})

Deno.test('sends each claimed message on its channel and records the provider id', async () => {
  const log: string[] = []
  const res = await handleSend(request(), deps({}, log))
  assertEquals(await res.json(), { sent: 2, failed: 0 })
  assertEquals(log, ['claim sms,whatsapp', 'sent r1 wa-r1', 'sent r2 sms-r2'])
})

Deno.test('only claims channels that are configured', async () => {
  const log: string[] = []
  await handleSend(request(), deps({ senders: { whatsapp: () => Promise.resolve('x') }, claim: (c) => {
    log.push(`claim ${c.join(',')}`)
    return Promise.resolve([])
  } }, log))
  assertEquals(log, ['claim whatsapp'])
})

Deno.test('nothing configured: claims nothing (messages stay queued)', async () => {
  const log: string[] = []
  const res = await handleSend(request(), deps({ senders: {} }, log))
  assertEquals((await res.json()).sent, 0)
  assertEquals(log, [])
})

Deno.test('a failure is recorded and the rest still go out', async () => {
  const log: string[] = []
  const res = await handleSend(
    request(),
    deps({ senders: { whatsapp: () => Promise.reject(new Error('WhatsApp 400: template not approved')), sms: () => Promise.resolve('ok') } }, log),
  )
  assertEquals(await res.json(), { sent: 1, failed: 1 })
  assertEquals(log.slice(1), ['failed r1 WhatsApp 400: template not approved', 'sent r2 ok'])
})

// ─────────────────────────── templates ───────────────────────────

const params = (m: ReturnType<typeof reminderTemplate>) =>
  ((m.template as { components: { type: string; parameters: { text?: string; payload?: string }[] }[] }).components)

Deno.test('due reminder template', () => {
  const m = reminderTemplate(row(), 'https://rentpadi.app/')
  assertEquals((m.template as { name: string }).name, 'rent_in_due_reminder')
  const [body, button] = params(m)
  assertEquals(body.parameters.map((p) => p.text), [
    'Mama',
    '₦40,000',
    'Shop 1',
    '17 Dec 2026',
    'https://rentpadi.app/t/tok',
    'Adewole Properties',
  ])
  assertEquals(button.parameters[0].payload, 'rent:tenant-shop')
})

Deno.test('overdue reminders use the overdue template', () => {
  assertEquals((reminderTemplate(row({ kind: 'od7' }), 'x').template as { name: string }).name, 'rent_overdue_reminder')
})

Deno.test('receipt template carries the PDF and a receipts button', () => {
  const m = receiptTemplate(row({ kind: 'receipt', receipt_number: 'RP-0007', payment_amount_kobo: 40_000_00 }), 'media-1', 'r.pdf')
  const [header, body, button] = params(m)
  assertStringIncludes(JSON.stringify(header), '"id":"media-1"')
  assertEquals(body.parameters.map((p) => p.text), ['Mama', '₦40,000', 'Shop 1', 'RP-0007', 'Adewole Properties'])
  assertEquals(button.parameters[0].payload, 'receipts:tenant-shop')
})

Deno.test('template parameter counts match the definitions', () => {
  const count = (s: string) => (s.match(/\{\{\d+\}\}/g) ?? []).length
  assertEquals(count(TEMPLATE_DEFINITIONS.rent_in_due_reminder.body), 6)
  assertEquals(count(TEMPLATE_DEFINITIONS.rent_overdue_reminder.body), 6)
  assertEquals(count(TEMPLATE_DEFINITIONS.rent_receipt.body), 5)
})

Deno.test('login code template: code in the body and the copy-code button', () => {
  const m = loginCodeTemplate('482913')
  assertEquals((m.template as { name: string }).name, 'login_code')
  const [body, button] = params(m)
  assertEquals(body.parameters[0].text, '482913')
  assertEquals(button.parameters[0].text, '482913')
})

Deno.test('manual reminders pick the due or overdue template by date', () => {
  const name = (due: string) =>
    (reminderTemplate(row({ kind: 'manual', due_date: due }), 'x', '2026-11-19').template as { name: string }).name
  assertEquals(name('2026-11-25'), 'rent_in_due_reminder')
  assertEquals(name('2026-11-19'), 'rent_in_due_reminder')
  assertEquals(name('2026-11-18'), 'rent_overdue_reminder')
})
