import { formatKobo } from '@/lib/money'
import { hex, PdfPage, wrap } from '@/lib/pdf'
import { formatDate } from '@/lib/rent'

/** What public.receipt(p_token) returns. */
export type Receipt = {
  receipt_number: string
  amount_kobo: number
  method: 'link' | 'cash' | 'transfer'
  paid_at: string
  voided: boolean
  tenant_name: string
  unit_label: string
  property_name: string
  property_address: string | null
  landlord_name: string
  period_start: string
  period_end: string
  charge_amount_kobo: number
  balance_after_kobo: number
}

export const RECEIPT_METHOD: Record<Receipt['method'], string> = {
  link: 'Online (Flutterwave)',
  cash: 'Cash',
  transfer: 'Bank transfer',
}

/** The receipt's rows, shared by the web page and the PDF. */
export function receiptRows(r: Receipt): [label: string, value: string, note?: string][] {
  return [
    ['Received from', r.tenant_name],
    ['Paid to', r.landlord_name],
    ['For', `${r.unit_label}, ${r.property_name}`, r.property_address ?? undefined],
    ['Rent period', `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`],
    ['Date paid', formatDate(r.paid_at.slice(0, 10))],
    ['Method', RECEIPT_METHOD[r.method]],
    ['Rent for period', formatKobo(r.charge_amount_kobo)],
    ['Balance after this payment', r.balance_after_kobo > 0 ? formatKobo(r.balance_after_kobo) : 'Fully paid'],
  ]
}

export const receiptFileName = (r: Receipt) => `RentPadi-receipt-${r.receipt_number}.pdf`

/** The built-in PDF fonts have no ₦ sign. */
const naira = (kobo: number) => formatKobo(kobo).replace('₦', 'NGN ')

const GREEN = hex('#1f8a55')
const RED = hex('#c62828')
const GREY = hex('#6b7280')
const RULE = hex('#e5e7eb')

/** A5 receipt (opens nicely on phones). `link` is the online receipt, printed at the bottom. */
export function receiptPdf(r: Receipt, link: string): Uint8Array {
  const page = new PdfPage(420, 595)
  const left = 32
  const valueX = 168
  const right = page.width - 32

  page.rect(0, 0, page.width, 64, { fill: GREEN })
  page.text(left, 34, 'RentPadi', { size: 18, bold: true, color: [1, 1, 1] })
  page.text(left, 50, 'Rent receipt', { size: 10, color: [1, 1, 1] })

  page.text(left, 98, `Receipt ${r.receipt_number}`, { size: 15, bold: true })
  if (r.voided) {
    page.rect(right - 74, 76, 74, 30, { stroke: RED, lineWidth: 2 })
    page.text(right - 61, 99, 'VOID', { size: 20, bold: true, color: RED })
  }

  page.text(left, 128, 'Amount received', { size: 10, color: GREY })
  const amount = naira(r.amount_kobo)
  page.text(left, 156, amount, { size: 26, bold: true, color: r.voided ? GREY : [0, 0, 0] })
  // Strike through the amount (Helvetica Bold averages ~0.58 em per character here).
  if (r.voided) page.line(left, 147, left + amount.length * 26 * 0.58, 147, GREY, 1.5)

  let y = 196
  for (const [label, rawValue, note] of receiptRows(r)) {
    const value = rawValue.replace(/₦/g, 'NGN ')
    const lines = wrap(value, 40)
    const noteLines = note ? wrap(note, 46) : []
    page.text(left, y, label, { size: 9, color: GREY })
    lines.forEach((l, i) => page.text(valueX, y + i * 13, l, { size: 10, bold: true }))
    noteLines.forEach((l, i) => page.text(valueX, y + (lines.length + i) * 12, l, { size: 8, color: GREY }))
    y += Math.max(lines.length * 13 + noteLines.length * 12, 13) + 9
    page.line(left, y - 13, right, y - 13, RULE)
  }

  if (r.voided) {
    page.text(left, y + 6, 'This payment was cancelled by the landlord and is no longer valid.', {
      size: 9,
      color: RED,
    })
  }

  page.text(left, 548, 'Issued by RentPadi. Check this receipt online:', { size: 8, color: GREY })
  page.text(left, 561, link, { size: 8, color: GREEN })

  return page.toBytes(`RentPadi receipt ${r.receipt_number}`)
}
