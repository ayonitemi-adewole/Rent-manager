import { describe, expect, it } from 'vitest'
import { reminderDaysBefore, reminderMessage, whatsappLink } from './reminders'

const base = {
  tenantName: 'Tola Bakare',
  balanceKobo: 35_000_000,
  unitLabel: 'Flat 2',
  dueDate: '2026-12-01',
  link: 'https://x.app/t/abc',
  landlordName: 'Mr Adeyemi',
}

// These strings must match supabase/tests/reminders.sql (the SMS version).
describe('reminderMessage', () => {
  it('before due', () => {
    expect(reminderMessage({ ...base, daysUntilDue: 7 })).toBe(
      'Hi Tola, your rent of N350,000 for Flat 2 is due 1 Dec. Pay securely: https://x.app/t/abc - Mr Adeyemi',
    )
  })

  it('due tomorrow', () => {
    expect(reminderMessage({ ...base, dueDate: '2026-12-02', daysUntilDue: 1 })).toMatch(
      /^Hi Tola, your rent of N350,000 for Flat 2 is due tomorrow, 2 Dec\./,
    )
  })

  it('overdue, part-paid balance with kobo', () => {
    expect(
      reminderMessage({
        ...base,
        tenantName: 'Tola',
        balanceKobo: 150_050,
        unitLabel: 'Room 3',
        dueDate: '2026-11-24',
        daysUntilDue: -7,
        link: 'L',
        landlordName: 'Mr A',
      }),
    ).toBe('Hi Tola, your rent of N1,500.5 for Room 3 was due 24 Nov. Please pay: L - Mr A')
  })
})

describe('whatsappLink', () => {
  it('uses digits only and encodes the text', () => {
    expect(whatsappLink('+2348031234567', 'Hi & bye')).toBe('https://wa.me/2348031234567?text=Hi%20%26%20bye')
  })
})

describe('reminderDaysBefore', () => {
  it('monthly starts at 14 days', () => expect(reminderDaysBefore('monthly')).toBe('14, 7 and 1'))
  it('six-monthly starts at 30 days', () => expect(reminderDaysBefore('six_monthly')).toBe('30, 14, 7 and 1'))
  it('yearly starts at 60 days', () => expect(reminderDaysBefore('yearly')).toBe('60, 30, 14, 7 and 1'))
})
