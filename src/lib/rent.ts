import { format, parseISO } from 'date-fns'
import type { Enums } from '@/types/database'

export type RentPeriod = Enums<'rent_period'>
export type UnitType = Enums<'unit_type'>

export const RENT_PERIODS: { value: RentPeriod; label: string; per: string }[] = [
  { value: 'yearly', label: 'Yearly', per: '/yr' },
  { value: 'six_monthly', label: 'Every 6 months', per: '/6 mo' },
  { value: 'monthly', label: 'Monthly', per: '/mo' },
]

export const UNIT_TYPE_GROUPS = ['Rooms', 'Flats and apartments', 'Houses', 'Other'] as const

type UnitTypeOption = {
  value: UnitType
  label: string
  group: (typeof UNIT_TYPE_GROUPS)[number]
  /** Kept for units that already use it; not offered for new ones (replaced by the more specific types). */
  legacy?: boolean
}

/** In picker order (supabase/migrations/20261201090000_more_unit_types.sql). */
export const UNIT_TYPES: UnitTypeOption[] = [
  { value: 'room', label: 'Single room', group: 'Rooms' },
  { value: 'self_contain', label: 'Self contained', group: 'Rooms' },
  { value: 'room_and_parlour', label: 'Room and parlour', group: 'Rooms' },
  { value: 'mini_flat', label: 'Mini flat', group: 'Rooms' },
  { value: 'one_bedroom_flat', label: 'One bedroom flat', group: 'Flats and apartments' },
  { value: 'two_bedroom_flat', label: 'Two bedroom flat', group: 'Flats and apartments' },
  { value: 'three_bedroom_flat', label: 'Three bedroom flat', group: 'Flats and apartments' },
  { value: 'four_bedroom_flat', label: 'Four bedroom flat', group: 'Flats and apartments' },
  { value: 'studio_apartment', label: 'Studio apartment', group: 'Flats and apartments' },
  { value: 'apartment', label: 'Apartment', group: 'Flats and apartments' },
  { value: 'penthouse', label: 'Penthouse', group: 'Flats and apartments' },
  { value: 'flat', label: 'Flat', group: 'Flats and apartments', legacy: true },
  { value: 'terrace_house', label: 'Terrace house', group: 'Houses' },
  { value: 'townhouse', label: 'Townhouse', group: 'Houses' },
  { value: 'semi_detached_duplex', label: 'Semi-detached duplex', group: 'Houses' },
  { value: 'detached_duplex', label: 'Detached duplex', group: 'Houses' },
  { value: 'bungalow', label: 'Bungalow', group: 'Houses' },
  { value: 'detached_bungalow', label: 'Detached bungalow', group: 'Houses' },
  { value: 'villa', label: 'Villa', group: 'Houses' },
  { value: 'mansion', label: 'Mansion', group: 'Houses' },
  { value: 'duplex', label: 'Duplex', group: 'Houses', legacy: true },
  { value: 'shop', label: 'Shop', group: 'Other' },
  { value: 'other', label: 'Other', group: 'Other' },
]

/** The picker's choices, by group. A legacy type shows only on a unit that already has it. */
export function unitTypeChoices(current?: UnitType) {
  return UNIT_TYPE_GROUPS.map((group) => ({
    group,
    types: UNIT_TYPES.filter((t) => t.group === group && (!t.legacy || t.value === current)),
  }))
}

export const rentPeriodLabel = (p: RentPeriod) => RENT_PERIODS.find((x) => x.value === p)?.label ?? p
export const rentPeriodPer = (p: RentPeriod) => RENT_PERIODS.find((x) => x.value === p)?.per ?? ''
export const unitTypeLabel = (t: UnitType) => UNIT_TYPES.find((x) => x.value === t)?.label ?? t

/** "2026-11-17" → "17 Nov 2026" */
export const formatDate = (isoDate: string) => format(parseISO(isoDate), 'd MMM yyyy')

/** Today as "yyyy-MM-dd" in the user's local time (for <input type="date">). */
export const todayIso = () => format(new Date(), 'yyyy-MM-dd')
