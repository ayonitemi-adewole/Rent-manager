// WhatsApp message templates for messages the tenant didn't start (reminders, receipts).
// Meta must approve each template before use. Create them exactly as in TEMPLATE_DEFINITIONS
// (Category: Utility, Language: English) in WhatsApp Manager → Message templates.

import { formatDay, nairaDigits } from './receipt-pdf.ts'
import type { OutboundMessage } from './whatsapp.ts'

export const TEMPLATE_DEFINITIONS = {
  rent_due_reminder: {
    body:
      'Hi {{1}}, your rent of {{2}} for {{3}} is due on {{4}}. Pay securely here: {{5}}\n\n' +
      'Sent for {{6}} by RentPadi. Tap below to check your rent or get receipts.',
    quickReply: 'Check my rent',
  },
  rent_overdue_reminder: {
    body:
      'Hi {{1}}, your rent of {{2}} for {{3}} was due on {{4}} and has not been paid yet. Please pay here: {{5}}\n\n' +
      'Sent for {{6}} by RentPadi. Already paid? Tap below to check.',
    quickReply: 'Check my rent',
  },
  rent_receipt: {
    header: 'Document',
    body: 'Hi {{1}}, your payment of {{2}} for {{3}} has been received. Receipt {{4}} is attached.\n\nSent for {{5}} by RentPadi.',
    quickReply: 'My receipts',
  },
} as const

export type TemplateName = keyof typeof TEMPLATE_DEFINITIONS

/** One claimed row from public.claim_outbound_messages. */
export type OutboundRow = {
  id: string
  channel: 'sms' | 'whatsapp'
  kind: string
  to_phone: string
  message: string
  tenant_id: string
  tenant_name: string
  unit_label: string
  balance_kobo: number
  due_date: string
  landlord_name: string
  access_token: string
  receipt_number: string | null
  receipt_token: string | null
  payment_amount_kobo: number | null
}

const naira = (kobo: number) => `₦${nairaDigits(kobo)}`
const firstName = (name: string) => name.trim().split(/\s+/)[0]

function build(
  name: TemplateName,
  params: string[],
  quickReplyPayload: string,
  header?: { documentId: string; filename: string },
): OutboundMessage {
  const components: unknown[] = []
  if (header) {
    components.push({
      type: 'header',
      parameters: [{ type: 'document', document: { id: header.documentId, filename: header.filename } }],
    })
  }
  // Template parameters may not contain newlines, tabs or 4+ spaces in a row.
  const clean = (s: string) => s.replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, '   ').slice(0, 1024)
  components.push({ type: 'body', parameters: params.map((p) => ({ type: 'text', text: clean(p) })) })
  // The quick-reply button sends this payload back, so the bot knows which tenancy to open.
  components.push({
    type: 'button',
    sub_type: 'quick_reply',
    index: '0',
    parameters: [{ type: 'payload', payload: quickReplyPayload }],
  })
  return { type: 'template', template: { name, language: { code: 'en' }, components } }
}

/** Reminder template for a claimed reminder row. */
export function reminderTemplate(row: OutboundRow, appUrl: string): OutboundMessage {
  const overdue = row.kind.startsWith('od')
  return build(
    overdue ? 'rent_overdue_reminder' : 'rent_due_reminder',
    [
      firstName(row.tenant_name),
      naira(row.balance_kobo),
      row.unit_label,
      formatDay(row.due_date),
      `${appUrl.replace(/\/$/, '')}/t/${row.access_token}`,
      row.landlord_name,
    ],
    `rent:${row.tenant_id}`,
  )
}

/** Receipt template with the PDF (already uploaded to WhatsApp) as its header. */
export function receiptTemplate(row: OutboundRow, documentId: string, filename: string): OutboundMessage {
  return build(
    'rent_receipt',
    [
      firstName(row.tenant_name),
      naira(row.payment_amount_kobo ?? 0),
      row.unit_label,
      row.receipt_number ?? '',
      row.landlord_name,
    ],
    `receipts:${row.tenant_id}`,
    { documentId, filename },
  )
}
