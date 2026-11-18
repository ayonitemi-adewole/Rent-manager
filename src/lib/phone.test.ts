import { describe, expect, it } from 'vitest'
import { formatNgPhone, formatPhone, normalizeNgPhone, normalizeWhatsappPhone } from './phone'

describe('normalizeNgPhone', () => {
  it.each([
    ['08031234567', '+2348031234567'],
    ['0803 123 4567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['+234 803 123 4567', '+2348031234567'],
    ['8031234567', '+2348031234567'],
    ['07061234567', '+2347061234567'],
    ['09151234567', '+2349151234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeNgPhone(input)).toBe(expected)
  })

  it.each(['', '0803123456', '080312345678', '06031234567', '08231234567', 'hello'])(
    'rejects %s',
    (input) => {
      expect(normalizeNgPhone(input)).toBeNull()
    },
  )
})

describe('formatNgPhone', () => {
  it('formats E.164 for display', () => {
    expect(formatNgPhone('+2348031234567')).toBe('0803 123 4567')
  })
})

describe('normalizeWhatsappPhone', () => {
  it.each([
    ['0803 123 4567', '+2348031234567'],
    ['+44 7911 123456', '+447911123456'],
    ['+1 (415) 555-0100', '+14155550100'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeWhatsappPhone(input)).toBe(expected)
  })
  it.each(['', '447911123456', '+0123456789', '+12345', 'hello'])('rejects %s', (input) => {
    expect(normalizeWhatsappPhone(input)).toBeNull()
  })
})

describe('formatPhone', () => {
  it('formats Nigerian numbers and leaves others', () => {
    expect(formatPhone('+2348031234567')).toBe('0803 123 4567')
    expect(formatPhone('+447911123456')).toBe('+447911123456')
  })
})
