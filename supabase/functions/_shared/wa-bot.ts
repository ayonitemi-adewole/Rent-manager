// The tenant WhatsApp assistant: check rent, pay, get receipts.
//
// Stateless: every button or list row carries "<action>:<tenantId>[:<receiptToken>]", and each
// message re-checks that the tenancy belongs to the number it came from. No conversation state.
// Pure logic: data access comes in through BotDeps, so it's tested without WhatsApp or a database.

import { formatDay, nairaDigits } from './receipt-pdf.ts'
import { buttons, linkButton, list, text, type Inbound, type OutboundMessage } from './whatsapp.ts'

export type Tenancy = {
  tenant_id: string
  access_token: string
  tenant_name: string
  unit_label: string
  property_name: string
  landlord_name: string
}

/** Subset of public.tenant_portal(token). */
export type Portal = {
  landlord_name: string
  can_pay_online: boolean
  charges: {
    id: string
    period_start: string
    period_end: string
    due_date: string
    amount_kobo: number
    balance_kobo: number
    status: string
    days_until_due: number
  }[]
  receipts: { receipt_number: string; receipt_token: string; amount_kobo: number; paid_at: string }[]
}

export type BotDeps = {
  tenancies: (phone: string) => Promise<Tenancy[]>
  portal: (accessToken: string) => Promise<Portal | null>
  /** Paystack checkout URL. Throws an Error whose message is safe to show the tenant. */
  checkout: (accessToken: string, chargeId: string) => Promise<string>
  /** The receipt as a WhatsApp document message, or null if not found. */
  receiptDocument: (receiptToken: string) => Promise<OutboundMessage | null>
}

type Action = 'menu' | 'rent' | 'pay' | 'receipts' | 'receipt'
const ACTIONS: Action[] = ['menu', 'rent', 'pay', 'receipts', 'receipt']

const naira = (kobo: number) => `₦${nairaDigits(kobo)}`
const firstName = (name: string) => name.trim().split(/\s+/)[0]

/** "rent:<id>" → { action, tenantId }; free text → a guessed action. */
export function parseCommand(input: string): { action: Action; tenantId?: string; arg?: string } {
  const [head, tenantId, arg] = input.trim().split(':')
  if (ACTIONS.includes(head as Action) && tenantId) return { action: head as Action, tenantId, arg }

  const t = input.toLowerCase()
  if (/\bpay\b|payment link/.test(t)) return { action: 'pay' }
  if (/receipt/.test(t)) return { action: 'receipts' }
  if (/\b(rent|owe|due|balance|check)\b/.test(t)) return { action: 'rent' }
  return { action: 'menu' }
}

function isOpen(c: Portal['charges'][number]) {
  return c.balance_kobo > 0 && c.status !== 'paid' && c.status !== 'cancelled'
}

/** Earliest unpaid rent (rent is paid in order). */
export function firstOpen(portal: Portal) {
  return [...portal.charges].filter(isOpen).sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null
}

function dueText(days: number, dueDate: string): string {
  const date = formatDay(dueDate)
  if (days === 0) return `due *today* (${date})`
  if (days === 1) return `due *tomorrow* (${date})`
  if (days > 1) return `due on *${date}* (in ${days} days)`
  return `was due on *${date}* (${-days} ${days === -1 ? 'day' : 'days'} late)`
}

const menuButtons = (id: string) => [
  { id: `rent:${id}`, title: 'My rent' },
  { id: `pay:${id}`, title: 'Pay rent' },
  { id: `receipts:${id}`, title: 'Receipts' },
]

export const NOT_LINKED =
  'Hello! This WhatsApp number isn’t linked to a rent account on RentPadi. ' +
  'If your landlord uses RentPadi, ask them to add this number as your WhatsApp number, then message us again.'

