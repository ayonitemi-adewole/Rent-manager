import { format, parseISO } from 'date-fns'

// Mirrors public.reminder_message in SQL, so a WhatsApp reminder reads like the SMS one.

export const REMINDER_KIND_LABEL: Record<string, string> = {
  d60: '60 days before',
  d30: '30 days before',
  d14: '14 days before',
  d7: '7 days before',
  d1: '1 day before',
  od1: '1 day late',
  od7: '7 days late',
  od14: '14 days late',
  receipt: 'Receipt',
  manual: 'Sent by you',
}

/** Matches public.reminder_kind: monthly starts at 14 days, six-monthly at 30, yearly at 60. */
export function reminderDaysBefore(period: 'monthly' | 'six_monthly' | 'yearly'): string {
  if (period === 'monthly') return '14, 7 and 1'
  if (period === 'yearly') return '60, 30, 14, 7 and 1'
  return '30, 14, 7 and 1'
}

type MessageInput = {
  daysUntilDue: number
  tenantName: string
  balanceKobo: number
  unitLabel: string
  dueDate: string
  link: string
  landlordName: string
}

/** "350,000" / "1,500.5" — naira without the symbol (SMS-safe "N" prefix added by caller). */
export function nairaPlain(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })
}

export function reminderMessage(m: MessageInput): string {
  const first = m.tenantName.trim().split(/\s+/)[0]
  const amount = `N${nairaPlain(m.balanceKobo)}`
  const due = format(parseISO(m.dueDate), 'd MMM')
  if (m.daysUntilDue < 0) {
    return `Hi ${first}, your rent of ${amount} for ${m.unitLabel} was due ${due}. Please pay: ${m.link} - ${m.landlordName}`
  }
  if (m.daysUntilDue === 1) {
    return `Hi ${first}, your rent of ${amount} for ${m.unitLabel} is due tomorrow, ${due}. Pay: ${m.link} - ${m.landlordName}`
  }
  return `Hi ${first}, your rent of ${amount} for ${m.unitLabel} is due ${due}. Pay securely: ${m.link} - ${m.landlordName}`
}

/** wa.me deep link that opens WhatsApp with the message ready to send. */
export function whatsappLink(phoneE164: string, message: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`
}
