import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1.0.13'
import { botReply, NOT_LINKED, parseCommand, type BotDeps, type Portal, type Tenancy } from './wa-bot.ts'
import { parseWebhook, signWebhookBody, verifyWebhookSignature, type OutboundMessage } from './whatsapp.ts'

const shop: Tenancy = {
  tenant_id: 'tenant-shop',
  access_token: 'token-shop-xxxxxxxxxxxxxxx',
  tenant_name: 'Mama Buka',
  unit_label: 'Shop 1',
  property_name: 'Ring Road shops',
  landlord_name: 'Adewole Properties',
}
const flat: Tenancy = { ...shop, tenant_id: 'tenant-flat', access_token: 'token-flat-xxxxxxxxxxxxxxx', unit_label: 'Flat 2' }

const charge = (over: Partial<Portal['charges'][number]>): Portal['charges'][number] => ({
  id: 'dec',
  period_start: '2026-12-17',
  period_end: '2027-01-16',
  due_date: '2026-12-17',
  amount_kobo: 40_000_00,
  balance_kobo: 40_000_00,
  status: 'unpaid',
  days_until_due: 29,
  ...over,
})

const portal = (over: Partial<Portal> = {}): Portal => ({
  landlord_name: 'Adewole Properties',
  can_pay_online: true,
  charges: [charge({}), charge({ id: 'jan', due_date: '2027-01-17', period_start: '2027-01-17', days_until_due: 60 })],
  receipts: [{ receipt_number: 'RP-0007', receipt_token: 'rcpt-7', amount_kobo: 40_000_00, paid_at: '2026-11-17T10:00:00Z' }],
  ...over,
})

function deps(over: Partial<BotDeps> = {}, calls: string[] = []): BotDeps {
  return {
    tenancies: (phone) => Promise.resolve(phone === '+2348031234567' ? [shop] : []),
    portal: () => Promise.resolve(portal()),
    checkout: (token, chargeId) => {
      calls.push(`checkout ${token} ${chargeId}`)
      return Promise.resolve('https://checkout.flutterwave.test/pay/abc')
    },
    receiptDocument: (token) => Promise.resolve({ type: 'document', document: { id: `media-${token}` } }),
    ...over,
  }
}

const msg = (text: string, from = '+2348031234567') => ({ id: 'wamid.1', from, text, isReply: false })
const body = (m: OutboundMessage) => JSON.stringify(m)
const ids = (m: OutboundMessage) => [...body(m).matchAll(/"id":"([^"]+)"/g)].map((x) => x[1])

Deno.test('an unknown number is told how to get linked', async () => {
  const [reply] = await botReply(msg('hi', '+2349999999999'), deps())
  assertEquals(reply, { type: 'text', text: { body: NOT_LINKED, preview_url: false } })
})

Deno.test('hi shows the menu for the tenancy', async () => {
  const [reply] = await botReply(msg('Hello'), deps())
  assertStringIncludes(body(reply), 'Hi Mama')
  assertStringIncludes(body(reply), 'Shop 1, Ring Road shops')
  assertEquals(ids(reply), ['rent:tenant-shop', 'pay:tenant-shop', 'receipts:tenant-shop'])
})

Deno.test('My rent shows the earliest unpaid rent and what comes after', async () => {
  const [reply] = await botReply(msg('rent:tenant-shop'), deps())
  assertStringIncludes(body(reply), '₦40,000')
  assertStringIncludes(body(reply), 'due on *17 Dec 2026* (in 29 days)')
  assertStringIncludes(body(reply), '1 more rent period unpaid')
  assertEquals(ids(reply), ['pay:tenant-shop', 'receipts:tenant-shop'])
})

Deno.test('late and part-paid rent is described', async () => {
  const late = portal({ charges: [charge({ days_until_due: -16, balance_kobo: 15_000_00 })] })
  const [reply] = await botReply(msg('how much do I owe?'), deps({ portal: () => Promise.resolve(late) }))
  assertStringIncludes(body(reply), '₦15,000* left of ₦40,000')
  assertStringIncludes(body(reply), '16 days late')
})

Deno.test('all paid up', async () => {
  const paid = portal({ charges: [charge({ status: 'paid', balance_kobo: 0 })] })
  const [reply] = await botReply(msg('rent:tenant-shop'), deps({ portal: () => Promise.resolve(paid) }))
  assertStringIncludes(body(reply), 'all paid up')
})

Deno.test('Pay rent sends a checkout button for the earliest unpaid rent', async () => {
  const calls: string[] = []
  const [reply] = await botReply(msg('pay:tenant-shop'), deps({}, calls))
  assertEquals(calls, ['checkout token-shop-xxxxxxxxxxxxxxx dec'])
  assertStringIncludes(body(reply), '"type":"cta_url"')
  assertStringIncludes(body(reply), 'https://checkout.flutterwave.test/pay/abc')
  assertStringIncludes(body(reply), 'Pay ₦40,000')
})