async function forTenancy(action: Action, t: Tenancy, arg: string | undefined, deps: BotDeps): Promise<OutboundMessage[]> {
  const where = `${t.unit_label}, ${t.property_name}`

  if (action === 'menu') {
    return [
      buttons(
        `Hi ${firstName(t.tenant_name)} 👋\nThis is RentPadi for *${where}* (landlord: ${t.landlord_name}).\n\nWhat would you like to do?`,
        menuButtons(t.tenant_id),
      ),
    ]
  }

  const portal = await deps.portal(t.access_token)
  if (!portal) return [text('Sorry, we couldn’t find your rent account. Please ask your landlord.')]
  const open = firstOpen(portal)

  if (action === 'rent') {
    if (!open) {
      return [
        buttons(
          `✅ You’re all paid up for *${where}*.\nWe’ll remind you before your next rent is due.`,
          [{ id: `receipts:${t.tenant_id}`, title: 'Receipts' }, { id: `menu:${t.tenant_id}`, title: 'Menu' }],
        ),
      ]
    }
    const partPaid = open.balance_kobo < open.amount_kobo
    const later = portal.charges.filter(isOpen).length - 1
    const lines = [
      `*${where}*`,
      `Rent for ${formatDay(open.period_start)} – ${formatDay(open.period_end)}`,
      partPaid ? `*${naira(open.balance_kobo)}* left of ${naira(open.amount_kobo)}` : `Amount: *${naira(open.balance_kobo)}*`,
      `This rent is ${dueText(open.days_until_due, open.due_date)}.`,
    ]
    if (later > 0) lines.push(`After this: ${later} more rent ${later === 1 ? 'period' : 'periods'} unpaid.`)
    const options = portal.can_pay_online
      ? [{ id: `pay:${t.tenant_id}`, title: `Pay ${naira(open.balance_kobo)}` }, { id: `receipts:${t.tenant_id}`, title: 'Receipts' }]
      : [{ id: `receipts:${t.tenant_id}`, title: 'Receipts' }, { id: `menu:${t.tenant_id}`, title: 'Menu' }]
    return [buttons(lines.join('\n'), options)]
  }

  if (action === 'pay') {
    if (!open) return [text(`✅ Nothing to pay right now for ${where}. You’re all paid up.`)]
    if (!portal.can_pay_online) {
      return [text(`${portal.landlord_name} hasn’t set up online payment yet. Please pay them directly, then ask them to record it.`)]
    }
    try {
      const url = await deps.checkout(t.access_token, open.id)
      return [
        linkButton(
          `Rent for *${where}*\n${formatDay(open.period_start)} – ${formatDay(open.period_end)}\nAmount: *${naira(open.balance_kobo)}*\n\n` +
            'Pay securely with Paystack (card, bank transfer or USSD). The money goes straight to your landlord’s account, and your receipt comes here.',
          `Pay ${naira(open.balance_kobo)}`,
          url,
        ),
      ]
    } catch (err) {
      return [text(err instanceof Error && err.message ? err.message : 'Sorry, we couldn’t start the payment. Please try again.')]
    }
  }

  if (action === 'receipts') {
    if (portal.receipts.length === 0) return [text(`No receipts yet for ${where}.`)]
    return [
      list(
        `Your receipts for *${where}*, newest first. Tap one to get the PDF.`,
        'Choose receipt',
        portal.receipts.map((r) => ({
          id: `receipt:${t.tenant_id}:${r.receipt_token}`,
          title: `${r.receipt_number} · ${naira(r.amount_kobo)}`,
          description: `Paid ${formatDay(r.paid_at)}`,
        })),
      ),
    ]
  }

  // action === 'receipt': only this tenant's own receipts.
  if (!arg || !portal.receipts.some((r) => r.receipt_token === arg)) {
    return [text('That receipt wasn’t found. Tap Receipts to see your list.')]
  }
  const doc = await deps.receiptDocument(arg)
  return [doc ?? text('That receipt wasn’t found. Tap Receipts to see your list.')]
}

/** The replies to one incoming message. */
export async function botReply(msg: Inbound, deps: BotDeps): Promise<OutboundMessage[]> {
  const tenancies = await deps.tenancies(msg.from)
  if (tenancies.length === 0) return [text(NOT_LINKED)]

  const { action, tenantId, arg } = parseCommand(msg.text)
  const chosen = tenantId ? tenancies.find((t) => t.tenant_id === tenantId) : undefined
  if (chosen) return forTenancy(action, chosen, arg, deps)
  if (tenancies.length === 1) return forTenancy(action === 'receipt' ? 'receipts' : action, tenancies[0], undefined, deps)

  // Several tenancies on this number (e.g. a flat and a shop): ask which one first.
  const next = action === 'receipt' ? 'receipts' : action
  return [
    list(
      `Hi ${firstName(tenancies[0].tenant_name)} 👋\nYou rent more than one place. Which one?`,
      'Choose',
      tenancies.map((t) => ({
        id: `${next}:${t.tenant_id}`,
        title: t.unit_label,
        description: `${t.property_name} · ${t.landlord_name}`,
      })),
    ),
  ]
}
