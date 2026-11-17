import type { Database } from '@/types/database'

export type ChargeTiming = 'overdue' | 'due_soon' | 'upcoming' | 'paid' | 'cancelled'
export type ChargeStatus = Database['public']['Enums']['charge_status']

/** A row of the charge_overview view, with the view's nullable columns narrowed. */
export type Charge = {
  id: string
  tenant_id: string
  tenant_name: string
  tenant_phone: string
  unit_id: string
  unit_label: string
  property_id: string
  property_name: string
  period_start: string
  period_end: string
  due_date: string
  amount_kobo: number
  amount_paid_kobo: number
  balance_kobo: number
  status: ChargeStatus
  days_until_due: number
  timing: ChargeTiming
}

type ViewRow = Database['public']['Views']['charge_overview']['Row']

/** Views report every column as nullable; these never are (they come from NOT NULL joins). */
export function toCharge(row: ViewRow): Charge {
  return row as Charge
}

/** -3 → "3 days late", 0 → "Due today", 1 → "Due tomorrow", 12 → "Due in 12 days". */
export function dueLabel(daysUntilDue: number): string {
  if (daysUntilDue === 0) return 'Due today'
  if (daysUntilDue === 1) return 'Due tomorrow'
  if (daysUntilDue === -1) return '1 day late'
  const abs = Math.abs(daysUntilDue)
  const span = abs >= 60 ? `${Math.floor(abs / 30)} months` : `${abs} days`
  return daysUntilDue < 0 ? `${span} late` : `Due in ${span}`
}

export const TIMING_LABEL: Record<ChargeTiming, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export type Bucket = { count: number; totalKobo: number; charges: Charge[] }

/** Split open charges into dashboard buckets. Overdue: most days late first. Due soon: soonest first. */
export function bucketCharges(charges: Charge[]): { overdue: Bucket; dueSoon: Bucket } {
  const make = (timing: ChargeTiming, sort: (a: Charge, b: Charge) => number): Bucket => {
    const list = charges.filter((c) => c.timing === timing).sort(sort)
    return {
      count: list.length,
      totalKobo: list.reduce((sum, c) => sum + c.balance_kobo, 0),
      charges: list,
    }
  }
  return {
    overdue: make('overdue', (a, b) => a.days_until_due - b.days_until_due),
    dueSoon: make('due_soon', (a, b) => a.days_until_due - b.days_until_due),
  }
}

type Payable = { id: string; due_date: string; balance_kobo: number; status: ChargeStatus }

/** Is there still money owed on this charge? */
export const isOpen = (c: Payable) => c.balance_kobo > 0 && c.status !== 'cancelled' && c.status !== 'paid'

/**
 * Rent is paid in order: only the earliest open charge can be paid or recorded.
 * Mirrors public.earlier_open_charge in SQL. Returns null when nothing is owed.
 */
export function firstOpenCharge<T extends Payable>(charges: T[]): T | null {
  return charges.filter(isOpen).sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null
}