Deno.test('typing "I want to pay" also works', async () => {
  const calls: string[] = []
  await botReply(msg('I want to pay'), deps({}, calls))
  assertEquals(calls.length, 1)
})

Deno.test('no online payment: tells the tenant to pay the landlord', async () => {
  const offline = portal({ can_pay_online: false })
  const calls: string[] = []
  const [reply] = await botReply(msg('pay:tenant-shop'), deps({ portal: () => Promise.resolve(offline) }, calls))
  assertEquals(calls, [])
  assertStringIncludes(body(reply), 'hasn’t set up online payment')
})

Deno.test('checkout errors are passed on in plain words', async () => {
  const failing = deps({ checkout: () => Promise.reject(new Error('Please pay the earlier rent (due 2026-11-17) first.')) })
  const [reply] = await botReply(msg('pay:tenant-shop'), failing)
  assertStringIncludes(body(reply), 'Please pay the earlier rent')
})

Deno.test('Receipts lists them; tapping one sends the PDF', async () => {
  const [list] = await botReply(msg('receipts:tenant-shop'), deps())
  assertStringIncludes(body(list), 'RP-0007 · ₦40,000')
  assertEquals(ids(list), ['receipt:tenant-shop:rcpt-7'])
  const [doc] = await botReply(msg('receipt:tenant-shop:rcpt-7'), deps())
  assertEquals(doc, { type: 'document', document: { id: 'media-rcpt-7' } })
})

Deno.test('cannot fetch a receipt that is not theirs', async () => {
  const [reply] = await botReply(msg('receipt:tenant-shop:someone-elses'), deps())
  assertStringIncludes(body(reply), 'wasn’t found')
})

Deno.test('cannot open another tenant’s account by forging a button id', async () => {
  const calls: string[] = []
  // tenant-flat is not linked to this number: falls back to the sender's only tenancy.
  await botReply(msg('pay:tenant-flat'), deps({}, calls))
  assertEquals(calls, ['checkout token-shop-xxxxxxxxxxxxxxx dec'])
})

Deno.test('several tenancies: asks which one, keeping the chosen action', async () => {
  const two = deps({ tenancies: () => Promise.resolve([shop, flat]) })
  const [reply] = await botReply(msg('pay'), two)
  assertEquals(ids(reply), ['pay:tenant-shop', 'pay:tenant-flat'])
  const [menu] = await botReply(msg('menu:tenant-flat'), two)
  assertStringIncludes(body(menu), 'Flat 2')
})

Deno.test('parseCommand', () => {
  assertEquals(parseCommand('receipt:t1:r9'), { action: 'receipt', tenantId: 't1', arg: 'r9' })
  assertEquals(parseCommand('Check my rent').action, 'rent')
  assertEquals(parseCommand('send my receipts').action, 'receipts')
  assertEquals(parseCommand('good morning').action, 'menu')
})

// ─────────────────────────── whatsapp.ts ───────────────────────────

Deno.test('parseWebhook reads text, button and list replies, template buttons and statuses', () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { id: 'm1', from: '2348031234567', type: 'text', text: { body: 'hi' } },
                { id: 'm2', from: '2348031234567', type: 'interactive', interactive: { button_reply: { id: 'rent:t1' } } },
                { id: 'm3', from: '2348031234567', type: 'interactive', interactive: { list_reply: { id: 'receipt:t1:r' } } },
                { id: 'm4', from: '2348031234567', type: 'button', button: { payload: 'rent:t1', text: 'Check my rent' } },
              ],
              statuses: [{ id: 'wamid.9', status: 'failed', errors: [{ title: 'Not on WhatsApp' }] }],
            },
          },
        ],
      },
    ],
  }
  const { messages, statuses } = parseWebhook(payload)
  assertEquals(
    messages.map((m) => [m.from, m.text]),
    [
      ['+2348031234567', 'hi'],
      ['+2348031234567', 'rent:t1'],
      ['+2348031234567', 'receipt:t1:r'],
      ['+2348031234567', 'rent:t1'],
    ],
  )
  assertEquals(statuses, [{ id: 'wamid.9', status: 'failed', error: 'Not on WhatsApp' }])
})

Deno.test('webhook signatures', async () => {
  const sig = await signWebhookBody('app-secret', '{"a":1}')
  assert(sig.startsWith('sha256='))
  assert(await verifyWebhookSignature('app-secret', '{"a":1}', sig))
  assert(!(await verifyWebhookSignature('app-secret', '{"a":2}', sig)))
  assert(!(await verifyWebhookSignature('other', '{"a":1}', sig)))
  assert(!(await verifyWebhookSignature('app-secret', '{"a":1}', null)))
})
