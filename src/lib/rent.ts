import { format, parseISO } from 'date-fns'
import type { Enums } from '@/types/database'

export type RentPeriod = Enums<'rent_period'>
export type UnitType = Enums<'unit_type'>

export const RENT_PERIODS: { value: RentPeriod; label: string; per: string }[] = [
  { value: 'yearly', label: 'Yearly', per: '/yr' },
  { value: 'six_monthly', label: 'Every 6 months', per: '/6 mo' },
  { value: 'monthly', label: 'Monthly', per: '/mo' },
]

export const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: 'room', label: 'Room' },
  { value: 'self_contain', label: 'Self-contain' },
  { value: 'mini_flat', label: 'Mini flat' },
  { value: 'flat', label: 'Flat' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'shop', label: 'Shop' },
  { value: 'other', label: 'Other' },
]

export const rentPeriodLabel = (p: RentPeriod) => RENT_PERIODS.find((x) => x.value === p)?.label ?? p
export const rentPeriodPer = (p: RentPeriod) => RENT_PERIODS.find((x) => x.value === p)?.per ?? ''
export const unitTypeLabel = (t: UnitType) => UNIT_TYPES.find((x) => x.value === t)?.label ?? t

/** "2026-11-17" → "17 Nov 2026" */
export const formatDate = (isoDate: string) => format(parseISO(isoDate), 'd MMM yyyy')

/** Today as "yyyy-MM-dd" in the user's local time (for <input type="date">). */
export const todayIso = () => format(new Date(), 'yyyy-MM-dd')
